import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const scriptsDir = path.resolve('./backend/scripts');
  try {
    const scripts = fs.readdirSync(scriptsDir).filter(file => file.endsWith('.py'));
    res.status(200).json({ scripts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
