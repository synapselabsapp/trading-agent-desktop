'use strict';

const HERMES_INSTALL_GUIDE = 'https://hermes-agent.nousresearch.com/docs/getting-started/installation/';
const HERMES_DOCS = 'https://hermes-agent.nousresearch.com/docs/';

function classifyHermesStatus({ installed = false, healthy = false } = {}) {
  if (!installed) return 'not-installed';
  return healthy ? 'ready' : 'setup-required';
}

function buildHermesSetupUrl(action) {
  if (action === 'download' || action === 'setup') return HERMES_INSTALL_GUIDE;
  throw new Error('Hermes Agent setup action is not allowed.');
}

module.exports = {
  HERMES_DOCS,
  HERMES_INSTALL_GUIDE,
  buildHermesSetupUrl,
  classifyHermesStatus,
};
