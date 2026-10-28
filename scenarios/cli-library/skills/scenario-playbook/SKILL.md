---
name: scenario-playbook
description: cli-library 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# CLI/库全流程

## 需求
- 公共 API 面即需求：每个导出符号的签名与语义。
## 设计
- semver 纪律：破坏=major、新增带默认=minor、修 bug=patch。
## 开发
- 入口 exports 齐全（main/module/types）；bin 带 shebang。
- README 首屏：一句话+安装+30 秒示例。
## 测试
- 公共 API 全覆盖 + 干净环境安装验证。
## 提包
- npm pack 检查内容；CHANGELOG 补条目；版本 tag。
## 发布
- npm publish + GitHub Release 同步；发后验证 registry 渲染。
## 营销
- crates/npm 搜索关键词优化；对比表（与同类工具）。
