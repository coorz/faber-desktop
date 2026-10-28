---
name: scenario-playbook
description: ios-app 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# iOS App 全流程

## 需求
- 明确最低 iOS 版本与机型；Human Interface Guidelines 关键点入验收。
## 设计
- SwiftUI 优先；数据模型用 Codable；网络层单文件抽象。
## 开发
- Xcode 工程改动最小化：project.pbxproj 用文本 diff 自查，target/签名配置不乱动。
- 服务器无 macOS：只改代码与 plist，构建输出操作清单。
## 测试
- 本环境无模拟器：输出 XCTest 计划与手工验证清单。
## 提包
- 版本号 CFBundleShortVersionString + build 只增；Info.plist 权限必须有用途文案。
- 上传走 ASC API（AuthKey + altool/notarytool 模式）。
## 发布
- 批量多语言 listing； phased release 可选。
## 营销
- ASA：CPP 按关键词定制商店页；Today 帖子 1920x1080。
