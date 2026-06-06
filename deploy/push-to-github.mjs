#!/usr/bin/env node
/**
 * Push all deploy/ files to GitHub via Git Data API (single commit).
 * Usage: GITHUB_TOKEN=xxx node push-to-github.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.GITHUB_TOKEN || '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';
const REPO = 'bcast1337/fotbat';
const BASE = new URL('.', import.meta.url).pathname;

const SKIP = new Set(['push-to-github.mjs', 'push.sh']);

async function api(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      'Authorization': `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'edge-fc-push',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok && res.status !== 422) {
    console.error(`API error ${res.status} for ${path}:`, JSON.stringify(json).slice(0, 200));
  }
  return json;
}

function getAllFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(base, full).replace(/\\/g, '/');
    if (SKIP.has(rel)) continue;
    if (statSync(full).isDirectory()) out.push(...getAllFiles(full, base));
    else out.push({ full, rel });
  }
  return out;
}

async function main() {
  console.log('Reading files...');
  const files = getAllFiles(BASE);
  console.log(`Found ${files.length} files.`);

  // Get or create the base tree SHA from existing HEAD
  let baseTreeSha = null;
  const ref = await api('GET', `/repos/${REPO}/git/refs/heads/main`);
  if (ref.object) {
    const commit = await api('GET', `/repos/${REPO}/git/commits/${ref.object.sha}`);
    baseTreeSha = commit.tree.sha;
    console.log('Base tree SHA:', baseTreeSha);
  }

  // Create blobs for each file
  const treeItems = [];
  for (const { full, rel } of files) {
    const content = readFileSync(full);
    const isBinary = rel.endsWith('.png') || rel.endsWith('.ico');
    const encoding = isBinary ? 'base64' : 'utf-8';
    const blobContent = isBinary ? content.toString('base64') : content.toString('utf-8');
    process.stdout.write(`  blob: ${rel}... `);
    const blob = await api('POST', `/repos/${REPO}/git/blobs`, { content: blobContent, encoding });
    if (blob.sha) {
      console.log('OK');
      treeItems.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
    } else {
      console.log('SKIP (already exists or error)');
    }
    await new Promise(r => setTimeout(r, 150));
  }

  // Create tree
  console.log('Creating tree...');
  const treePayload = { tree: treeItems };
  if (baseTreeSha) treePayload.base_tree = baseTreeSha;
  const tree = await api('POST', `/repos/${REPO}/git/trees`, treePayload);
  console.log('Tree SHA:', tree.sha);

  // Create commit
  console.log('Creating commit...');
  const commitPayload = {
    message: 'feat: Edge FC v2 — full project with backend + frontend',
    tree: tree.sha,
  };
  if (ref.object) commitPayload.parents = [ref.object.sha];
  const commit = await api('POST', `/repos/${REPO}/git/commits`, commitPayload);
  console.log('Commit SHA:', commit.sha);

  // Update ref
  console.log('Updating main branch...');
  const updateRes = await api(ref.object ? 'PATCH' : 'POST', `/repos/${REPO}/git/refs/heads/main`, { sha: commit.sha, force: true });
  console.log('Done!', updateRes.object?.sha ?? updateRes.message ?? 'OK');
  console.log(`\n✅ View at: https://github.com/${REPO}`);
}

main().catch(console.error);
