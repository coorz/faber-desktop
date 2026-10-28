---
name: scenario-playbook
description: electron-desktop 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Electron/Tauri 桌面应用全流程

## 需求
- 三平台支持矩阵（含系统版本）；离线能力边界。
## 设计
- 主/渲染进程职责边界；IPC 协议表；自动更新方案（electron-updater）。
## 开发
- 渲染层纯 Web（不碰 Node API）；contextIsolation 开、nodeIntegration 关。
- 原生模块注意三平台编译矩阵。
## 测试
- Playwright _electron E2E；打包冒烟（安装→启动→核心功能→卸载）。
## 提包
- mac：签名+公证（Developer ID + notarytool）；win：代码签名证书；linux：AppImage+deb。
- 自动更新 feed（latest.yml/latest-mac.yml）随包发布。
## 发布
- 版本三平台同号；更新通道（beta/stable）策略。
## 营销
- 官网下载页按平台检测推荐。
