---
name: fe-feature-bootstrap
description: 혼디가개 프론트엔드에 새 화면 또는 기능을 시작할 때 사용한다. screen-inventory / architecture-guide / api-integration-guide / DESIGN.md / done-checklist 기준으로 화면 책임·사용 API·라우트·컴포넌트 스켈레톤·상태 설계·검증 계획을 묶어 제시한다.
---

# FE Feature Bootstrap

프로젝트 컨벤션을 건너뛰지 않고 새 FE 화면/기능을 시작하기 위한 스킬.

## When to Use

- 새 화면 또는 기존 화면의 새 섹션을 시작할 때
- 화면의 1차 컴포넌트 스켈레톤과 구현 체크리스트가 필요할 때
- 반복 가능한 FE bootstrap 경로가 필요할 때

## Read First

1. [frontend/docs/screen-inventory.md](../../../frontend/docs/screen-inventory.md) — **착수 가능 여부를 여기서 먼저 확인한다**
2. [frontend/docs/architecture-guide.md](../../../frontend/docs/architecture-guide.md)
3. [frontend/docs/api-integration-guide.md](../../../frontend/docs/api-integration-guide.md)
4. [frontend/DESIGN.md](../../../frontend/DESIGN.md), [frontend/docs/styling-guide.md](../../../frontend/docs/styling-guide.md), [frontend/docs/component-guide.md](../../../frontend/docs/component-guide.md)
5. [frontend/docs/done-checklist.md](../../../frontend/docs/done-checklist.md)
6. 관련이 있으면 [frontend/docs/features/](../../../frontend/docs/features/), [frontend/docs/auth-guide.md](../../../frontend/docs/auth-guide.md), [frontend/docs/external-api-guide.md](../../../frontend/docs/external-api-guide.md)

## Procedure

1. **착수 가능 여부 확인 (게이트)**
   - `screen-inventory.md` 에서 대상 영역이 "착수 가능" 인지 본다
   - 백엔드 미착수면 **여기서 중단하고 BE 선행 필요로 보고한다.** mock으로 진행하지 않는다
   - AI 기능이면 루트 `README.md` 선정 상태를 확인한다

2. **화면 책임 정의**
   - 이 화면이 사용자에게 달성시킬 것
   - 범위 밖에 둘 것

3. **사용 API 확정 (추측 금지)**
   - Swagger 실측으로 경로·필드·nullable·enum 확인
     ```bash
     curl -s --max-time 10 http://localhost:8000/v3/api-docs | python3 -m json.tool --no-ensure-ascii | head -60
     ```
   - 백엔드 미기동이면 "확인 불가"로 명시하고 넘어가지 않는다
   - 문자열 ID / nullable / 단위 / enum metadata 를 표로 정리

4. **라우트 / 경계 정의**
   - 경로와 route group (`(main)` / `(auth)`)
   - 인증 필요 여부 → `middleware.ts` `PROTECTED_PATHS` 등록 여부
   - server / client 컴포넌트 경계 (브라우저 API·hook·지도 사용 여부)

5. **페칭·상태 결정 (선택 규칙 적용)**
   - `architecture-guide.md` §9 결정 트리로 **서버 프리페치 / 클라이언트** 결정 → 화면별 확정표에 한 줄 추가
   - `§10` 표로 **상태 소유권** 결정: URL `searchParams` / React Query / Zustand / `useState`
   - 필터가 있으면 **searchParams 키·배열 인코딩·기본값 생략**을 확정하고 `src/lib/url/<domain>-filters.ts` 를 계획
   - `api-integration-guide.md` §7 표에서 **`staleTime`/`gcTime`/`retry`** 를 고른다. 표에 없는 도메인이면 값과 근거를 제안
   - mutation이 있으면 **invalidate 대상**을 확정

6. **컴포넌트 스켈레톤**
   ```text
   app/(main)/<route>/page.tsx          라우팅·조립만
   src/features/<feature>/
     |- <name>-section.tsx              화면 섹션
     |- queries.ts                      React Query key / hook / invalidate
     \- <name>.test.ts                  렌더 분기 테스트
   src/lib/api/<domain>.ts              경로·파라미터·응답 타입
   src/lib/<pure>/…                     순수 로직 (테스트 대상)
   src/types/<domain>.ts                응답 타입
   ```
   - 재사용할 공통 컴포넌트를 먼저 나열한다 (`styling-guide.md` §2). 새로 만들 것은 이유를 적는다

7. **상태 / 에러 설계 (4개 모두)**
   | 상태 | 컴포넌트 | 재시도 |
   |------|----------|--------|
   | loading | `Skeleton` | — |
   | 데이터 부재 (404) | `EmptyState` | **없음** |
   | 일시 장애 (5xx) | `ErrorState` | **있음** |
   | nullable 섹션 | 숨김 | — |
   - 폴링이 있으면 종료 조건을 명시한다
   - **문구(카피)를 여기서 확정한다.** 구현 중 즉흥 작성 금지

8. **테스트 계획** (`testing-guide.md`)
   - 이 화면에서 뽑아낼 **순수 함수** 목록 (`src/lib/**`) — TDD 대상
   - 렌더 분기 테스트: **404에 재시도 버튼 없음 / 5xx에 있음** 은 필수
   - 필요한 fixture (`src/test/fixtures/`) 와 Swagger 확인 여부

9. **검증 계획**
   - `pnpm verify && pnpm format:check`
   - 375 / 768 / desktop 확인
   - 필요한 서브에이전트 (`team-playbook.md`): `fe-api-contract` / `fe-design-reviewer` / `fe-map-reviewer`
   - `screen-inventory.md` 상태 갱신

## Output Format

```text
FE FEATURE BOOTSTRAP
====================

Target: [화면/기능]
착수 가능: [예 / 아니오 — 아니오면 이유와 BE 선행 항목]

Responsibility:
- In:  ...
- Out: ...

APIs (Swagger 확인: [URL] / [일시] 또는 미확인):
- METHOD /api/v1/...
- auth: ...
- 주의: 문자열 ID / nullable / enum metadata / 단위

Route / Boundary:
- 경로: ... (route group: ...)
- PROTECTED_PATHS 등록: 예/아니오
- server/client: ...

Fetch / State Decision:
- 초기 데이터: 서버 프리페치 / 클라이언트 (근거: §9 결정 트리)
- 상태 소유권: URL(...) / React Query(...) / Zustand(...) / useState(...)
- searchParams 키: ...
- staleTime / gcTime / retry: ...
- invalidate: ...

Component Skeleton:
- ...
- 재사용: ...
- 신규 공통 컴포넌트: ... (이유)

State / Copy:
- loading: ...
- 404: ... (문구 확정)
- 5xx: ... (문구 확정)
- nullable: 숨김 대상 ...

Test Plan:
- 순수 함수 (TDD): ...
- 렌더 분기: 404 / 5xx 필수
- fixture: ...

Verification Plan:
- pnpm verify && pnpm format:check
- 375 / 768 / desktop
- 서브에이전트: ...
```
