---
name: scenario-playbook
description: react-native 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# React Native 全流程

## 需求
- 双端一致性与平台特有功能分开列。
## 设计
- 导航结构图先行；原生模块清单（是否需要自己写桥）。
## 开发
- Metro 缓存问题先 `--reset-cache`；依赖升级用 upgrade helper 不裸升。
- 原生改动标注【需重新 build 原生壳】。
## 测试
- Jest 组件测试 + Detox/E2E（配置存在时）。
## 提包
- 双端版本号同步；iOS 需 macOS；Android 签名 keystore 不入快照。
## 发布
- CodePush/OTA（如使用）灰度策略写进发布说明。
## 营销
- 同 Flutter。
