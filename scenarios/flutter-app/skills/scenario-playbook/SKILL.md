---
name: scenario-playbook
description: flutter-app 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Flutter App 全流程

## 需求
- 主流对标应用先调研（商店评价正反面），功能可对标但文案换新。
- 必备清单：账号/设置/付费与恢复购买/删号/隐私入口/空状态与失败提示。
- 明确双端（iOS/Android）差异点与最低系统版本。
## 设计
- 状态管理方案先定（页面内 setState / 跨页 Provider 等，不引入新框架）。
- 每个界面先出原型描述（布局/组件/状态），再拆任务。
- l10n 键表在设计期定骨架，文案开发期填。
## 开发
- 布局 SafeArea + MediaQuery 比例；文字进语言表；九宫格中心切片。
- 平台分支（Platform.isXX）双分支都要编译通过。
- 改了共用控件，所有用到它的页面都要跑组件测试。
## 测试
- `flutter analyze` 零 error；`flutter test` 组件测试 + 集成测试全过。
- 集成测试覆盖：进入→提交→失败→空状态→付费入口，每个按钮点到。
- 窄屏 + 最长语言看溢出。
## 提包
- version = major.minor.build+N；构建号只增不减（store_build_code 逻辑：商店最大号+1）。
- Android：签名用项目 keystore；iOS：本环境无 macOS 时输出构建清单。
- 商店素材：截图（6.9" 1290x2796 / 6.5"）、多语言 listing、隐私问卷按真实功能填。
## 发布
- 批量更新多语言 listing（并发，不串行）；首审需要审核测试账号。
- 版本说明按控制台语言列表填全；关键词额度用满（≥95/100）。
## 营销
- ASA 直接用商店截图 CPP；买量素材 9:16 优先，hook 前 3 秒。
