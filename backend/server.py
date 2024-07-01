# backend/server.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import subprocess
import os

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

if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=5001)
