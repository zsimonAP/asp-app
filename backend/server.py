import os
import sys
import logging
import json
import asyncio
import subprocess
import threading
import websockets
from flask import Flask, jsonify, request
from flask_cors import CORS
import tempfile
import random

# Set up logging
logging.basicConfig(level=logging.INFO)

# Paths
SCRIPTS_DIR = os.path.join(os.getenv('LOCALAPPDATA'), 'associated-pension-automation-hub', 'backend', 'scripts')
CONFIG_PATH = os.path.join(os.getenv('LOCALAPPDATA'), 'associated-pension-automation-hub', 'websocket_port.json')
FLASK_PORT_PATH = os.path.join(os.getenv('LOCALAPPDATA'), 'associated-pension-automation-hub', 'flask_port.json')

# Ensure the directory exists
os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
os.makedirs(os.path.dirname(FLASK_PORT_PATH), exist_ok=True)

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

# Flask setup (for dynamic port)
app_dynamic = Flask(__name__)
CORS(app_dynamic)

# Flask setup (for port 5001)
app_fixed = Flask(__name__)
CORS(app_fixed)

# Create dynamic port for second Flask server
def get_available_port():
    while True:
        port = random.randint(5002, 6000)  # Choose a port in this range
        with open(FLASK_PORT_PATH, "w") as f:
            json.dump({"port": port}, f)
        logging.info(f"Dynamic Flask server will run on port {port}")  # Debugging log for dynamic port
        return port

# Flask instance on the dynamic port (all processes)
@app_dynamic.route('/list-folders', methods=['GET'])
def list_folders():
    try:
        folder_structure = {}
        for root, dirs, files in os.walk(SCRIPTS_DIR):
            relative_root = os.path.relpath(root, SCRIPTS_DIR)
            if relative_root == ".":
                relative_root = ""
            folder_structure[relative_root] = [file for file in files if file.endswith('.py')]
        return jsonify(folder_structure), 200
    except Exception as e:
        logging.error(f"Error listing folders: {e}")
        return jsonify({"error": str(e)}), 500


@app_dynamic.route('/list-scripts', methods=['GET'])
def list_scripts():
    try:
        scripts = []
        for root, _, files in os.walk(SCRIPTS_DIR):
            scripts.extend([os.path.relpath(os.path.join(root, file), SCRIPTS_DIR) for file in files if file.endswith('.py')])
        return jsonify({"scripts": scripts}), 200
    except Exception as e:
        logging.error(f"Error listing scripts: {e}")
        return jsonify({"error": str(e)}), 500


@app_dynamic.route('/get-websocket-port', methods=['GET'])
def get_websocket_port():
    try:
        with open(CONFIG_PATH, "r") as file:
            data = json.load(file)
        return jsonify({"port": data["port"]}), 200
    except Exception as e:
        logging.error(f"Error getting WebSocket port: {e}")
        return jsonify({"error": str(e)}), 500


@app_dynamic.route('/shutdown', methods=['POST'])
def shutdown():
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
    return 'Server shutting down...', 200


# New route to return the dynamic Flask port
@app_fixed.route('/get-flask-port', methods=['GET'])
def get_flask_port():
    try:
        with open(FLASK_PORT_PATH, "r") as file:
            data = json.load(file)
        return jsonify({"port": data["port"]}), 200
    except Exception as e:
        logging.error(f"Error getting Flask port: {e}")
        return jsonify({"error": str(e)}), 500


# Start Flask on port 5001 (minimal status endpoint)
@app_fixed.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "Running on port 5001, but no operations here."}), 200


# WebSocket handler
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


# Write WebSocket port to file
def write_port_to_file(port):
    try:
        with open(CONFIG_PATH, "w") as file:
            json.dump({"port": port}, file)
        logging.info(f"WebSocket port {port} written to {CONFIG_PATH}")
    except Exception as e:
        logging.error(f"Failed to write WebSocket port to {CONFIG_PATH}: {e}")


# Start WebSocket server
def start_websocket_server():
    try:
        asyncio.set_event_loop(asyncio.new_event_loop())
        loop = asyncio.get_event_loop()
        start_server = websockets.serve(handler, "localhost", 0)  # Bind to an available port
        server = loop.run_until_complete(start_server)
        port = server.sockets[0].getsockname()[1]  # Get the port number assigned
        write_port_to_file(port)  # Ensure the port is written to the JSON file
        logging.info(f"WebSocket server started on port {port}")
        loop.run_forever()
    except Exception as e:
        logging.error(f"Failed to start WebSocket server: {e}")


def run_flask_fixed():
    logging.info("Starting Flask server on port 5001...")
    app_fixed.run(debug=False, host='0.0.0.0', port=5001)


def run_flask_dynamic():
    available_port = get_available_port()
    logging.info(f"Starting Flask server on dynamic port {available_port}...")
    app_dynamic.run(debug=False, host='0.0.0.0', port=available_port)


if __name__ == "__main__":
    # Start the fixed Flask server in one thread
    fixed_flask_thread = threading.Thread(target=run_flask_fixed)
    fixed_flask_thread.start()
    
    # Start the dynamic Flask server in another thread
    dynamic_flask_thread = threading.Thread(target=run_flask_dynamic)
    dynamic_flask_thread.start()
    
    # Start the WebSocket server after the Flask servers
    logging.info("Starting WebSocket server...")
    websocket_thread = threading.Thread(target=start_websocket_server)
    websocket_thread.start()

    # Join threads to ensure they run properly and capture any issues
    fixed_flask_thread.join()
    dynamic_flask_thread.join()
    websocket_thread.join()

