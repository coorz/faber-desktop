---
name: rust-gate
description: 工具 (Rust) 领域技能
phase:
  - dev
  - test
  - package
---

# 工具 (Rust)

Rust 质量门

- cargo clippy -- -D warnings 必须过；cargo fmt --check 必须过。
- 禁 unwrap()/expect() 出现在非测试代码路径（错误用 anyhow/thiserror 传递）。
- 新依赖查 crates.ms 维护度与体积影响；lockfile 必须提交。
