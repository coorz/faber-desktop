---
name: scenario-playbook
description: unity 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Unity 游戏全流程

## 需求
- 核心循环（core loop）一段话讲清；数值曲线（关卡难度/经济）入 PRD。
- 明确目标平台（iOS/Android/WebGL/Steam）与最低机型。
## 设计
- 场景清单 + Prefab 结构 + ScriptableObject 配置表设计。
- 远程配置（Remote Config/JSON）键表与回退值。
- C# 程序集划分：核心逻辑与 MonoBehaviour 分离（服务器可测）。
## 开发
- .unity/.prefab 是 YAML：改前改后 diff 自查，GUID 不可破坏；新资产必须带 .meta。
- 无 Editor 环境：只改 C# 与配置，场景改动输出操作清单。
- 同一项目不并行开两个 Editor 实例。
## 测试
- 纯逻辑 EditMode；场景相关 PlayMode：`-batchmode -runTests -testPlatform PlayMode -testResults results.xml`，退出码非零即失败。
- 帧率基线：首帧/平均FPS/峰值内存，超基线 1.2 倍门失败。
## 提包
- Addressables/AssetBundle 清单核对；分包（WebGL/小游戏）检查首包 ≤ 规定值。
- 多平台构建矩阵按 manifest 声明。
## 发布
- Steam：depot/build 配置核对；移动：商店截图+视频+分级问卷。
## 营销
- Playable ads（HTML5 ≤5MB）与 rewarded video 15-30s 是休闲买量主力。
