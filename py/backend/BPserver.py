import uuid
import logging
from aiohttp import web, WSMsgType
from server import PromptServer
from BPutils import LatestVer
from BPclient import ws_manager, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@PromptServer.instance.routes.get("/ps/ws")
async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    # Set a very high message size limit (e.g., 100 MB)
    ws = web.WebSocketResponse(max_msg_size=500 * 1024 * 1024)  # 500 MB
    await ws.prepare(request)

    client_id = request.query.get("clientId", str(uuid.uuid4()))
    platform = request.query.get("platform", "unknown")
    version = request.query.get("version", "unknown")
    
    # Get client IP address
    peername = request.transport.get_extra_info('peername')
    client_ip = peername[0] if peername else "unknown"
    
    # Store client with IP address
    ws_manager.clients[client_id] = Client(ws=ws, platform=platform, ip=client_ip)
    
    try:
        if platform == "ps":
            ws_manager.photoshop_users.append(client_id)
            logger.info(f"Photoshop client {client_id} connected from IP: {client_ip}")
            await ws_manager.send_message(ws_manager.photoshop_users, "latestVer", await LatestVer(version))
            
            # Notify only CM users with same IP
            cm_users_same_ip = [uid for uid in ws_manager.comfyui_users if uid in ws_manager.clients and ws_manager.clients[uid].ip == client_ip]
            await ws_manager.send_message(cm_users_same_ip, "psConnected")

        elif platform == "cm":
            ws_manager.comfyui_users.append(client_id)
            logger.info(f"ComfyUI client {client_id} connected from IP: {client_ip}")
            
            # Only notify PS users with same IP if any exist
            ps_users_same_ip = [uid for uid in ws_manager.photoshop_users if uid in ws_manager.clients and ws_manager.clients[uid].ip == client_ip]
            if ps_users_same_ip:
                await ws_manager.send_message([client_id], "psConnected")
                await ws_manager.send_message(ps_users_same_ip, "cmConnected")

        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                # message_size = len(msg.data)
                # logger.info(f"Received TEXT message from {client_id} with size: {message_size} bytes")
                await ws_manager.handle_client_message(client_id, platform, msg.data)

            elif msg.type == WSMsgType.BINARY:
                # message_size = len(msg.data)
                # logger.info(f"Received BINARY message from {client_id} with size: {message_size} bytes")
                await ws_manager.handle_client_message(client_id, platform, msg.data)

            elif msg.type == WSMsgType.ERROR:
                logger.error(f"WebSocket error from {client_id}: {ws.exception()}")
                break

    except Exception as e:
        logger.error(f"Error in websocket handler: {e}")

    finally:
        await ws_manager.handle_client_disconnect(client_id, platform)

    return ws