# backend/server.py

from flask import Flask, jsonify, request
from flask_cors import CORS
import subprocess
import os
import threading
import asyncio
import websockets
import socket
import json

app = Flask(__name__)
CORS(app)

SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), 'scripts')

@app.route('/list-scripts', methods=['GET'])
def list_scripts():
    try:
        scripts = [f for f in os.listdir(SCRIPTS_DIR) if f.endswith('.py')]
        return jsonify({"scripts": scripts}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/run-script', methods=['POST'])
def run_script():
    try:
        script_name = request.json.get('script')
        script_path = os.path.join(SCRIPTS_DIR, script_name)
        if not os.path.isfile(script_path):
            return jsonify({"error": "Script not found"}), 404

        result = subprocess.run(['python', script_path], capture_output=True, text=True)
        return jsonify({"output": result.stdout.strip(), "error": result.stderr.strip()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get-websocket-port', methods=['GET'])
def get_websocket_port():
    try:
        with open("websocket_port.json", "r") as file:
            data = json.load(file)
        return jsonify({"port": data["port"]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

async def handler(websocket, path):
    try:
        message = await websocket.recv()
        script_name, url = message.split(',')
        script_path = os.path.join(SCRIPTS_DIR, script_name)
        result = subprocess.run(['python', script_path, url], capture_output=True, text=True)
        await websocket.send(result.stdout.strip())
    except Exception as e:
        await websocket.send(str(e))

def write_port_to_file(port):
    with open("websocket_port.json", "w") as file:
        json.dump({"port": port}, file)

def start_websocket_server():
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    start_server = websockets.serve(handler, "localhost", 0)  # Bind to an available port
    server = loop.run_until_complete(start_server)
    port = server.sockets[0].getsockname()[1]  # Get the port number assigned
    write_port_to_file(port)
    print(f"WebSocket server started on port {port}")
    loop.run_forever()

if __name__ == "__main__":
    threading.Thread(target=start_websocket_server).start()
    print("Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=5001)
