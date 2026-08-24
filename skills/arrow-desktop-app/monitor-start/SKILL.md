---
name: monitor-start
description: "Use for Arrow desktop app monitor start actions."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, monitor, start]
    related_skills: []
---
# Arrow desktop app — start monitor

Use for `{"type":"set_monitor","value":"start"}`.

The host requires local credentials and a stopped monitor before invoking `monitor:start`. This action changes monitor state only; it does not open a trade.

Verify disabled/enabled UI state, IPC allowlisting, node syntax, focused contracts, and fresh Electron smoke. Never use live credentials in tests.