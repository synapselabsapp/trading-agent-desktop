'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveHermesHome(env = process.env, platform = process.platform) {
  const override = String(env.HERMES_HOME || '').trim();
  if (override) return override;
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || path.join(env.USERPROFILE || '', 'AppData', 'Local');
    return path.join(localAppData, 'hermes');
  }
  return path.join(env.HOME || '', '.hermes');
}

function collectFiles(root, current = root) {
  const files = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(root, fullPath));
    else if (entry.isFile()) files.push(path.relative(root, fullPath));
  }
  return files;
}

function installArrowSkills({ sourceRoot, env = process.env, platform = process.platform, dryRun = false } = {}) {
  if (!sourceRoot) return { status: 'unavailable', installed: 0, existing: 0, total: 0, path: null };
  const source = path.resolve(sourceRoot);
  if (!fs.existsSync(source)) return { status: 'unavailable', installed: 0, existing: 0, total: 0, path: null };

  const files = collectFiles(source);
  const target = path.join(resolveHermesHome(env, platform), 'skills', 'arrow-desktop-app');
  if (dryRun) return { status: 'dry-run', installed: 0, existing: 0, total: files.length, path: target };

  let installed = 0;
  let existing = 0;
  for (const relativePath of files) {
    const sourcePath = path.join(source, relativePath);
    const targetPath = path.join(target, relativePath);
    if (fs.existsSync(targetPath)) {
      existing += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    installed += 1;
  }

  return {
    status: installed > 0 ? 'installed' : 'present',
    installed,
    existing,
    total: files.length,
    path: target,
  };
}

module.exports = { installArrowSkills, resolveHermesHome };
