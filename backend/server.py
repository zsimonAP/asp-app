import os
import sys
import logging
import json
import asyncio
import subprocess
import threading
import websockets
import tempfile
import socket
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.serving import make_server

# Set up logging
logging.basicConfig(level=logging.INFO)

# Flask setup
app = Flask(__name__)
CORS(app)

# Paths and configurations
LOCAL_APP_DATA = os.getenv('LOCALAPPDATA')
APP_DIR = os.path.join(LOCAL_APP_DATA, 'associated-pension-automation-hub')
SCRIPTS_DIR = os.path.join(APP_DIR, 'backend', 'scripts')
CONFIG_PATH = os.path.join(APP_DIR, 'config.json')

# Ensure the directory exists
os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)

# Hardcode the Python executable path
hardcoded_python_path = os.path.join(os.path.dirname(__file__), '..', 'env', 'python.exe')

if os.path.exists(hardcoded_python_path):
    logging.info(f"Overriding sys.executable to use the hardcoded path: {hardcoded_python_path}")
    sys.executable = hardcoded_python_path
else:
    logging.error(f"Hardcoded Python executable not found: {hardcoded_python_path}")

# Log paths and environment for debugging
logging.info(f"Using Python executable: {sys.executable}")
logging.info(f"sys.path: {sys.path}")
logging.info(f"Environment Variables: {json.dumps(dict(os.environ), indent=2)}")
logging.info(f"Scripts directory: {SCRIPTS_DIR}")

def write_config_value(key, value):
    config = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r') as file:
            config = json.load(file)
    config[key] = value
    with open(CONFIG_PATH, 'w') as file:
        json.dump(config, file)
    logging.info(f"{key} set to {value} in {CONFIG_PATH}")

def read_config_value(key):
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r') as file:
            config = json.load(file)
        return config.get(key)
    else:
        return None

@app.route('/list-folders', methods=['GET'])
def list_folders():
    try:
        folder_structure = {}
        # Walk through the scripts directory and collect folder and file info
        for root, dirs, files in os.walk(SCRIPTS_DIR):
            relative_root = os.path.relpath(root, SCRIPTS_DIR)
            if relative_root == ".":
                relative_root = ""
            folder_structure[relative_root] = [file for file in files if file.endswith('.py')]
        return jsonify(folder_structure), 200
    except Exception as e:
        logging.error(f"Error listing folders: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/list-scripts', methods=['GET'])
def list_scripts():
    try:
        scripts = []
        for root, _, files in os.walk(SCRIPTS_DIR):
            scripts.extend([os.path.relpath(os.path.join(root, file), SCRIPTS_DIR) for file in files if file.endswith('.py')])
        return jsonify({"scripts": scripts}), 200
    except Exception as e:
        logging.error(f"Error listing scripts: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-ports', methods=['GET'])
def get_ports():
    try:
        flask_port = read_config_value('flask_port')
        websocket_port = read_config_value('websocket_port')
        return jsonify({"flask_port": flask_port, "websocket_port": websocket_port}), 200
    except Exception as e:
        logging.error(f"Error getting ports: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/shutdown', methods=['POST'])
def shutdown():
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
    return 'Server shutting down...', 200

async def handler(websocket, path):
    try:
        script_name = await websocket.recv()  # This will now include the folder structure
        script_path = os.path.join(SCRIPTS_DIR, script_name)

        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Script not found: {script_path}")

        logging.info(f"Executing command: {[sys.executable, script_path]}")

        process = subprocess.Popen([sys.executable, script_path],
                                   stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE,
                                   text=True)

        while True:
            output = process.stdout.readline()

            if output:
                logging.info(f"Script output: {output.strip()}")
                await websocket.send(output.strip())

                if "WAIT_FOR_INPUT" in output:
                    user_input = await websocket.recv()
                    process.stdin.write(user_input + '\n')
                    process.stdin.flush()

                elif "WAIT_FOR_FILE_INPUT" in output:
                    file_content = await websocket.recv()

                    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as temp_file:
                        temp_file.write(file_content.encode())
                        temp_file_path = temp_file.name

                    logging.info(f"Temporary file created: {temp_file_path}")

                    process.stdin.write(temp_file_path + '\n')
                    process.stdin.flush()

            if output == '' and process.poll() is not None:
                break

        error = process.stderr.read()
        if error:
            await websocket.send(f"Error: {error.strip()}")

    except websockets.exceptions.ConnectionClosedError as e:
        logging.error(f"Connection closed with error: {e}")
    except Exception as e:
        logging.error(f"Handler exception: {e}")
        await websocket.send(f"Exception: {str(e)}")

def start_websocket_server():
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    start_server = websockets.serve(handler, "localhost", 0)  # Bind to an available port
    server = loop.run_until_complete(start_server)
    port = server.sockets[0].getsockname()[1]  # Get the port number assigned
    write_config_value('websocket_port', port)
    logging.info(f"WebSocket server started on port {port}")
    loop.run_forever()

def run_flask_server():
    server = make_server('0.0.0.0', 0, app)
    port = server.server_port
    logging.info(f"Assigned Flask port: {port}")
    write_config_value('flask_port', port)
    server.serve_forever()

if __name__ == "__main__":
    # Start the WebSocket server in a separate thread
    threading.Thread(target=start_websocket_server).start()

    logging.info("Starting Flask server...")
    # Start the Flask server in a separate thread
    threading.Thread(target=run_flask_server).start()
