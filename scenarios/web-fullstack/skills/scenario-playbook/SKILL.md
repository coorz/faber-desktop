---
name: scenario-playbook
description: web-fullstack 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Web 全栈全流程

## 需求
- 页面清单 × 用户角色权限矩阵；浏览器兼容范围。
## 设计
- API 契约先行（路由+请求响应示例）；DB 迁移策略；环境变量清单。
## 开发
- 前后端共用类型；迁移幂等可回滚；SPA fallback 到 index.html。
- 接口改完 curl 冒烟再提交。
## 测试
- API 集成测试 + 前端构建零错误；E2E 走核心路径（登录→核心操作→退出）。
## 提包
- 产物 = 前端 dist + 后端镜像/目录 + 迁移脚本 + 部署说明。
## 发布
- 迁移先跑、代码后上；回滚 = 前一镜像 + 迁移回滚。
## 营销
- 落地页 SEO 三件套（meta/sitemap/llms.txt）与产品同版本。
