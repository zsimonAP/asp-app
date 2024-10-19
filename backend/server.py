import os
import sys
import logging
import json
import asyncio
import subprocess
import threading
import websockets
import socket
from flask import Flask, jsonify, request
from flask_cors import CORS
import tempfile

# Set up logging
logging.basicConfig(level=logging.INFO)

# Flask setup
app = Flask(__name__)
CORS(app)

# Ensure the scripts directory path is correct
SCRIPTS_DIR = os.path.join(os.getenv('LOCALAPPDATA'), 'associated-pension-automation-hub', 'backend', 'scripts')
CONFIG_PATH = os.path.join(os.getenv('LOCALAPPDATA'), 'associated-pension-automation-hub', 'websocket_port.json')
PORT_JSON = os.path.join(os.getenv('LOCALAPPDATA'), 'associated-pension-automation-hub', 'flask_port.json')

# Ensure the directory exists
os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
os.makedirs(os.path.dirname(PORT_JSON), exist_ok=True)

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


@app.route('/get-websocket-port', methods=['GET'])
def get_websocket_port():
    try:
        with open(CONFIG_PATH, "r") as file:
            data = json.load(file)
        return jsonify({"port": data["port"]}), 200
    except Exception as e:
        logging.error(f"Error getting WebSocket port: {e}")
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


def find_available_port():
    """Find an available port by creating a socket and binding it to an open port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(('localhost', 0))  # Bind to any available port
        return sock.getsockname()[1]  # Return the port number
    
# Check if Flask port is already in use
def is_port_in_use(port):
    """Check if the given port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


# Function to check if Flask is already running
def check_existing_flask_server():
    """Check if there's an existing Flask server running on the port in flask_port.json."""
    if os.path.exists(PORT_JSON):
        with open(PORT_JSON, "r") as file:
            data = json.load(file)
            port = data.get("port")
            if port and is_port_in_use(port):
                logging.info(f"Flask server is already running on port {port}.")
                return True  # Flask server is already running
    return False

def write_port_to_file(port, path):
    """Write the given port to the specified JSON file."""
    with open(path, "w") as file:
        json.dump({"port": port}, file)
    logging.info(f"Port {port} written to {path}")


# Add a global flag to track the WebSocket server's state
websocket_server_started = False

def start_websocket_server():
    global websocket_server_started
    if websocket_server_started:
        logging.info("WebSocket server is already running. Not starting a new instance.")
        return

    try:
        asyncio.set_event_loop(asyncio.new_event_loop())
        loop = asyncio.get_event_loop()
        start_server = websockets.serve(handler, "localhost", 0)  # Bind to an available port
        server = loop.run_until_complete(start_server)
        port = server.sockets[0].getsockname()[1]  # Get the port number assigned
        write_port_to_file(port, CONFIG_PATH)  # Write WebSocket port to CONFIG_PATH
        logging.info(f"WebSocket server started on port {port}")
        websocket_server_started = True  # Set the flag to indicate the WebSocket server is running
        loop.run_forever()
    except Exception as e:
        logging.error(f"WebSocket server exception: {e}")
    finally:
        logging.info("Shutting down WebSocket server...")
        loop.stop()  # Gracefully stop the event loop
        loop.close()  # Close the event loop
        websocket_server_started = False  # Reset the flag when server is stopped

if __name__ == "__main__":
    # Ensure only one Flask server instance
    if threading.active_count() == 1:
        threading.Thread(target=start_websocket_server).start()

    # Check if the Flask server is already running
    if not check_existing_flask_server():
        # Find an available port for the Flask app
        available_flask_port = find_available_port()

        # Write to file with locking
        write_port_to_file(available_flask_port, PORT_JSON)

        # Start the Flask server on the available port
        logging.info(f"Starting Flask server on port {available_flask_port}...")
        logging.info(f"Using Python executable: {sys.executable}")
        logging.info(f"Scripts directory: {SCRIPTS_DIR}")
        
        # Start the Flask server without the reloader to avoid multiple instances
        app.run(debug=True, host='0.0.0.0', port=available_flask_port, use_reloader=False)
    else:
        logging.info("Flask server already running, not starting another instance.")
