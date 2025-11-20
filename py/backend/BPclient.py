import base64
import io
import json
import logging
from dataclasses import dataclass
import os
from aiohttp import web
import numpy as np
import msgpack
from BPutils import force_pull, install_plugin, dirs
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@dataclass
class Client:
    ws: web.WebSocketResponse
    platform: str
    ip: str


class WebSocketManager:
    def __init__(self):
        self.clients: dict[str, Client] = {}
        self.photoshop_users: list[str] = []
        self.comfyui_users: list[str] = []

    async def handle_cm_messages(self, msg: dict) -> None:
        if "pullupdate" in msg:
            await self.send_message(self.comfyui_users, "alert", "Updating, please Restart comfyui after update")
            force_pull()
        elif "install_plugin" in msg:
            install_plugin()
        else:
            # Only send to PS clients with the same IP
            sender_id = msg.get("_sender_id", "")
            sender_ip = self.clients[sender_id].ip if sender_id in self.clients else None
            if sender_ip:
                ps_users_same_ip = [uid for uid in self.photoshop_users if uid in self.clients and self.clients[uid].ip == sender_ip]
                await self.send_message(ps_users_same_ip, "", json.dumps(msg))
            else:
                await self.send_message(self.photoshop_users, "", json.dumps(msg))

    async def handle_ps_messages(self, msg: dict, sender_id: str) -> None:
        if "combinedData" in msg:
            combinedData = msg["combinedData"]
            if "changedImages" in combinedData:
                await process_changed_images(combinedData["changedImages"])
            if "maskBase64" in combinedData:
                await process_and_save_mask(combinedData["maskBase64"], "SELECTION.png")
            
            # Get sender IP
            sender_ip = self.clients[sender_id].ip if sender_id in self.clients else None
            if sender_ip:
                # Only send to CM clients with the same IP
                cm_users_same_ip = [uid for uid in self.comfyui_users if uid in self.clients and self.clients[uid].ip == sender_ip]
                await self.send_message(cm_users_same_ip, "queue", True)
            else:
                await self.send_message(self.comfyui_users, "queue", True)

        if not ("combinedData" in msg):
            # Get sender IP
            sender_ip = self.clients[sender_id].ip if sender_id in self.clients else None
            if sender_ip:
                # Only send to CM clients with the same IP
                cm_users_same_ip = [uid for uid in self.comfyui_users if uid in self.clients and self.clients[uid].ip == sender_ip]
                await self.send_message(cm_users_same_ip, "", json.dumps(msg))
            else:
                await self.send_message(self.comfyui_users, "", json.dumps(msg))

    async def handle_client_message(self, client_id: str, platform: str, data: str | bytes) -> None:
        try:
            if platform == "ps":
                msg = msgpack.unpackb(data, raw=False)
                await self.handle_ps_messages(msg, client_id)
            else:
                msg = json.loads(data)
                # Add sender ID to message for IP filtering
                msg["_sender_id"] = client_id
                await self.handle_cm_messages(msg)

        except (json.JSONDecodeError, msgpack.exceptions.ExtraData) as e:
            logger.error(f"Invalid message format received from {platform}: {e}")
        except Exception as e:
            logger.error(f"Error processing message from {platform}: {e}")

    async def handle_client_disconnect(self, client_id: str, platform: str) -> None:
        try:
            if client_id in self.clients:
                del self.clients[client_id]

            user_list = self.photoshop_users if platform == "ps" else self.comfyui_users
            if client_id in user_list:
                user_list.remove(client_id)
        except Exception as e:
            logger.error(f"Error handling disconnect for {client_id}: {e}")

    async def send_message(self, users: list[str], msg_type: str, message: str | bool = True) -> None:
        if not users:
            logger.warning("No users connected")
            return

        for user_id in users:
            if user_id in self.clients:
                try:
                    if self.clients[user_id].platform == "ps":
                        if msg_type:
                            payload = {msg_type: message}
                        else:
                            payload = json.loads(message) if isinstance(message, str) and message.strip().startswith(('{', '[')) else message
                        data = msgpack.packb(payload)
                        await self.clients[user_id].ws.send_bytes(data)
                    else:
                        data = json.dumps({msg_type: message}) if msg_type else message
                        await self.clients[user_id].ws.send_str(data)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
            else:
                logger.warning(f"User {user_id} not connected")


ws_manager = WebSocketManager()


async def process_changed_images(image_list: list) -> None:

    for index, image_dict in enumerate(image_list):
        title = "Untitled"
        try:
            title = image_dict["title"]
            image_info = image_dict["imageInfo"]

            if isinstance(image_info, str) and image_info.startswith("/9j/"):
                image_bytes = base64.b64decode(image_info)
                image = Image.open(io.BytesIO(image_bytes))
                width, height = image.size

                # Save image directly
                save_path = os.path.join(dirs.psimg, f"{title}.png")
                image.save(save_path)
                continue

            image_data = image_info["imageData"]
            transparent = image_info.get("transparent", False)
            width = image_info["width"]
            height = image_info["height"]

            expected_size_with_alpha = height * width * 4
            expected_size_without_alpha = height * width * 3

            if len(image_data) == expected_size_with_alpha:
                channels = 4
            elif len(image_data) == expected_size_without_alpha:
                channels = 3
            else:
                raise ValueError(f"Invalid image data size. Expected {expected_size_with_alpha} or {expected_size_without_alpha}, got {len(image_data)}")

            image_array = np.array(image_data, dtype=np.uint8).reshape((height, width, channels))

            mode = "RGBA" if channels == 4 else "RGB"
            image = Image.fromarray(image_array, mode=mode)

            source_bounds = image_info.get("sourceBounds", {"left": 0, "right": width, "top": 0, "bottom": height})
            left = source_bounds.get("left", 0)
            right = source_bounds.get("right", width)
            top = source_bounds.get("top", 0)
            bottom = source_bounds.get("bottom", height)

            source_width = right - left
            source_height = bottom - top

            resized_image = image.resize((source_width, source_height), Image.Resampling.LANCZOS)
            is_full_size = left == 0 and right == width and top == 0 and bottom == height

            if is_full_size:
                final_image = resized_image
            else:
                if channels == 4:
                    background = (0, 0, 0, 0)  # پس‌زمینه شفاف
                else:
                    background = (255, 255, 255)  # پس‌زمینه سفید

                background_image = Image.new(mode, (width, height), background)
                background_image.paste(resized_image, (left, top))
                final_image = background_image

            # ذخیره تصویر نهایی
            save_path = os.path.join(dirs.psimg, f"{title}.png")
            final_image.save(save_path)

        except Exception as e:
            logger.error(f"Error processing image ({title}): {e}", exc_info=True)


async def process_and_save_mask(mask_data: dict, output_filename: str) -> None:
    try:

        mask_array = mask_data.get("maskData", None)
        width = max(1, int(mask_data.get("width", 0)))
        height = max(1, int(mask_data.get("height", 0)))
        sourcebounds = mask_data.get("sourcebounds", None)

        bg = Image.new("L", (width, height), 0)

        if mask_array is None or (hasattr(mask_array, "data") and mask_array.data is None):
            output_path = os.path.join(dirs.psimg, output_filename)
            bg.save(output_path)
            return

        if hasattr(mask_array, "data"):
            mask_array = mask_array.data

        mask_np = np.frombuffer(mask_array, dtype=np.uint8)

        if mask_np.size == 0:
            output_path = os.path.join(dirs.psimg, output_filename)
            bg = Image.new("L", (width, height), 255)
            bg.save(output_path)
            return

        expected_size = width * height
        if mask_np.size != expected_size:

            mask_np = np.zeros(expected_size, dtype=np.uint8)

        mask_np = mask_np.reshape((height, width))

        raw_mask_image = Image.fromarray(mask_np, mode="L")
        # raw_output_path = os.path.join(dirs.psimg, "RAWMASK.png")
        # raw_mask_image.save(raw_output_path)
        # logger.info(f"Raw mask saved successfully: {raw_output_path}")

        if sourcebounds:
            left = max(0, round(sourcebounds.get("left", 0)))
            right_pad = max(0, round(sourcebounds.get("right", 0)))
            top = max(0, round(sourcebounds.get("top", 0)))
            bottom_pad = max(0, round(sourcebounds.get("bottom", 0)))

            new_width = max(0, width - left - right_pad)
            new_height = max(0, height - top - bottom_pad)

            if new_width <= 0 or new_height <= 0:
                new_width = width
                new_height = height
                left = 0
                top = 0

            resized_mask = raw_mask_image.resize((new_width, new_height), Image.Resampling.LANCZOS)

            bg.paste(resized_mask, (left, top))
        else:

            bg.paste(raw_mask_image, (0, 0))

        output_path = os.path.join(dirs.psimg, output_filename)
        bg.save(output_path)

    except Exception as e:
        logger.error(f"Error processing and saving mask: {e}", exc_info=True)
        try:

            bg = Image.new("L", (max(1, width), max(1, height)), 0)
            output_path = os.path.join(dirs.psimg, output_filename)
            bg.save(output_path)
        except Exception as save_error:
            logger.error(f"Error saving fallback image: {save_error}", exc_info=True)
