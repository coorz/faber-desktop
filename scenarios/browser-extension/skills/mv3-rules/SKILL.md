---
name: mv3-rules
description: Manifest V3 的硬约束与商店审核要点
phase:
  - dev
  - package
---

# Manifest V3 约束

- Service worker 是事件驱动的：不要假设后台常驻，全局状态用 chrome.storage。
- 远程代码禁止：所有 JS 必须打进包里；CDN 动态加载逻辑会被拒。
- 权限最小化：host_permissions 只声明实际访问的域，多申请必被审核打回。
- content script 与页面隔离：用 chrome.runtime 消息通信，不直接碰页面变量。
- 提包前 zip 里必须有 4096x4096 图标 + 详细 privacy policy；single purpose 描述写清。
