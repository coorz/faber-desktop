---
name: npm-release
description: npm 包发布纪律：semver、入口、README、发版检查
phase:
  - dev
  - package
  - release
---

# npm 发布纪律

- exports 字段写清 main/module/types；bin 脚本带 shebang 且 chmod +x。
- 破坏性改动必须升 major；新增带 default 的参数算 minor；修 bug 是 patch。
- README 第一屏要有：一句话是什么、安装命令、30 秒能跑的最小示例。
- 发版前检查：npm pack 看包内容、干净环境 npm i -g 验装、CHANGELOG 补条目。
- 版本号用 npm version 打 tag，发版后验证 registry 上的 README 渲染。
