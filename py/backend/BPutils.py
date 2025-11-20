import subprocess
import sys
import json
import base64
import aiofiles
import folder_paths
from PIL import Image
import io
import os
import aiohttp
import math

# --- Original part of the file ---
def calculate_dimensions(total_pixels):
    for width in range(int(math.sqrt(total_pixels // 3)), 0, -1):
        if (total_pixels // 3) % width == 0:
            height = (total_pixels // 3) // width
            return width, height
    return None, None

class directories:
    def __init__(self):
        base_folder = folder_paths.get_folder_paths("custom_nodes")[0]
        self.node = os.path.join(base_folder, "comfyui-photoshop")
        self.workflow = os.path.join(self.node, "data", "workflows")
        self.psinput = os.path.join(self.node, "data", "ps_inputs")
        self.psimg = os.path.join(self.psinput, "imgs")

dirs = directories()

def force_pull():
    try:
        import git
        repo = git.Repo(dirs.node)
        fetch_result = repo.git.fetch()
        reset_result = repo.git.reset("--hard", "origin/main")
    except git.exc.GitCommandError as e:
        print(f"# PS: Error: {e}")

def install_plugin():
    installer_path = os.path.join(dirs.node, "Install_Plugin", "installer.py")
    subprocess.run([sys.executable, installer_path])

async def save_file(data: str, filename: str):
    data = base64.b64decode(data)
    async with aiofiles.open(os.path.join(dirs.psimg, filename), "wb") as file:
        await file.write(data)

async def process_and_save_mask(mask_data: list, filename: str):
    if mask_data[0] == "nomask":
        target_width, target_height = int(mask_data[1]["width"]), int(mask_data[1]["height"])
        white_image = Image.new("L", (target_width, target_height), color=255)
        white_image.save(os.path.join(dirs.psimg, filename), format="PNG")
        return
    decoded_data = base64.b64decode(mask_data[0])
    mask_image = Image.open(io.BytesIO(decoded_data)).convert("L")
    target_width, target_height = int(mask_data[1]["width"]), int(mask_data[1]["height"])
    source_bounds = { "left": int(mask_data[2]["left"]), "top": int(mask_data[2]["top"]), "right": int(mask_data[2]["right"]),"bottom": int(mask_data[2]["bottom"]),}
    canvas = Image.new("L", (target_width, target_height), color=0)
    left, top = source_bounds["left"], source_bounds["top"]
    canvas.paste(mask_image, (left, top))
    canvas.save(os.path.join(dirs.psimg, filename), format="PNG")

# --- Version check function with print statements commented out ---
async def LatestVer(plugin_version: str):
    latest_version = None
    try:
        async with aiohttp.ClientSession() as session:
            url = "https://raw.githubusercontent.com/NimaNzrii/comfyui-photoshop/refs/heads/main/data/PreviewFiles/version.json"
            async with session.get(url) as response:
                if response.status == 200:
                    version_data = await response.json(content_type=None)
                    latest_version = version_data.get("version")
                    # The following print statements are now disabled
                    # if latest_version and plugin_version < latest_version:
                    #     print("🚫 Your plugin version is outdated! Please update to the latest version.")
                    # else:
                    #     print("✅ Updated already", version_data)
    except Exception:
        # Silently fail on version check error
        pass
    return latest_version

# --- Cleaned up function for sending images ---
async def send_images_to_photoshop(filenames: list, temp_dir: str):
    from BPclient import ws_manager
    try:
        batch_results = []
        for filename in filenames:
            try:
                filepath = os.path.join(temp_dir, filename)
                if not os.path.exists(filepath):
                    continue

                async with aiofiles.open(filepath, "rb") as image_file:
                    file_content = await image_file.read()

                image = Image.open(io.BytesIO(file_content)).convert("RGBA")
                width, height = image.size
                alpha_channel = image.getchannel("A")
                bbox = alpha_channel.getbbox()
                if not bbox:
                    bbox = (0, 0, width, height)

                source_bounds = {"left": bbox[0], "top": bbox[1], "right": bbox[2], "bottom": bbox[3]}
                uint8_array = list(file_content)
                batch_results.append({"image": uint8_array, "size": {"width": width, "height": height}, "sourceBounds": source_bounds, "filename": filename})
            except Exception as e:
                # Keep error logging for file processing issues
                print(f"PS Bridge: Error processing file '{filename}': {e}")

        if batch_results and ws_manager.photoshop_users:
            await ws_manager.send_message(ws_manager.photoshop_users, "render_batch", batch_results)
            # This is the only success message that will be printed
            print(f"Image sent to Photoshop successfully.")

    except Exception as e:
        print(f"PS Bridge: A critical error occurred while sending to PS: {e}")