from nodes import SaveImage
import asyncio
import os
import torch
import folder_paths
import torch.nn.functional as F
import aiohttp


nodepath = os.path.join(folder_paths.get_folder_paths("custom_nodes")[0], "comfyui-photoshop")
imgpath = os.path.join(nodepath, "data", "ps_inputs", "imgs")


class PhotoshopToComfyUI:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ("IMAGE", "MASK", "FLOAT", "INT", "STRING", "STRING", "INT", "INT")
    RETURN_NAMES = ("Canvas", "Mask", "Slider", "Seed", "+", "-", "W", "H")
    FUNCTION = "PS_Execute"
    CATEGORY = "🔹BluePixel"

    def PS_Execute(self):
        canvas = torch.zeros((1, 24, 24, 3), dtype=torch.float32)
        selection = torch.ones((1, 24, 24), dtype=torch.float32)
        return (canvas, selection, 0.5, 404, "Please Upgrade to V2 Nodes", "Please Upgrade to V2 Nodes", 404, 404)


class ComfyUIToPhotoshop(SaveImage):
    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"
        self.prefix_append = "_temp_"
        self.compress_level = 4

    @staticmethod
    def INPUT_TYPES():
        return {
            "required": {"RGB": ("IMAGE",)},
            "optional": {"ALPHA": ("MASK",), "cmUID": ("STRING", {"default": ""})},
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    FUNCTION = "execute"
    CATEGORY = "🔹BluePixel"

    # --- FIX 1: Changed from "def" to "async def" ---
    async def execute(self, RGB: torch.Tensor, ALPHA: torch.Tensor = None, filename_prefix="PS_OUTPUTS", prompt=None, extra_pnginfo=None, cmUID: str = ""):
        from BPutils import send_images_to_photoshop

        # --- Image saving logic (unchanged) ---
        RGB_output = RGB.clone()
        if ALPHA is not None:
            rgb_batch_size = RGB.shape[0]
            alpha_batch_size = ALPHA.shape[0] if ALPHA.dim() >= 3 else 1
            processed_alpha = []
            for i in range(rgb_batch_size):
                alpha_idx = min(i, alpha_batch_size - 1)
                current_alpha = ALPHA[alpha_idx] if ALPHA.dim() >= 3 else ALPHA
                if current_alpha.dim() == 2: pass
                elif current_alpha.dim() == 3 and current_alpha.shape[0] == 1: current_alpha = current_alpha.squeeze(0)
                if current_alpha.shape != RGB[i].shape[:2]:
                    current_alpha = current_alpha.unsqueeze(0).unsqueeze(0)
                    current_alpha = F.interpolate(current_alpha, size=(RGB[i].shape[0], RGB[i].shape[1]), mode="bilinear", align_corners=False)
                    current_alpha = current_alpha.squeeze(0).squeeze(0)
                processed_alpha.append(current_alpha)
            processed_alpha = torch.stack(processed_alpha)
            processed_alpha = processed_alpha.unsqueeze(-1)
            RGB_with_alpha = torch.cat((RGB, processed_alpha), dim=-1)
            x = self.save_images(RGB_with_alpha, filename_prefix, prompt, extra_pnginfo)
        else:
            x = self.save_images(RGB_output, filename_prefix, prompt, extra_pnginfo)

        try:
            filenames = [img["filename"] for img in x["ui"]["images"]]
            if filenames:
                # --- FIX 2: Changed from "loop.create_task" to "await" ---
                await send_images_to_photoshop(filenames, self.output_dir)
            else:
                print("# PS (Direct Call): Warning - No filenames extracted, nothing to send.")
        except Exception as e:
            print(f"# PS (Direct Call): Error during direct call schedule: {e}")

        return x


NODE_CLASS_MAPPINGS = {"🔹Photoshop ComfyUI Plugin": PhotoshopToComfyUI, "🔹SendTo Photoshop Plugin": ComfyUIToPhotoshop}

NODE_DISPLAY_NAME_MAPPINGS = {"🔹Photoshop ComfyUI Plugin": "🔹PS (V1 Method)", "🔹SendTo Photoshop Plugin": "🔹Send to PS"}
