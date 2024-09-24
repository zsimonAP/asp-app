'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [scripts, setScripts] = useState([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [inputFields, setInputFields] = useState([]); // Store multiple input fields
  const [showInputFields, setShowInputFields] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [websocketPort, setWebsocketPort] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    let ipcRenderer;

    if (typeof window !== 'undefined' && window.require) {
      ipcRenderer = window.require('electron').ipcRenderer;

      // Listen for update events
      ipcRenderer.on('update-in-progress', () => {
        setUpdateMessage('Update in progress, please wait and follow the instructions to complete installation.');
      });

      ipcRenderer.on('update-ready', () => {
        setUpdateMessage('Update downloaded. The application will restart to complete the update.');
      });
    }

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

    // Cleanup WebSocket connection on component unmount
    return () => {
      if (websocket) {
        websocket.close();
      }
      if (ipcRenderer) {
        ipcRenderer.removeAllListeners('update-in-progress');
        ipcRenderer.removeAllListeners('update-ready');
      }
    };
  }, [websocket]);

  const handleInputSubmit = () => {
    if (!websocket) return;
    inputFields.forEach((field) => {
      websocket.send(field.value); // Send each input field value to the server
    });
    setShowInputFields(false);
  };

  const handleInputChange = (index, value) => {
    const newInputFields = [...inputFields];
    newInputFields[index].value = value;
    setInputFields(newInputFields); // Update state for specific input field
  };

  const runScript = (script) => {
    setSelectedScript(script);
    const ws = new WebSocket(`ws://localhost:${websocketPort}`);
    
    ws.onopen = () => {
        ws.send(script);
    };

    ws.onmessage = (event) => {
      const data = event.data;
  
      if (data.startsWith("WAIT_FOR_INPUT")) {
          // Extract the placeholder text dynamically from the WebSocket message
          const placeholderText = data.split(":")[1]?.trim() || "";  // Fallback if no placeholder provided
  
          const currentInputFields = [...inputFields];
  
          // Update input fields based on current length to avoid duplicate placeholders
          setInputFields([
              ...currentInputFields,  // Keep existing fields
              { placeholder: placeholderText, value: '' }  // Add the new input field with the dynamic placeholder
          ]);
  
          setShowInputFields(true);  // Show the input fields
      } else if (data === "SCRIPT_COMPLETED") {
          setShowInputFields(false);  // Hide input fields when the script is done
          setOutput('');
          setInputFields([]);  // Reset input fields after script completes
          setSelectedScript(null);
          ws.close();
      } else {
          setOutput((prevOutput) => prevOutput + '\n' + data);  // Append other output
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
  
  return (
    <div className="container mx-auto p-6 bg-blue-600 min-h-screen border-4 border-white">
      {updateMessage ? (
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold mb-6">{updateMessage}</h1>
        </div>
      ) : (
        <>
          <div className="text-center text-white">
            <h1 className="text-3xl font-bold mb-6">Associated Pension Automation Hub</h1>
            <p className="text-xl mb-4">Automate and run your Python scripts updated.</p>
          </div>
          {scripts.length > 0 ? (
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
          ) : (
            <p className="text-gray-200">No scripts found.</p>
          )}
          {showInputFields && (
            <div className="mt-6">
              {inputFields.map((field, index) => (
                <div className="flex mb-4" key={index}>
                  <input
                    type="text"
                    placeholder={field.placeholder}  // Set placeholder for the input field
                    value={field.value}  // Set value for the input field
                    onChange={(e) => handleInputChange(index, e.target.value)}  // Handle changes
                    className="border border-gray-300 p-2 rounded-l-lg flex-grow"
                  />
                </div>
              ))}
              <button
                onClick={handleInputSubmit}
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
        </>
      )}
    </div>
  );
}
