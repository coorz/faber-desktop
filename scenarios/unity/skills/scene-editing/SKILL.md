---
name: scene-editing
description: 场景与预制体改动：GUID 引用与丢失引用处理
phase:
  - dev
---

# 场景/预制体编辑

- .unity/.prefab 是 YAML：改动前后用文本 diff 自查，不要破坏 GUID。
- 引用丢失（missing reference）：先用文件名/GUID 反查引用方，再决定重链接还是删除组件。
- 新资产必须带 .meta 提交；改文件名要同步改 .meta 里的 guid 不变。
- Library/ Temp/ Logs/ 是缓存，永不修改。
- 服务器环境无 Unity Editor 时：只做 C# 脚本与配置改动，场景改动输出操作清单让客户端执行。
