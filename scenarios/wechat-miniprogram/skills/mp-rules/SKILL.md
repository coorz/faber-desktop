---
name: mp-rules
description: 微信小程序 领域技能
phase:
  - dev
  - test
  - package
---

# 微信小程序

小程序合规要点

- 类目与实际功能一致；诱导分享/收集多余隐私会被拒审。
- 包体积：主包 ≤2MB，用分包；资源走 CDN。
- request 合法域名要在小程序后台配置，代码里域名写常量。
- 服务器无开发者工具时：改动后输出 preview/upload 命令清单（miniprogram-ci + privateKey）。
