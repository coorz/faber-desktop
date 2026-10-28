---
name: widget-dev
description: Flutter 界面开发：布局用安全区和屏幕宽度，文案进语言表
phase:
  - dev
---

# Flutter 界面开发

- 布局基于 SafeArea + MediaQuery 宽度比例，不写死像素。
- 文案一律走语言表（l10n/arb），不硬编码字符串；先复用已有键。
- 状态：页面内用 StatefulWidget/setState；跨页面用现成的状态方案；不引入新依赖除非任务要求。
- 长文本用最长的语言 + 窄屏检查溢出（Expanded/Flexible 包裹）。
- 平台差异用 Platform.isXX 分支时，两个分支都要能编译。
