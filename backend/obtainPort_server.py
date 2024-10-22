import os
import json
import logging
import threading
import socket
import time
from flask import Flask, jsonify, request
from flask_cors import CORS

# Set up logging
logging.basicConfig(level=logging.INFO)

# Paths
FLASK_PORT_PATH = os.path.join(os.getenv('LOCALAPPDATA'), 'associated-pension-automation-hub', 'flask_port.json')

# Flask setup for the new server
app = Flask(__name__)
CORS(app)

# Ensure the directory for the Flask port JSON file exists
os.makedirs(os.path.dirname(FLASK_PORT_PATH), exist_ok=True)

@app.route('/get-flask-port', methods=['GET'])
def get_flask_port():
    try:
        # Load the Flask port from the flask_port.json file
        with open(FLASK_PORT_PATH, "r") as file:
            data = json.load(file)
        return jsonify({"port": data["port"]}), 200
    except FileNotFoundError:
        logging.error(f"Flask port file not found: {FLASK_PORT_PATH}")
        return jsonify({"error": "Flask port file not found"}), 404
    except Exception as e:
        logging.error(f"Error getting Flask port: {e}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/shutdown', methods=['POST'])
def shutdown():
    logging.info('Shutdown request received, stopping server...')
    shutdown_thread = threading.Thread(target=lambda: os._exit(0))  # Graceful exit
    shutdown_thread.start()
    return 'Server shutting down...', 200

# Function to check if a port is available
def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('0.0.0.0', port)) == 0

# Try to start the server on port 5000, retrying up to 15 times with a 2-second delay
def try_start_server():
    max_retries = 15
    retries = 0
    port = 5000
    while retries < max_retries:
        if not is_port_in_use(port):
            logging.info(f"Port {port} is available, starting the server...")
            app.run(debug=False, host='0.0.0.0', port=port)
            break
        else:
            logging.warning(f"Port {port} is in use. Retrying in 2 seconds... ({retries + 1}/{max_retries})")
            retries += 1
            time.sleep(2)
    if retries == max_retries:
        logging.error(f"Failed to start the server on port {port} after {max_retries} attempts.")
        os._exit(1)

if __name__ == "__main__":
    logging.info("Attempting to start obtainPort Flask server on port 5000...")
    try_start_server()
