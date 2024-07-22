const { execSync } = require('child_process');
const path = require('path');

const appPath = path.resolve(__dirname, 'associated-pension-automation-hub.app');

try {
  execSync(`xattr -dr com.apple.quarantine "${appPath}"`);
  console.log('Removed quarantine attribute from:', appPath);
} catch (error) {
  console.error('Failed to remove quarantine attribute:', error);
}
