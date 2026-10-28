---
name: ios-signing
description: iOS App (Swift) 领域技能
phase:
  - dev
  - test
  - package
---

# iOS App (Swift)

iOS 提包要点

- 本环境无 macOS/Xcode 时：只改代码与配置，构建输出操作清单。
- 版本号：Info.plist 的 CFBundleShortVersionString + build 号只增不减。
- 签名/推送用项目既有证书，不生成新密钥。
- Info.plist 权限声明必须有对应功能与用途文案（NSxxxUsageDescription）。
