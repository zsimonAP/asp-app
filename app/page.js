'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [scripts, setScripts] = useState([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchScripts = async () => {
      try {
        const response = await axios.get('http://localhost:5001/list-scripts');
        console.log('Scripts fetched:', response.data.scripts); // Debugging line
        setScripts(response.data.scripts);
      } catch (err) {
        console.error('Failed to fetch scripts:', err); // Debugging line
        setError('Failed to fetch scripts: ' + err.message);
      }
    };
    fetchScripts();
  }, []);

  const runScript = async (script) => {
    try {
      const response = await axios.post('http://localhost:5001/run-script', { script });
      console.log('Script output:', response.data.output); // Debugging line
      setOutput(response.data.output);
      setError(response.data.error || ''); // Clear any previous errors
    } catch (err) {
      console.error('Error running script:', err); // Debugging line
      if (err.response) {
        setError(err.response.data.error);
      } else if (err.request) {
        setError('No response received from the server.');
      } else {
        setError('Error in setting up the request: ' + err.message);
      }
      setOutput(''); // Clear any previous output
    }
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
