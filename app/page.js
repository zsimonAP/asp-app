'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [scripts, setScripts] = useState([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [websocketPort, setWebsocketPort] = useState(null);
  const [websocket, setWebsocket] = useState(null);

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
  }, []);

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
        // Reset state when script is done
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
    setWebsocket(ws);
  };

  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-blue-700 text-center">Python Automation Runner</h1>
      {scripts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {scripts.map((script) => (
            <button
              key={script}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md w-full"
              onClick={() => runScript(script)}
            >
              Run {script}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center">No scripts found.</p>
      )}
      {showUrlInput && (
        <div className="mt-6 flex flex-col sm:flex-row items-center">
          <input
            type="text"
            placeholder="Enter URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="border border-gray-300 p-2 rounded-lg flex-grow sm:mr-2 mb-2 sm:mb-0"
          />
          <button
            onClick={handleUrlSubmit}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-md"
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
