---
name: scenario-playbook
description: ai-agent 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# AI 应用/Agent 全流程

## 需求
- 输入/输出边界与兜底策略（模型不可用时怎么办）写进 PRD。
## 设计
- prompt 文件化版本化（与代码同仓同版本）；eval 集设计（≥10 样例+期望）。
- 模型路由：主模型/便宜模型分工；token 预算每任务上限。
## 开发
- 输出结构化（JSON schema 校验），解析失败算失败重试。
- API key 全部走环境变量；prompt 改动必须跑 eval。
## 测试
- eval 基线不回退：通过率/质量分低于基线即门失败，定位是 prompt 还是检索坏了。
## 提包
- 产物 = 应用 + prompt 版本清单 + eval 报告。
## 发布
- 灰度：先 5% 流量对比新旧 prompt 基线。
## 营销
- 强调可信与成本：示例输出、成本对比表。
