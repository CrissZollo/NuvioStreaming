// Utility to start the ChaiWala Filler API server from Node.js
// This should be run in development only, not in production builds

const { spawn } = require('child_process');
const path = require('path');

function startChaiWalaServer(port = 8080) {
  const serverPath = path.resolve(__dirname, '../../Downloads/index.js');
  const child = spawn('node', [serverPath], {
    env: { ...process.env, PORT: port },
    stdio: 'inherit',
    shell: true,
  });
  console.log(`[ChaiWala] Started filler API server on port ${port}`);
  return child;
}

module.exports = { startChaiWalaServer };
