---
name: store-release
description: 提包阶段的商店合规与产物清单
phase:
  - package
  - release
---

# 商店提包要点

- 版本号：pubspec.yaml 的 version = major.minor.build+N；构建号只增不减。
- Android 签名用项目已配置的 keystore；不生成新密钥。
- iOS 构建/上传需要 macOS + 证书，本环境没有时：只产出未签名产物并在摘要注明。
- 提包阶段产物清单：apk/aab、截图、版本说明（changelog 按语言）。
- 隐私权限：manifest/Info.plist 里声明的权限必须有对应功能，用不到的删掉。
