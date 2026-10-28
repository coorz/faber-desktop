---
name: scenario-playbook
description: rust-cli 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Rust 工具全流程

## 需求
- CLI 参数契约（--help 输出草案）入 PRD；性能目标（如 P95 <100ms）量化。
## 设计
- 错误处理：thiserror 库错误 + anyhow 应用层；数据结构先定 trait 边界。
## 开发
- clippy -D warnings + fmt --check 必过；禁非测试代码 unwrap/expect。
- 依赖审计 cargo audit；MSRV 明确。
## 测试
- cargo test 全绿 + assert_cmd 做端到端 CLI 测试。
## 提包
- cargo package 内容检查；release 三平台二进制（GitHub matrix）+ crates.io publish。
## 发布
- CHANGELOG 按 Keep a Changelog；semver 严格执行。
## 营销
- README 首屏：一句话+安装+30 秒示例；crates.md 徽章。
