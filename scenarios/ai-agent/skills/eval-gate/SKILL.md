---
name: eval-gate
description: AI 应用 / Agent 开发 领域技能
phase:
  - dev
  - test
  - package
---

# AI 应用 / Agent 开发

AI 应用验证门

- prompt 文件进快照，每次改动可回滚；prompt 与代码同仓同版本。
- 建立 eval 集（≥10 条样例+期望），改动后必须跑 eval；基线退化即任务失败。
- 模型调用预算：每个任务记 token 上限，超限熔断。
- 输出用结构化 schema 校验，解析失败算失败。
