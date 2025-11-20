import importlib
import os
import sys
import folder_paths
import logging
import subprocess
import re

nodefolder = os.path.join(folder_paths.get_folder_paths("custom_nodes")[0], "comfyui-photoshop")
py = os.path.join(nodefolder, "py")
backend_path = os.path.join(py, "backend")
nodes = os.path.join(py, "nodes")

node_list = ["nodePlugin", "nodeOther", "nodeRemoteConnection"]
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def install_dependencies():
    req_file = os.path.join(nodefolder, "requirements.txt")
    if not os.path.exists(req_file):
        logging.warning(f"Requirements file not found: {req_file}")
        return

    with open(req_file) as f:
        required = [re.split(r'[<>=]', line.strip())[0] for line in f if line.strip()]

    installed = subprocess.check_output([sys.executable, '-m', 'pip', 'freeze']).decode().splitlines()
    installed = [pkg.split('==')[0].lower() for pkg in installed]

    missing = [pkg for pkg in required if pkg.lower() not in installed]
    if not missing:
        logging.info("All dependencies are already installed")
        return

    logging.info(f"Installing missing packages: {', '.join(missing)}")
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', *missing])
        logging.info("Packages installed successfully")
    except subprocess.CalledProcessError as e:
        logging.error(f"Installation failed: {e}")

install_dependencies()

for module_name in node_list:
    spec = importlib.util.spec_from_file_location(module_name, os.path.join(nodes, f"{module_name}.py"))
    imported_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(imported_module)
    NODE_CLASS_MAPPINGS.update(imported_module.NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(imported_module.NODE_DISPLAY_NAME_MAPPINGS)

if backend_path not in sys.path:
    sys.path.append(backend_path)


def load_module(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, os.path.join(backend_path, file_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# بارگذاری ماژول‌ها
server_module_1 = load_module("BluePixelServer", "BPserver.py")
server_module_2 = load_module("BluePixelRoutes", "BProute.py")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
WEB_DIRECTORY = "js"
