---
name: scenario-playbook
description: telegram-bot 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Telegram Bot 全流程

## 需求
- 命令清单与对话流程图；管理员命令与用户命令权限分离。
## 设计
- webhook vs long-polling 二选一（服务器有域名证书选 webhook）；状态机存 DB 不存内存。
## 开发
- token 走环境变量；速率遵守 30 msg/s 全局与 1 msg/s 每 chat。
- 消息处理幂等（update_id 去重）。
## 测试
- 用测试 bot token + 私有测试群人工冒烟 + 单测覆盖命令解析。
## 提包
- 产物 = 服务进程 + 设置 webhook 脚本 + 环境变量清单。
## 发布
- webhook secret_token 校验；监控 /getWebhookInfo 排错。
## 营销
- Bot 商店目录提交 + start 消息即引导。
