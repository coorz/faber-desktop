---
name: android-build
description: Android App (Kotlin/Gradle) 领域技能
phase:
  - dev
  - test
  - package
---

# Android App (Kotlin/Gradle)

Android 构建要点

- 无 gradlew 时先报错说明，不要凭空生成 wrapper jar。
- local.properties/签名文件不进快照；版本号 build.gradle 的 versionCode 只增。
- targetSdk 跟随任务要求，不要顺手升。
- 清单权限与实际功能一一对应，多余权限删掉。
