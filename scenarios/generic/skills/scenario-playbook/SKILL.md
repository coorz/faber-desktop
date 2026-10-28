---
name: scenario-playbook
description: generic 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# 场景流程总纲（所有阶段）

## 需求
输出 PRD：用户故事（Given/When/Then 验收标准）、范围外、成功指标。空工作区时技术选型取最小可用。
## 设计
任务拆分 ≤1h 粒度，第一个任务永远是「脚手架+空跑构建」，数据模型变更先于使用它的任务。
## 开发
每任务：读相关文件 → 小步改 → 跑构建/测试 → finish 摘要。失败按失败配方处理，禁止空转重试。
## 测试
跑全量 testCmd；无 testCmd 的项目输出手工验证清单并标注「自动化覆盖：无」。
## 提包
跑 packageCmd 收集产物；产物命名含版本号与日期。
## 发布
releaseCmd 幂等可重跑；发版说明按里程碑写，不写流水账。
## 营销
按海外买量平台规格矩阵产出素材与文案。
