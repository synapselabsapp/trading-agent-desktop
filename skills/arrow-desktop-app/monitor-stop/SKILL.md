---
name: monitor-stop
description: "Use for Arrow desktop app monitor stop actions."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, monitor, stop]
    related_skills: []
---
# Arrow desktop app — stop monitor

Use for `{"type":"set_monitor","value":"stop"}`.

The host requires a running monitor before invoking `monitor:stop`. This action changes monitor state only and does not close positions.

Verify disabled/enabled UI state, IPC allowlisting, node syntax, focused contracts, and fresh Electron smoke. Never use live credentials in tests.