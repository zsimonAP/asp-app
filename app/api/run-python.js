import { exec } from 'child_process';
import path from 'path';

export default function handler(req, res) {
  const scriptPath = path.resolve('./backend/scripts/server.py');

  exec(`python ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      res.status(500).json({ error: error.message });
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      res.status(500).json({ error: stderr });
      return;
    }
    res.status(200).json({ output: stdout });
  });
}
