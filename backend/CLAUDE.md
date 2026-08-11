# 혼디가개 Backend Claude Guide

## 목적

- 이 문서는 `backend/` 작업 시 Claude Code가 먼저 확인하는 요약 엔트리다.
- 실제 규칙의 단일 기준은 `backend/docs/*.md`다.

## 우선 확인 문서

1. `docs/README.md`
2. `docs/architecture-guide.md`
3. `docs/coding-conventions.md`
4. `docs/api-design-guide.md`
5. `docs/service-playbook.md`
6. `docs/done-checklist.md`

## 운영 원칙

- `AGENTS.md`, `CLAUDE.md`는 엔트리 문서다.
- 세부 규칙은 `docs/`에 모은다.
- 구현 중 새 규칙이 생기면 엔트리 문서보다 해당 `docs/*.md`를 먼저 갱신한다.
- 서비스별 차이는 `docs/services/*.md`에 정리한다.

## 파일 인코딩 규칙 (필수)

- **모든 소스 / 설정 / 문서 파일은 반드시 `UTF-8` (no BOM) 로 저장한다.**
- Windows 는 기본이 CP949 이므로 에디터/도구가 CP949 로 저장하면 한글이 깨진다.
- 강제 설정이 적용되어 있으니 덮어쓰지 말 것:
  - 루트 `.editorconfig` — `charset = utf-8`
  - 루트 `.gitattributes` — `*.java working-tree-encoding=UTF-8`
  - `build.gradle` — `options.encoding = 'UTF-8'` (subprojects 공통, 빌드 셋업 시 반영)
- 새 파일을 만들 때 한글을 포함한다면 `Write` 툴로 UTF-8 기본 저장을 유지한다.
- `git status` 에서 수정된 적 없는데 diff 가 잡히면 인코딩 문제를 의심한다.
