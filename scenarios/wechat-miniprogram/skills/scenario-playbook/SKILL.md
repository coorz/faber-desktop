---
name: scenario-playbook
description: wechat-miniprogram 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# 微信小程序全流程

## 需求
- 类目决定资质：先确认类目与所需资质再写功能。
## 设计
- 分包规划（主包 ≤2MB）；request 合法域名清单。
## 开发
- 域名写常量并在后台配置；敏感接口服务端代理，不把 appsecret 放前端。
- 兼容基础库版本写明（wx.getSystemInfo 判断）。
## 测试
- 服务器无开发者工具：输出 miniprogram-ci preview 命令清单；自动化用 miniprogram-automator。
## 提包
- miniprogram-ci upload + 版本描述；隐私接口（getUserProfile 等）需在后台申请。
## 发布
- 提审前自检：诱导分享、类目错配、隐私声明——三大拒审源。
## 营销
- 小程序买量走微信广告；分享卡片图 5:4。
