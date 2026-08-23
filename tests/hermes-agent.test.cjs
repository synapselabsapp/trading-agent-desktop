const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HERMES_INSTALL_GUIDE,
  buildHermesSetupUrl,
  classifyHermesStatus,
} = require('../hermes-agent.cjs');

test('Hermes setup uses only the official installation guide', () => {
  assert.equal(buildHermesSetupUrl('download'), HERMES_INSTALL_GUIDE);
  assert.equal(buildHermesSetupUrl('setup'), HERMES_INSTALL_GUIDE);
  assert.throws(() => buildHermesSetupUrl('chat'), /not allowed/i);
  assert.throws(() => buildHermesSetupUrl('send'), /not allowed/i);
  assert.match(HERMES_INSTALL_GUIDE, /^https:\/\/hermes-agent\.nousresearch\.com\/docs\//);
});

test('Hermes runtime status has one guided path', () => {
  assert.equal(classifyHermesStatus({ installed: false, healthy: false }), 'not-installed');
  assert.equal(classifyHermesStatus({ installed: true, healthy: false }), 'setup-required');
  assert.equal(classifyHermesStatus({ installed: true, healthy: true }), 'ready');
  assert.equal(classifyHermesStatus({ installed: false, healthy: true }), 'not-installed');
});
