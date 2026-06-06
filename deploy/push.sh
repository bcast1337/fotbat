#!/usr/bin/env node
// Push all deploy/ files to GitHub via API
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'bcast1337/fotbat';

function getAllFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      files.push(...getAllFiles(full, base));
    } else {
      files.push({ full, rel: path.relative(base, full).replace(/\\/g, '/') });
    }
  }
  return files;
}

async function pushFile(rel, content) {
  const b64 = Buffer.from(content).toString('base64');
  const body = JSON.stringify({ message: `feat: add ${rel}`, content: b64 });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${REPO}/contents/${rel}`,
      method: 'PUT',
      headers: { 'Authorization': `token ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'edge-fc-push', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const files = getAllFiles(path.join(__dirname, '..'));
  for (const { full, rel } of files) {
    if (rel === 'push.sh' || rel.includes('node_modules') || rel.includes('.git')) continue;
    const content = fs.readFileSync(full);
    process.stdout.write(`Pushing ${rel}... `);
    const r = await pushFile(rel, content);
    console.log(r.status === 201 ? 'OK' : `${r.status}`);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('Done!');
}

main().catch(console.error);
