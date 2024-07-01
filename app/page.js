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

  useEffect(() => {
    const fetchScripts = async () => {
      try {
        const response = await axios.get('http://localhost:5001/list-scripts');
        console.log('Scripts fetched:', response.data.scripts);
        setScripts(response.data.scripts);
      } catch (err) {
        console.error('Failed to fetch scripts:', err);
        setError('Failed to fetch scripts: ' + err.message);
      }
    };
    fetchScripts();

    const fetchWebSocketPort = async () => {
      try {
        const response = await axios.get('http://localhost:5001/get-websocket-port');
        setWebsocketPort(response.data.port);
      } catch (err) {
        console.error('Failed to fetch WebSocket port:', err);
        setError('Failed to fetch WebSocket port: ' + err.message);
      }
    };
    fetchWebSocketPort();
  }, []);

  const handleUrlSubmit = async () => {
    if (!url || !selectedScript || !websocketPort) return;
    try {
      const websocket = new WebSocket(`ws://localhost:${websocketPort}`);
      websocket.onopen = () => {
        websocket.send(`${selectedScript},${url}`);
      };
      websocket.onmessage = (event) => {
        setOutput(event.data);
        setShowUrlInput(false);
        setError('');
      };
      websocket.onerror = (event) => {
        console.error('WebSocket error:', event);  // Add this line
        setError('WebSocket error: ' + (event.message || 'Unknown error'));
      };
    } catch (err) {
      console.error('Error running script:', err);
      setError('Error in setting up the request: ' + err.message);
      setOutput('');
    }
  };

  const runScript = (script) => {
    setSelectedScript(script);
    setShowUrlInput(true);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Python Automation Runner</h1>
      {scripts.length > 0 ? (
        scripts.map((script) => (
          <button
            key={script}
            className="bg-blue-500 text-white px-4 py-2 rounded m-2"
            onClick={() => runScript(script)}
          >
            Run {script}
          </button>
        ))
      ) : (
        <p>No scripts found.</p>
      )}
      {showUrlInput && (
        <div className="mt-4">
          <input
            type="text"
            placeholder="Enter URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="border p-2 rounded"
          />
          <button
            onClick={handleUrlSubmit}
            className="bg-green-500 text-white px-4 py-2 rounded ml-2"
          >
            Submit
          </button>
        </div>
      )}
      {output && (
        <div className="mt-4 p-2 bg-green-200 text-green-800 rounded">
          <h2 className="text-lg font-semibold">Output:</h2>
          <p>{output}</p>
        </div>
      )}
      {error && (
        <div className="mt-4 p-2 bg-red-200 text-red-800 rounded">
          <h2 className="text-lg font-semibold">Error:</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
