# 혼디가개 Backend Agents Guide

## 목적

- 이 문서는 `backend/` 작업 시 코딩 에이전트가 먼저 확인하는 요약 엔트리다.
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
- 모든 파일은 UTF-8 (no BOM)로 저장한다. 세부는 `CLAUDE.md` 참고.
