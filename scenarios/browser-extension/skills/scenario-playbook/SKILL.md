---
name: scenario-playbook
description: browser-extension 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# 浏览器插件全流程

## 需求
- 宿主（Chrome/Edge/Firefox）范围；manifest v3 硬约束入验收。
## 设计
- background（service worker 事件驱动）/content script/popup 职责表；storage schema。
## 开发
- 远程代码禁止；host_permissions 最小化；content script 与页面隔离通信。
## 测试
- 手工冒烟清单 + Puppeteer/Playwright 加载扩展跑核心路径。
## 提包
- zip 内容核对（4096 图标、privacy policy）；Chrome Web Store 隐私问卷如实填。
## 发布
- 审核周期 1-7 天；版本回退不可用（只能发新版）。
## 营销
- 商店页截图 1280x800；关键词写标题与短描述。
