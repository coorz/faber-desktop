---
name: scenario-playbook
description: go-service 场景全生命周期流程（每阶段的具体做法与验收）
phase:
  - requirements
  - design
  - dev
  - test
  - package
  - release
  - marketing
---

# Go 服务全流程

## 需求
- API 契约（OpenAPI/protobuf）先于实现；SLA（延迟/可用性）指标入验收。
## 设计
- 目录布局 cmd/internal/pkg；依赖注入用构造函数不用全局。
- 迁移工具选型（golang-migrate）与回滚脚本。
## 开发
- `go vet` + `golangci-lint` 零告警；错误必须 wrap（%w）带上文。
- context 贯穿所有 IO 调用；配置全部环境变量。
## 测试
- 单测表驱动；集成测试用 testcontainers；竞态 `-race` 必跑。
## 提包
- 交叉编译矩阵（linux/amd64+arm64）+ Dockerfile 多阶段构建。
## 发布
- 滚动发布 + /healthz /readyz 探针；迁移先行且向后兼容。
## 营销
- 输出 API 文档站与快速开始。
