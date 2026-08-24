const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installArrowSkills, resolveHermesHome } = require('../hermes-skills.cjs');

test('Arrow skills install after Hermes detection without overwriting existing files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-arrow-skills-'));
  const source = path.join(root, 'bundled-skills');
  fs.mkdirSync(path.join(source, 'references'), { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), '# Arrow skill');
  fs.writeFileSync(path.join(source, 'references', 'guide.md'), '# Guide');
  const env = { HERMES_HOME: path.join(root, 'hermes') };
  try {
    assert.equal(resolveHermesHome(env, 'win32'), env.HERMES_HOME);
    const first = installArrowSkills({ sourceRoot: source, env, platform: 'win32' });
    assert.equal(first.status, 'installed');
    assert.equal(first.installed, 2);
    assert.equal(fs.readFileSync(path.join(env.HERMES_HOME, 'skills', 'arrow-desktop-app', 'SKILL.md'), 'utf8'), '# Arrow skill');
    fs.writeFileSync(path.join(env.HERMES_HOME, 'skills', 'arrow-desktop-app', 'SKILL.md'), '# User customization');
    const second = installArrowSkills({ sourceRoot: source, env, platform: 'win32' });
    assert.equal(second.status, 'present');
    assert.equal(fs.readFileSync(path.join(env.HERMES_HOME, 'skills', 'arrow-desktop-app', 'SKILL.md'), 'utf8'), '# User customization');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
