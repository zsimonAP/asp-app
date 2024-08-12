import os
import logging
import json
import asyncio
import subprocess
import threading
import websockets
from flask import Flask, jsonify, request
from flask_cors import CORS

# Set up logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)

# Ensure the scripts directory path is correct
SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), 'scripts')
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'websocket_port.json')

# Path to the Python executable (use system's Python from PATH)
VENV_PYTHON_PATH = os.path.join(os.path.dirname(__file__), '..', 'env', 'Scripts', 'python.exe')

@app.route('/list-scripts', methods=['GET'])
def list_scripts():
    try:
        scripts = [f for f in os.listdir(SCRIPTS_DIR) if f.endswith('.py')]
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
        script_name = await websocket.recv()
        script_path = os.path.join(SCRIPTS_DIR, script_name)
        
        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Script not found: {script_path}")

        command = [VENV_PYTHON_PATH, script_path]
        logging.info(f"Executing command: {command}")
        
        process = subprocess.Popen(command,
                                   stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE,
                                   text=True)

        while True:
            output = process.stdout.readline()
            if "WAIT_FOR_INPUT" in output:
                await websocket.send("WAIT_FOR_INPUT")
                user_input = await websocket.recv()
                process.stdin.write(user_input + '\n')
                process.stdin.flush()
            if output == '' and process.poll() is not None:
                break
            await websocket.send(output.strip())
        
        error = process.stderr.read()
        if error:
            await websocket.send(error.strip())
        
    except websockets.exceptions.ConnectionClosedError as e:
        logging.error(f"Connection closed with error: {e}")
    except Exception as e:
        logging.error(f"Handler exception: {e}")
        await websocket.send(str(e))

def write_port_to_file(port):
    with open(CONFIG_PATH, "w") as file:
        json.dump({"port": port}, file)
    logging.info(f"WebSocket port {port} written to {CONFIG_PATH}")

def start_websocket_server():
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    start_server = websockets.serve(handler, "localhost", 0)  # Bind to an available port
    server = loop.run_until_complete(start_server)
    port = server.sockets[0].getsockname()[1]  # Get the port number assigned
    write_port_to_file(port)
    logging.info(f"WebSocket server started on port {port}")
    loop.run_forever()

if __name__ == "__main__":
    # Ensure only one WebSocket server instance
    if threading.active_count() == 1:
        threading.Thread(target=start_websocket_server).start()
    logging.info("Starting Flask server...")
    logging.info(f"Using Python executable: {VENV_PYTHON_PATH}")
    logging.info(f"Scripts directory: {SCRIPTS_DIR}")
    app.run(debug=True, host='0.0.0.0', port=5001)
