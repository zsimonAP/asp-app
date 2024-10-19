'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [scripts, setScripts] = useState([]); // To hold scripts (if needed)
  const [output, setOutput] = useState(''); // Store progressively updated output
  const [error, setError] = useState(''); // Store error messages
  const [inputFields, setInputFields] = useState([]); // Store multiple input fields
  const [fileInputFields, setFileInputFields] = useState([]); // Store multiple file input fields
  const [showInputFields, setShowInputFields] = useState(false); // To show input fields when necessary
  const [showFileInputFields, setShowFileInputFields] = useState(false); // To show file input fields
  const [selectedScript, setSelectedScript] = useState(null); // Currently selected script
  const [websocketPort, setWebsocketPort] = useState(null); // Holds WebSocket port
  const [websocket, setWebsocket] = useState(null); // Active WebSocket connection
  const [updateMessage, setUpdateMessage] = useState(''); // Store update messages
  const [folderStructure, setFolderStructure] = useState({}); // Holds folder structure
  const [selectedFolder, setSelectedFolder] = useState(null); // Currently selected folder
  const [isScriptRunning, setIsScriptRunning] = useState(false);  // New state to track if a script is running


  useEffect(() => {
    let ipcRenderer;

    if (typeof window !== 'undefined' && window.require) {
      ipcRenderer = window.require('electron').ipcRenderer;

      ipcRenderer.on('flask-port', (event, port) => {
        console.log('Received Flask port:', port);
        setWebsocketPort(port); // Set the received port into state
      });

      // Listen for update events
      ipcRenderer.on('update-in-progress', () => {
        setUpdateMessage('Update in progress, please wait and follow the instructions to complete installation.');
      });

      ipcRenderer.on('update-ready', () => {
        setUpdateMessage('Update downloaded. The application will restart to complete the update.');
      });

      ipcRenderer.on('folder-structure', (event, folderStructure) => {
        console.log('Received folder structure:', folderStructure); // Log folder structure received
        setFolderStructure(folderStructure);  // Store folder structure in state
      });
    }
    const fetchFolders = async () => {
      try {
        const response = await axios.get(`http://localhost:${flaskPort}/list-folders`);
        const filteredFolders = Object.fromEntries(
          Object.entries(response.data).filter(([key]) => key.trim() !== '')
        );
        console.log('Filtered folder structure:', filteredFolders); // Log folder structure
        setFolderStructure(filteredFolders); // Set the folder structure from Flask without blank folders
      } catch (err) {
        setError('Failed to fetch folder structure: ' + err.message);
      }
    };
    fetchFolders();

    const fetchScripts = async () => {
      try {
        const response = await axios.get(`http://localhost:${flaskPort}/list-scripts`);
        setScripts(response.data.scripts);
      } catch (err) {
        setError('Failed to fetch scripts: ' + err.message);
      }
    };    
    fetchScripts();

    const fetchWebSocketPort = async () => {
      try {
        const response = await axios.get(`http://localhost:${flaskPort}/get-websocket-port`);
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

  // Handle folder click to display scripts within that folder
  const handleFolderClick = (folder) => {
    console.log(`User clicked on folder: ${folder}`); // Log when a folder is clicked
    setSelectedFolder(folder);  // Set the selected folder when clicked
  };

  // Handle script click
  const handleScriptClick = (script) => {
    if (isScriptRunning) return;
    console.log(`Running script: ${script}`); // Log when a script is clicked to be run
    runScript(`${selectedFolder}/${script}`);  // Send the folder and script name
  };


  // Handle input submit
  const handleInputSubmit = () => {
    if (!websocket) return;
    inputFields.forEach((field) => {
      websocket.send(field.value); // Send each input field value to the server
    });
    setShowInputFields(false);
  };

  // Handle file submit
  const handleFileSubmit = () => {
    if (!websocket) return;

    fileInputFields.forEach((field) => {
      if (!field.file) return;
      
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        const fileContent = e.target.result;
        websocket.send(fileContent);  // Send the file content to the server as plain text
      };
      fileReader.readAsText(field.file);  // Ensure reading file as text (CSV)
    });
    setShowFileInputFields(false);
  };

  // Handle input change for text fields
  const handleInputChange = (index, value) => {
    const newInputFields = [...inputFields];
    newInputFields[index].value = value;
    setInputFields(newInputFields); // Update state for specific input field
  };

  // Handle file change
  const handleFileChange = (index, file) => {
    const newFileInputFields = [...fileInputFields];
    newFileInputFields[index].file = file;
    setFileInputFields(newFileInputFields);
  };

  // Run a script
  const runScript = (script) => {
    setIsScriptRunning(true);
    setSelectedScript(script);
    const ws = new WebSocket(`ws://localhost:${websocketPort}`);
  
    ws.onopen = () => {
      ws.send(script);  // Send the full path including folder and script
    };
  
    ws.onmessage = (event) => {
      const data = event.data;
  
      if (data.startsWith('WAIT_FOR_INPUT')) {
        const placeholderText = data.split(':')[1]?.trim() || '';
  
        const currentInputFields = [...inputFields];
  
        setInputFields([
          ...currentInputFields,  // Keep existing fields
          { placeholder: placeholderText, value: '' },  // Add new input field
        ]);
  
        setShowInputFields(true);  // Show the input fields
      } else if (data.startsWith('WAIT_FOR_FILE_INPUT')) {
        const placeholderText = data.split(':')[1]?.trim() || '';
  
        const currentFileInputFields = [...fileInputFields];
  
        setFileInputFields([
          ...currentFileInputFields,  // Keep existing fields
          { placeholder: placeholderText, file: null },  // Add new file input field
        ]);
  
        setShowFileInputFields(true);  // Show the file input fields
      } else if (data === 'SCRIPT_COMPLETED') {
        setShowInputFields(false);
        setShowFileInputFields(false);
        setOutput('');  // Clear output after script completes
        setInputFields([]);
        setFileInputFields([]);
        setSelectedScript(null);
        setIsScriptRunning(false);
        ws.close();
      } else {
        setOutput((prevOutput) => prevOutput + '\n' + data);  // Append new output progressively
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
    <div className="min-h-screen flex flex-col p-6 bg-blue-600 border-4 border-white">
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
                  <strong>Select a Script</strong>: Open the folder and click on the button corresponding to the script you want to run.
                </li>
                <li className="mb-2">
                  <strong>Provide Input</strong>: If required, an input field will appear. Type your response in the field, or select a file, and press <strong>Submit</strong>.
                </li>
                <li className="mb-2">
                  <strong>View Output</strong>: The output of the script will be displayed below the script buttons where you can follow along with its progress.
                </li>
                <li className="mb-2">
                  <strong>Running Scripts</strong>: Only one script can be run at a time.
                </li>
                <li className="mb-2">
                  <strong>Troubleshooting</strong>:
                  <ul className="list-disc list-inside ml-4">
                    <li>If an error occurs, wait for the output section to disappear before trying again.</li>
                    <li>If you type an input in wrong and another input box <strong>DOES NOT</strong> appear, close the Edge window and wait for the output section to disappear</li>
                    <li>If the website for the script you are running does not do the intended task, close the Edge browser and try again</li>
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

          {/* White line separating instructions and "Scripts" */}
          <hr className="border-t-2 border-white my-6" />

        {selectedFolder ? (
          <>
            <div className="text-center text-white mb-4">
              <h2 className="text-4xl font-extrabold flex items-center justify-center space-x-3">
                <span className="text-5xl">📁</span> {/* Folder icon */}
                <span>{selectedFolder} Scripts</span>
              </h2>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folderStructure[selectedFolder].map((script) => (
                <button
                  key={script}
                  className="bg-yellow-100 text-black hover:bg-yellow-400 font-semibold py-2 px-4 rounded-lg shadow-md flex items-center space-x-4"
                  onClick={() => handleScriptClick(script)}
                  disabled={isScriptRunning}
                >
                  <div className="text-4xl">
                    📝 {/* Notepad icon */}
                  </div>
                  <div className="text-xl">
                    {script.replace('.py', '').replace(/_/g, ' ')}
                  </div>
                </button>
              ))}
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => {
                  console.log('User navigated back to folders view');
                  setSelectedFolder(null); // Log when user navigates back to the folder view
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md"
              >
                Back to Folders
              </button>
            </div>
          </>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(folderStructure).map((folder) => (
                <button
                  key={folder}
                  className="bg-yellow-100 text-black hover:bg-yellow-400 font-semibold py-2 px-4 rounded-lg shadow-md folder-button flex items-center space-x-4"
                  onClick={() => handleFolderClick(folder)}
                >
                  <div className="text-4xl"> {/* This makes the folder icon bigger */}
                    📁 {/* Folder icon */}
                  </div>
                  <div className="text-xl">
                    {folder} {/* Folder name */}
                  </div>
                </button>
              ))}
            </div>
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleInputSubmit(); // Call the submit function when Enter is pressed
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
                    {/* Choose File Button */}
                    <label className="bg-white hover:bg-blue-700 text-blue-600 px-4 py-2 rounded-lg cursor-pointer mr-4">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileChange(index, e.target.files[0])}
                        className="hidden" // Hide the default file input
                      />
                      Upload File
                    </label>

                    {/* File Name Display Box */}
                    <div className="rounded-lg border-2 border-white p-2 bg-blue-600 flex-grow">
                      <span className="text-white">
                        {field.file ? field.file.name : "No file selected"}
                      </span>
                    </div>
                  </div>

                  {/* Conditionally Render Submit File Button if a file is selected */}
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