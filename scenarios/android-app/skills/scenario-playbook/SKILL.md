---
name: scenario-playbook
description: android-app 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Android App 全流程

## 需求
- minSdk/targetSdk 明确并写入验收；主流国产 ROM 差异（权限弹窗/后台限制）入范围。
## 设计
- 单 Activity + Compose/View 二选一；数据层 Room/DataStore。
## 开发
- 无 gradlew 不凭空生成 wrapper；local.properties 与签名文件不进快照。
- release 构建开 minify 时输出混淆映射归档。
## 测试
- `./gradlew testDebugUnitTest` + connectedDebugAndroidTest（有模拟器时）。
## 提包
- versionCode 只增；AAB 上 Play，APK 备国内渠道。
- privacy policy + data safety 表单按真实收集项填。
## 发布
- Play：staged rollout 10%→50%→100%；国内渠道包逐渠道核验签名。
## 营销
- Google AC：素材喂满（5 标题+5 描述+图片+视频），让系统自己组合。
