const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('synapseDesktop', Object.freeze({
  platform: process.platform,
  hermesStatus: () => ipcRenderer.invoke('hermes:status'),
  hermesSetup: (request) => ipcRenderer.invoke('hermes:setup', request),
  assistantChat: (input) => ipcRenderer.invoke('assistant:chat', input),
  botConfig: (request) => ipcRenderer.invoke('bot:config', request),
  agentPreferences: (request) => ipcRenderer.invoke('agent:preferences', request),
  exchangeCredentials: (request) => ipcRenderer.invoke('exchange:credentials', request),
  exchangeAccount: (exchange) => ipcRenderer.invoke('exchange:account', { exchange }),
  closePosition: (request) => ipcRenderer.invoke('exchange:close-position', request),
  monitorStatus: (exchange) => ipcRenderer.invoke('monitor:status', { exchange }),
  startMonitor: (exchange) => ipcRenderer.invoke('monitor:start', { exchange }),
  stopMonitor: (exchange) => ipcRenderer.invoke('monitor:stop', { exchange }),
}));
