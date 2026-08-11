---
name: backend-multi-agent
description: 혼디가개 백엔드의 큰 작업(신규 서비스, DB/Redis/API/보안이 함께 걸린 변경, 대형 리팩토링)을 Leader / Executor / DB Reviewer / Hexagonal Reviewer / Security Reviewer 역할로 나눠 설계·구현·검증한다. 단일 파일 수정 같은 작은 작업에는 사용하지 않는다.
---

# Backend Multi-Agent Playbook

백엔드 작업이 구현과 검토를 역할로 나눌 만큼 클 때 사용하는 스킬.

## When to Use

- 새 백엔드 서비스 또는 주요 컨텍스트 추가
- DB / Redis / API / docs가 함께 변경되는 작업
- 아키텍처 드리프트 위험이 큰 리팩토링
- 사용자가 명시적으로 멀티 에이전트/팀 방식을 요청할 때

아래 경우에는 사용하지 않는다.

- 단일 파일 수정
- 명확한 버그 1건 수정
- 단순 문구·로그·Swagger 정리

## Read First

1. [backend/docs/team-playbook.md](../../../backend/docs/team-playbook.md)
2. [backend/docs/architecture-guide.md](../../../backend/docs/architecture-guide.md)
3. [backend/docs/coding-conventions.md](../../../backend/docs/coding-conventions.md)
4. [backend/docs/api-design-guide.md](../../../backend/docs/api-design-guide.md)
5. [backend/docs/done-checklist.md](../../../backend/docs/done-checklist.md)

## Roles

- **Backend Leader** — 범위·out-of-scope·공개 API 방향·서비스 경계 고정, 검토 결과 통합
- **Backend Executor** — Controller/Facade/Processor/Port/Adapter 실구현, compile/test/check 맞춤
- **DB Reviewer** — entity, QueryResult, repository, 인덱스, soft delete, Redis key 검토
- **Hexagonal Reviewer** — 계층 흐름과 Port/Adapter 경계 검토 (`architecture-guide.md` 기준)
- **Security Reviewer** — JWT, Resource Server, 게이트웨이, 인가 정책 검토 (보안 변경 시에만)

## Role Set by Task Shape

| 작업 | Role Set |
|------|----------|
| 단일 서비스 기능 추가 | Leader + Executor + Hexagonal |
| DB/Redis/Query 구조 변경 | Leader + Executor + DB + Hexagonal |
| 보안/인증 구조 변경 | Leader + Executor + Security + Hexagonal |
| 신규 서비스 / 대형 리팩토링 | Leader + Executor + DB + Hexagonal + (필요 시 Security) |

## Procedure

1. 작업 분류 — 단일 서비스 기능 / DB·쿼리 변경 / 보안 변경 / 신규 서비스·대형 리팩토링
2. Role Set 선택
3. Leader가 먼저 고정 — 범위, out-of-scope, 공개 API 방향, 서비스 경계
4. 역할 분리 — Executor는 구현, Reviewer는 경계/영속성/보안 검토 (중복 편집 금지)
5. 통합 — Leader가 검토 의견을 수용/반려하고 최종 일관성 패스 1회
6. 검증 — compile, test, check, Swagger, docs 갱신

## Execution

Claude Code의 Agent 도구로 역할별 subagent를 병렬 호출해 각자의 단일 책임만 수행하게 한다. 예:

- `general-purpose` subagent를 "Hexagonal Reviewer" 프롬프트로 돌려 경계 누수 보고만 받는다
- `Explore` subagent로 넓은 탐색(코드 맵)을 병렬로 받는다
- 구현은 메인 세션의 Executor가 단일 쓰레드로 진행해 충돌을 막는다

병렬 호출은 한 메시지 안에 여러 Agent 호출을 묶어서 보낸다.

## Output Format

```text
BACKEND MULTI-AGENT PLAN
========================

Task:
- ...

Role Set:
- Leader: ...
- Executor: ...
- DB Reviewer: ... (있으면)
- Hexagonal Reviewer: ...
- Security Reviewer: ... (있으면)

Execution Order:
1. Leader 고정
2. Executor 구현 / Reviewer 병렬 검토
3. 통합 패스
4. 검증

Review Decisions:
- accepted: ...
- rejected: ... (사유)

Verification:
- compile/test/check
- Swagger
- docs 갱신 대상

Remaining Risks:
- ...
```
