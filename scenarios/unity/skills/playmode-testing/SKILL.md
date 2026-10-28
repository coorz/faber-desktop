---
name: playmode-testing
description: Unity 测试：EditMode/PlayMode 与性能基线
phase:
  - test
---

# Unity 测试

- 纯逻辑用 EditMode 测试；涉及场景/MonoBehaviour 用 PlayMode。
- 测试批处理：Unity -batchmode -runTests -projectPath . -testPlatform PlayMode -testResults results.xml -quit；退出码非零即失败。
- 帧率基线：首帧耗时、平均 FPS、峰值内存三项；超过基线 1.2 倍即验证门失败。
- 服务器无 Editor 时：C# 逻辑抽出为可独立编译的程序集，用 dotnet test 跑核心逻辑，场景测试留清单。
