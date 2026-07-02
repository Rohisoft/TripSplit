const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function buildId() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return String(Date.now());
  }
}

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
const src = fs.readFileSync(swPath, 'utf8');
const stamped = src.replace(
  /const CACHE = '[^']*';/,
  `const CACHE = 'tripsplit-${buildId()}';`
);
fs.writeFileSync(swPath, stamped);
console.log(`[stamp-sw] CACHE stamped -> tripsplit-${buildId()}`);
