import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const configPath = path.resolve('./backend/websocket_port.json');
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.status(200).json({ port: data.port });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
