import hashlib
import os
import folder_paths
from PIL import Image
from io import BytesIO
import os
import torch
import numpy as np
from io import BytesIO
import folder_paths
import asyncio
from PIL import Image, ImageOps, ImageSequence, ImageFile

nodepath = os.path.join(folder_paths.get_folder_paths("custom_nodes")[0], "comfyui-photoshop")
imgpath = os.path.join(nodepath, "data", "ps_inputs", "imgs")


def loadImg(path):
    try:
        with open(path, "rb") as file:
            img_data = file.read()
        img = Image.open(BytesIO(img_data))
        img.verify()
        img = Image.open(BytesIO(img_data))
    except:
        img = Image.new(mode="RGB", size=(24, 24), color=(0, 0, 0))
    return img


class ClipPass:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"clip": ("CLIP",)}}

    RETURN_TYPES, RETURN_NAMES, FUNCTION, CATEGORY = (("CLIP",), ("clip",), "exe", "🔹BluePixel/🛠️ Utils")

    def exe(self, clip):
        return (clip,)


class modelPass:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"model": ("MODEL",)}}

    RETURN_TYPES, RETURN_NAMES, FUNCTION, CATEGORY = (("MODEL",), ("model",), "exe", "🔹BluePixel/🛠️ Utils")

    def exe(self, model):
        return (model,)


ImageFile.LOAD_TRUNCATED_IMAGES = True


#
# --- PASTE THIS ENTIRE BLOCK INTO nodeOther.py ---
#

class PsImages:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"ImageName": ("STRING", {"default": ""})}}

    RETURN_NAMES = ("RGB", "ALPHA", "SELECTION", "W", "H")
    RETURN_TYPES = ("IMAGE", "MASK", "MASK", "INT", "INT")

    FUNCTION = "select_image"
    CATEGORY = "🔹BluePixel/ToolBar"

    async def load_image_with_retry(self, image_path):
        delay = 0.1
        max_attempts = 5
        for attempt in range(max_attempts):
            try:
                img = Image.open(image_path)
                img.load()
                return img
            except (IOError, OSError, Image.DecompressionBombError) as e:
                if attempt == max_attempts - 1:
                    raise Exception(f"Failed to load image after {max_attempts} attempts: {e}")
                await asyncio.sleep(delay)
                delay *= 2

    async def select_image(self, ImageName): # <--- CHANGE 1
        # Default values
        default_size = (24, 24)
        output_image = torch.zeros((1, *default_size, 3), dtype=torch.float32)
        output_mask = torch.ones((1, *default_size), dtype=torch.float32)
        selection_mask = torch.ones((1, *default_size), dtype=torch.float32)
        w, h = default_size

        try:
            # Process main image
            image_path = os.path.join(imgpath, ImageName + ".png")
            img = await self.load_image_with_retry(image_path) # <--- CHANGE 2

            output_images = []
            output_masks = []

            for frame in ImageSequence.Iterator(img):
                frame = ImageOps.exif_transpose(frame)
                if frame.mode == "I":
                    frame = frame.point(lambda i: i * (1 / 255))

                # Alpha handling
                if frame.mode in ("RGBA", "LA"):
                    alpha = frame.split()[-1]
                    mask = np.array(alpha).astype(np.float32) / 255.0
                    # Create a white background
                    background = Image.new("RGB", frame.size, (255, 255, 255))
                    # Paste the image onto the white background using the alpha channel as a mask
                    background.paste(frame, mask=alpha)
                    frame = background
                else:
                    mask = np.ones((frame.height, frame.width), dtype=np.float32)

                # Convert to RGB
                if frame.mode != "RGB":
                    frame = frame.convert("RGB")

                # Get dimensions from first frame
                if not output_images:
                    w, h = frame.size

                # Skip frames with mismatched dimensions
                if frame.size != (w, h):
                    continue

                # Convert to tensors
                image_tensor = torch.from_numpy(np.array(frame).astype(np.float32) / 255.0).unsqueeze(0)
                mask_tensor = torch.from_numpy(mask).unsqueeze(0)

                output_images.append(image_tensor)
                output_masks.append(mask_tensor)

            # Combine frames
            if output_images:
                output_image = torch.cat(output_images, dim=0) if len(output_images) > 1 else output_images[0]
                output_mask = torch.cat(output_masks, dim=0) if len(output_masks) > 1 else output_masks[0]

            # Process SELECTION.png
            try:
                selection_img = await self.load_image_with_retry(os.path.join(imgpath, "SELECTION.png")) # <--- CHANGE 3
                selection_mask = []
                for frame in ImageSequence.Iterator(selection_img):
                    frame = ImageOps.exif_transpose(frame).convert("RGB")
                    red_channel = np.array(frame)[:, :, 0].astype(np.float32) / 255.0
                    selection_mask.append(torch.from_numpy(red_channel).unsqueeze(0))

                selection_mask = torch.cat(selection_mask, dim=0) if len(selection_mask) > 1 else selection_mask[0]
                if h and w: selection_mask = torch.nn.functional.interpolate(selection_mask.unsqueeze(1), size=(h, w), mode='nearest').squeeze(1)
            except:
                selection_mask = torch.ones((1, h, w), dtype=torch.float32) if w and h else torch.ones((1, *default_size), dtype=torch.float32)
            
            output_mask = output_mask[:, :h, :w] if output_mask.shape[1:] != (h, w) else output_mask
            selection_mask = selection_mask[:, :h, :w] if selection_mask.shape[1:] != (h, w) else selection_mask

        except Exception as e:
            print(f"Error loading image: {e}")
            return (output_image, output_mask, selection_mask, w, h)

        return (output_image, output_mask, selection_mask, w, h)

    @classmethod
    def IS_CHANGED(cls, ImageName):
        img = os.path.join(imgpath, ImageName + ".png")
        if not os.path.exists(img): return "File not found"
        
        with open(img, "rb") as f: img_hash = hashlib.sha256(f.read()).hexdigest()
        
        if ImageName == "MAIN DOC":
            sel = os.path.join(imgpath, "SELECTION.png")
            if os.path.exists(sel):
                with open(sel, "rb") as f: sel_hash = hashlib.sha256(f.read()).hexdigest()
                return hashlib.sha256((img_hash + sel_hash).encode()).hexdigest()
        return img_hash

#
# --- END OF THE BLOCK TO PASTE ---
#


class PsString:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"string": ("STRING", {"default": ""})}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = (" ",)
    FUNCTION = "exe"
    CATEGORY = "🔹BluePixel/ToolBar"

    def exe(self, string):
        if not string:
            string = ""
        return (string,)


class Floats:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"float_value": ("FLOAT", {"default": 1.0, "min": -1000.0, "max": 1000.0, "step": 0.01, "display": "number"})}}

    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = (" ",)
    FUNCTION = "calculate"
    CATEGORY = "🔹BluePixel/ToolBar"

    def calculate(self, float_value):
        return (float_value,)


class SeedManager:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "manual_seed": ("INT", {"default": 1379, "min": 0, "max": 999999, "step": 1, "display": "number"}),
                "random_seed": (["enable", "disable"], {"default": "disable"}),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = (" ",)
    FUNCTION = "manage_seed"

    CATEGORY = "🔹BluePixel/ToolBar"

    def manage_seed(self, manual_seed, random_seed):
        seed = max(0, min(manual_seed, 999999))
        return (seed,)


any = type("AnyType", (str,), {"__ne__": lambda s, v: False})("*")


class UERerouteNode:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"any": (any, {})}, "optional": {"I": (["*"], {"default": "*"})}}

    RETURN_TYPES = (any,)
    RETURN_NAMES = ("output",)
    FUNCTION = "reroute"
    CATEGORY = "🔹BluePixel/🛠️ Utils"

    @classmethod
    def VALIDATE_INPUTS(self, any, I):
        return True

    def reroute(self, any, I):
        return (any,)


NODE_CLASS_MAPPINGS = {
    "🔹SeedManager": SeedManager,
    "🔹Floats": Floats,
    "🔹ClipPass": ClipPass,
    "🔹modelPass": modelPass,
    "🔹Photoshop Images": PsImages,
    "🔹Photoshop Strings": PsString,
    "🔹Reroute - Anything Everywhere": UERerouteNode,
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "🔹SeedManager": "🔹PS Seed",
    "🔹Floats": "🔹PS Slider Float",
    "🔹ClipPass": "🔹Clip Pass",
    "🔹modelPass": "🔹Model Pass",
    "🔹Photoshop Images": "🔹PS Images",
    "🔹Photoshop Strings": "🔹PS Strings",
    "🔹Reroute - Anything Everywhere": "🔹Reroute - Anything Everywhere",
}
