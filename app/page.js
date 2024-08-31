'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

let fs;
if (typeof window === 'undefined') {
  fs = require('fs'); // Only require fs when running on the server
}

export default function Home() {
  const [scripts, setScripts] = useState([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [websocketPort, setWebsocketPort] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const fetchScripts = async () => {
      try {
        const response = await axios.get('http://localhost:5001/list-scripts');
        setScripts(response.data.scripts);
      } catch (err) {
        setError('Failed to fetch scripts: ' + err.message);
      }
    };
    fetchScripts();

    const fetchWebSocketPort = async () => {
      try {
        const response = await axios.get('http://localhost:5001/get-websocket-port');
        setWebsocketPort(response.data.port);
      } catch (err) {
        setError('Failed to fetch WebSocket port: ' + err.message);
      }
    };
    fetchWebSocketPort();

    // Setup IPC listeners for update events
    ipcRenderer.on('update-available', () => {
      setUpdateAvailable(true);
    });

    ipcRenderer.on('update-ready', () => {
      setUpdateReady(true);
    });

    // Cleanup WebSocket connection and IPC listeners on component unmount
    return () => {
      if (websocket) {
        websocket.close();
      }
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('update-ready');
    };
  }, [websocket]);

  const handleUrlSubmit = () => {
    if (!url || !websocket) return;
    websocket.send(url);
    setShowUrlInput(false);
  };

  const runScript = (script) => {
    setSelectedScript(script);
    const ws = new WebSocket(`ws://localhost:${websocketPort}`);
    ws.onopen = () => {
      ws.send(script);
    };
    ws.onmessage = (event) => {
      if (event.data === "WAIT_FOR_INPUT") {
        setShowUrlInput(true);
      } else if (event.data === "SCRIPT_COMPLETED") {
        setShowUrlInput(false);
        setOutput('');
        setUrl('');
        setSelectedScript(null);
        ws.close();
      } else {
        setOutput(prevOutput => prevOutput + '\n' + event.data);
      }
    };
    ws.onerror = (event) => {
      setError('WebSocket error: ' + (event.message || 'Unknown error'));
    };
    ws.onclose = (event) => {
      if (!event.wasClean) {
        setError('WebSocket closed unexpectedly.');
      }
    };
    setWebsocket(ws);
  };

  const handleUpdateButtonClick = () => {
    ipcRenderer.send('start-update');
  };

  return (
    <div className="container mx-auto p-6 bg-blue-600 min-h-screen border-4 border-white relative">
      <div className="text-center text-white">
        <h1 className="text-3xl font-bold mb-6">Associated Pension Automation Hub</h1>
        <p className="text-xl mb-4">Automate and run your Python scripts with ease.</p>
      </div>

      {updateAvailable && !updateReady && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center">
          <div className="bg-yellow-100 text-yellow-900 p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-semibold mb-2">Update Available:</h2>
            <p>An update is available. Please do not close the app.</p>
          </div>
        </div>
      )}

      {updateReady && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center">
          <div className="bg-green-100 text-green-900 p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-semibold mb-2">Update Ready:</h2>
            <p>The update is ready to install. Click "Got it" to start the update.</p>
            <button
              onClick={handleUpdateButtonClick}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 mt-4 rounded-lg shadow-md"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {!updateAvailable && scripts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script) => (
            <button
              key={script}
              className="bg-white text-blue-600 hover:text-white hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg shadow-md"
              onClick={() => runScript(script)}
            >
              Run {script}
            </button>
          ))}
        </div>
      )}

      {showUrlInput && (
        <div className="mt-6 flex">
          <input
            type="text"
            placeholder="Enter URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="border border-gray-300 p-2 rounded-l-lg flex-grow"
          />
          <button
            onClick={handleUrlSubmit}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-r-lg shadow-md"
          >
            Submit
          </button>
        </div>
      )}

      {output && (
        <div className="mt-6 p-4 bg-blue-100 text-blue-900 rounded-lg shadow-inner">
          <h2 className="text-xl font-semibold mb-2">Output:</h2>
          <pre className="whitespace-pre-wrap">{output}</pre>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-100 text-red-900 rounded-lg shadow-inner">
          <h2 className="text-xl font-semibold mb-2">Error:</h2>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}
    </div>
  );
}
