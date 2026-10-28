---
name: scenario-playbook
description: python-data 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# 数据工程全流程

## 需求
- 数据源、更新频率、下游消费者三要素入 PRD；口径（指标定义）必须书面化。
## 设计
- 幂等设计：每步可重跑；分区键明确；schema 演进策略。
## 开发
- venv/依赖锁版本；路径参数化（环境变量）；大文件流式处理。
## 测试
- pytest 单测覆盖转换逻辑；用小样本数据集跑端到端。
## 提包
- 产物 = 可运行脚本 + requirements 锁定 + 运行手册（README）。
## 发布
- 调度接入（cron/airflow）与回填（backfill）命令写清。
## 营销
- 不适用；输出数据资产文档。
