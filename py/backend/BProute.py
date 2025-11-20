import base64
import ipaddress
import logging
import aiofiles
from aiohttp import web
import folder_paths
from server import PromptServer
import os
from BPutils import dirs
from urllib.parse import urlparse
import re
from BPclient import ws_manager
import io
from PIL import Image

# from BPclient import user_manager


# region Routes
@PromptServer.instance.routes.get("/ps/workflows/{name:.+}")
async def get_workflow(request):
    file = os.path.abspath(os.path.join(dirs.workflow, request.match_info["name"] + ".json"))
    if os.path.commonpath([file, dirs.workflow]) != dirs.workflow:
        return web.Response(status=403)
    return web.FileResponse(file)


@PromptServer.instance.routes.get("/ps/inputs/{filename}")
async def get_input(request):
    file = os.path.abspath(os.path.join(dirs.psimg, request.match_info["filename"]))
    if os.path.commonpath([file, dirs.psimg]) != dirs.psimg:
        return web.Response(status=403)
    return web.FileResponse(file)


@PromptServer.instance.routes.get("/ps/error.png")
async def get_error_image(request):
    file_path = os.path.join(dirs.psinput, "NoImage.png")
    absolute_path = os.path.abspath(file_path)
    if os.path.commonpath([absolute_path, dirs.psinput]) != dirs.psinput:
        return web.Response(status=403)
    return web.FileResponse(absolute_path)


@PromptServer.instance.routes.get("/ps/renderbatch")
async def handle_render_batch(request):
    print("\n# ---- PS Bridge: Received request to send image to Photoshop ----")
    try:
        cmUID = request.rel_url.query.get("cmUID", "")
        filenames_param = request.rel_url.query.get("filenames", "")
        filenames = filenames_param.split(",")

        print(f"# PS Bridge: Filenames to process: {filenames}")

        if not filenames or filenames[0] == "":
            print("# PS Bridge: Error - No filenames provided in the request.")
            return web.Response(text="No filenames provided", status=400)

        temp_dir = folder_paths.get_temp_directory()
        batch_results = []

        for filename in filenames:
            try:
                filepath = os.path.join(temp_dir, filename)
                print(f"# PS Bridge: Checking for file at: {filepath}")
                if not os.path.exists(filepath):
                    print(f"# PS Bridge: Error - File not found: {filename}")
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
                print(f"# PS Bridge: Successfully processed file: {filename}")

            except Exception as e:
                print(f"# PS Bridge: Error processing file {filename}: {e}")

        print("# PS Bridge: Preparing to send data via WebSocket...")
        print(f"# PS Bridge: Number of connected Photoshop clients: {len(ws_manager.photoshop_users)}")
        print(f"# PS Bridge: List of Photoshop client IDs: {ws_manager.photoshop_users}")

        if batch_results:
            if ws_manager.photoshop_users:
                await ws_manager.send_message(ws_manager.photoshop_users, "render_batch", batch_results)
                print(f"# PS Bridge: SUCCESS - Sent batch of {len(filenames)} images to {len(ws_manager.photoshop_users)} PS client(s).")
            else:
                print("# PS Bridge: FAILED - No Photoshop clients are currently connected to receive the image.")
        else:
            print("# PS Bridge: FAILED - No images were successfully processed to be sent.")

    except Exception as e:
        print(f"# PS Bridge: A critical error occurred in handle_render_batch: {e}")
        return web.Response(text=f"Error: {e}", status=500)

    print("# ---- PS Bridge: Request finished. ----\n")
    return web.Response(text=f"Batch of {len(filenames)} images sent to ps with cmUID: {cmUID}")

@PromptServer.instance.routes.get("/ps/icons/{filename}.svg")
async def get_logo(request):
    filename = request.match_info["filename"] + ".svg"
    file = os.path.abspath(os.path.join(dirs.node, "data", "comfyIcons", filename))
    if os.path.commonpath([file, dirs.node]) != dirs.node:
        return web.Response(status=403)
    return web.FileResponse(file)


@PromptServer.instance.routes.get("/ps/bluepixel/css.css")
async def get_css(request):
    file_path = os.path.realpath(os.path.join(dirs.node, "js", "css.css"))
    if not file_path.startswith(os.path.realpath(dirs.node)):
        return web.Response(status=403)
    return web.FileResponse(file_path)


from aiohttp import web, ClientSession
import ipaddress
from urllib.parse import urlparse
import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Allowed domains patterns
ALLOWED_DOMAINS = [r".*\.googleapis\.com", r".*\.firebaseio\.com", r".*\.cloudfunctions\.net", r".*\.google-analytics\.com"]


async def proxy_handler(request):
    client_ip = request.remote
    if not is_local_ip(client_ip):
        return web.Response(status=403, text="Access denied: Local network only")

    # 2. Get target URL and verify it's allowed
    target_url = request.headers.get("url")
    if not target_url or not is_allowed_domain(target_url):
        return web.Response(status=403, text="Invalid or forbidden URL")

    # 3. Get HTTP method
    method = request.headers.get("method", "GET").upper()
    if method not in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
        return web.Response(status=400, text="Invalid HTTP method")

    try:
        # 4. Forward the request
        data = await request.json() if request.body_exists else None
        async with ClientSession() as session:
            async with session.request(method, target_url, json=data) as response:
                result = await response.json()
                return web.json_response(result, status=response.status)
    except Exception as e:
        logger.error(f"Proxy error: {str(e)}")
        return web.Response(status=500, text=str(e))


def is_local_ip(ip):
    try:
        ip_addr = ipaddress.ip_address(ip)
        local_networks = [
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
            ipaddress.ip_network("192.168.0.0/16"),
            ipaddress.ip_network("127.0.0.0/8"),
        ]
        return any(ip_addr in network for network in local_networks)
    except ValueError:
        return False


def is_allowed_domain(url):
    try:
        domain = urlparse(url).netloc
        return any(re.match(pattern, domain) for pattern in ALLOWED_DOMAINS)
    except Exception:
        return False


@PromptServer.instance.routes.post("/ps/auth/proxy")
async def handle_proxy(request):
    return await proxy_handler(request)
