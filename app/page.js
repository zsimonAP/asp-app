'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [folders, setFolders] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [output, setOutput] = useState(''); // Store progressively updated output
  const [error, setError] = useState('');
  const [inputFields, setInputFields] = useState([]); // Store multiple input fields
  const [fileInputFields, setFileInputFields] = useState([]); // Store multiple file input fields
  const [showInputFields, setShowInputFields] = useState(false);
  const [showFileInputFields, setShowFileInputFields] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [websocketPort, setWebsocketPort] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
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

    const fetchFolders = async () => {
      try {
        const response = await axios.get('http://localhost:5001/list-folders');
        setFolders(response.data.folders); // Folders fetched from backend
      } catch (err) {
        setError('Failed to fetch folders: ' + err.message);
      }
    };
    
    fetchFolders();

    const fetchWebSocketPort = async () => {
      try {
        const response = await axios.get('http://localhost:5001/get-websocket-port');
        setWebsocketPort(response.data.port);
      } catch (err) {
        setError('Failed to fetch WebSocket port: ' + err.message);
      }
    };

    fetchWebSocketPort();

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

  const handleFolderClick = async (folder) => {
    try {
      // Trigger the file download first
      const { success, message } = await window.electronAPI.invoke('download-files-from-folder', folder);
      if (success) {
        console.log(message);
        // Fetch the scripts after files are successfully downloaded
        const response = await axios.get(`http://localhost:5001/list-scripts?folder=${folder}`);
        setScripts(response.data.scripts);
        setSelectedFolder(folder);
      } else {
        console.error(message);
        setError('Failed to download scripts.');
      }
    } catch (err) {
      setError('Failed to fetch scripts: ' + err.message);
    }
  };  
  

  const handleInputSubmit = () => {
    if (!websocket) return;
    inputFields.forEach((field) => {
      websocket.send(field.value); // Send each input field value to the server
    });
    setShowInputFields(false);
  };

  const handleFileSubmit = () => {
    if (!websocket) return;

    fileInputFields.forEach((field) => {
      if (!field.file) return;

      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        const fileContent = e.target.result;
        websocket.send(fileContent); // Send the file content to the server as plain text
      };
      fileReader.readAsText(field.file); // Ensure reading file as text (CSV)
    });
    setShowFileInputFields(false);
  };

  const handleInputChange = (index, value) => {
    const newInputFields = [...inputFields];
    newInputFields[index].value = value;
    setInputFields(newInputFields); // Update state for specific input field
  };

  const handleFileChange = (index, file) => {
    const newFileInputFields = [...fileInputFields];
    newFileInputFields[index].file = file;
    setFileInputFields(newFileInputFields);
  };

  const runScript = (script) => {
    setSelectedScript(script);
    const ws = new WebSocket(`ws://localhost:${websocketPort}`);

    ws.onopen = () => {
      ws.send(`${selectedFolder}/${script}`); 
    };

    ws.onmessage = (event) => {
      const data = event.data;

      if (data.startsWith('WAIT_FOR_INPUT')) {
        const placeholderText = data.split(':')[1]?.trim() || '';

        setInputFields([
          ...inputFields, // Keep existing fields
          { placeholder: placeholderText, value: '' }, // Add the new input field with the dynamic placeholder
        ]);

        setShowInputFields(true); // Show the input fields
      } else if (data.startsWith('WAIT_FOR_FILE_INPUT')) {
        const placeholderText = data.split(':')[1]?.trim() || '';

        setFileInputFields([
          ...fileInputFields, // Keep existing fields
          { placeholder: placeholderText, file: null }, // Add the new file input field
        ]);

        setShowFileInputFields(true); // Show the file input fields
      } else if (data === 'SCRIPT_COMPLETED') {
        setShowInputFields(false); // Hide input fields when the script is done
        setShowFileInputFields(false); // Hide file input fields when the script is done
        setOutput(''); // Clear output after script completes
        setInputFields([]); // Reset input fields after script completes
        setFileInputFields([]); // Reset file input fields after script completes
        setSelectedScript(null);
        ws.close();
      } else {
        setOutput((prevOutput) => prevOutput + '\n' + data); // Append new output progressively
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
          </div>

          <div className="text-left text-white">
            {/* Directions for running scripts */}
            <div className="bg-gray-100 text-blue-900 p-4 rounded-lg shadow-inner">
              <h2 className="text-xl font-semibold mb-2">Instructions for Running Scripts:</h2>
              <ol className="list-decimal list-inside">
                <li className="mb-2">
                  <strong>Select a Script</strong>: Click on the button corresponding to the script you want to run.
                </li>
                <li className="mb-2">
                  <strong>Provide Input</strong>: If required, an input field will appear. Type your response in the field and press <strong>Submit</strong>.
                </li>
                <li className="mb-2">
                  <strong>View Output</strong>: The output of the script will be displayed below the script buttons where you can follow along with its progress.
                </li>
                <li className="mb-2">
                  <strong>Running Scripts</strong>: Only one script can be run at a time.
                </li>
                <li className="mb-2">
                  <strong>Handling Errors</strong>:
                  <ul className="list-disc list-inside ml-4">
                    <li>If an error occurs, wait for the output section to disappear before trying again.</li>
                    <li>Try running the script up to <strong>three times</strong>.</li>
                    <li>If the issue persists, please contact <strong>Zach Simon</strong> for assistance:</li>
                    <ul className="list-none ml-4">
                      <li><strong>Email</strong>: zsimon@associatedpension.com</li>
                      <li><strong>Phone</strong>: 631-223-9746</li>
                    </ul>
                  </ul>
                </li>
              </ol>
            </div>
          </div>

          <hr className="border-t-2 border-white my-6" />

          <div className="text-center text-white mb-4">
            <h2 className="text-2xl font-bold">Folders</h2>
          </div>

          {folders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <button
                  key={folder}
                  className="bg-white text-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg shadow-md"
                  onClick={() => handleFolderClick(folder)}
                >
                  {folder}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-200">No folders found.</p>
          )}

          {selectedFolder && (
            <>
              <div className="text-center text-white mb-4 mt-6">
              <h2 className="text-2xl font-bold">Scripts in &quot;{selectedFolder}&quot;</h2>

              </div>

              {scripts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scripts.map((script) => (
                    <button
                      key={script}
                      className="bg-white text-blue-600 hover:text-white hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg shadow-md"
                      onClick={() => runScript(script)}
                    >
                      {script.replace(/_/g, ' ').replace('.py', '')}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-200">No scripts found in this folder.</p>
              )}
            </>
          )}

          {showInputFields && (
            <div className="mt-6">
              {inputFields.map((field, index) => (
                <div className="flex mb-4" key={index}>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={field.value}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleInputSubmit();
                      }
                    }}
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

          {showFileInputFields && (
            <div className="mt-6">
              {fileInputFields.map((field, index) => (
                <div key={index} className="flex flex-col mb-4">
                  <div className="flex items-center">
                    <label className="bg-white hover:bg-blue-700 text-blue-600 px-4 py-2 rounded-lg cursor-pointer mr-4">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileChange(index, e.target.files[0])}
                        className="hidden"
                      />
                      Upload File
                    </label>
                    <div className="rounded-lg border-2 border-white p-2 bg-blue-600 flex-grow">
                      <span className="text-white">
                        {field.file ? field.file.name : 'No file selected'}
                      </span>
                    </div>
                  </div>
                  {field.file && (
                    <button
                      onClick={handleFileSubmit}
                      className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-md"
                    >
                      Submit File
                    </button>
                  )}
                </div>
              ))}
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
