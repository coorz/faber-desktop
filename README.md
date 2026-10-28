# Faber Desktop

Desktop client for [Faber](https://faber.echo-ai.chat) — a scenario-driven AI development workbench that runs the whole delivery pipeline locally: requirements → design → dev → test → packaging → release → marketing.

The agent reads and writes code **on your machine**. Code never leaves your computer — only model calls go through the cloud (billed in credits).

## v1.0.0 features
- 7-stage delivery pipeline with verification gates and human approval points
- 16 scenario packs (Flutter, Unity, full-stack web, browser extensions, CLIs, Go, Rust, Telegram bots…), each with lifecycle playbooks
- Monaco editor with AI completion; agent-change review panel (per-file diff + revert)
- Permission tiers: high-risk commands (delete/push/sudo/outside allowlist) require explicit approval
- Unified secrets vault (OS-level encryption)
- Persistent memory: rules / preferences / AI pitfalls / proven solutions
- Silent auto-update

## Download
https://faber.echo-ai.chat/#download

## Build
```bash
npm install
npx electron-builder --mac   # --win / --linux also supported
```

## License
Proprietary © ChainJoy Limited. All rights reserved.
