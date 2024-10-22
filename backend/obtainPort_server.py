import os
import json
import logging
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
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
    return 'Server shutting down...', 200

if __name__ == "__main__":
    logging.info("Starting obtainPort Flask server on port 5000...")
    app.run(debug=False, host='0.0.0.0', port=5000)
