# Frontend Docs

## 목적

- 이 디렉터리는 `hondigagae/frontend` 작업의 기준 문서 모음이다.
- FE 공통 규칙, 백엔드 계약 연동 방식, 화면 현황, 완료 기준을 문서로 관리한다.
- `frontend/AGENTS.md`, `frontend/CLAUDE.md`는 이 문서들의 엔트리 역할만 수행한다.

## 문서 구성

- `architecture-guide.md`
  - App Router 디렉터리 규약, server/client 컴포넌트 경계, 데이터 페칭 계층, BFF 프록시 구조
- `coding-conventions.md`
  - 네이밍, 파일 배치, import 순서, 타입 규칙, 금지 패턴
- `api-integration-guide.md`
  - `Response<T>` 판별, 에러 HTTP 분기, `SliceResponse` 무한 스크롤, 비동기 job 폴링, React Query 규약
- `auth-guide.md`
  - 로그인·소셜 2-step 흐름, 토큰 보관 위치, 재발급 규칙, 보호 경로
- `styling-guide.md` (+ `../DESIGN.md`)
  - `DESIGN.md` = 토큰 단일 정본. 이 문서는 적용 규칙과 공통 컴포넌트 목록
- `component-guide.md`
  - 컴포넌트 계약: prop 네이밍, variant/size 표준 집합, `className` 정책, 합성 기준, 접근성 계약
- `external-api-guide.md`
  - 카카오 지도 SDK 로딩·키 관리·마커/경로 렌더 규약
- `tooling-guide.md`
  - ESLint / Prettier / tsconfig / env 검증 / next.config / git 훅 / CI 스펙. **규약을 설정으로 강제하는 층**
- `testing-guide.md`
  - vitest(node 환경) 방식, fixture 전략, TDD 적용 범위, 첫 테스트 목록
- `local-run-guide.md`
  - 로컬 기동 절차, 포트, `.env.local` 항목, 자주 겪는 문제
- `done-checklist.md`
  - 기능 단위 완료 기준과 QA 체크리스트
- `team-playbook.md`
  - 큰 작업에서 FE 에이전트 역할 분리와 검증 흐름 기준
- `screen-inventory.md`
  - 화면별 담당 API, 상태(기획/구현/보류), 착수 가능 여부
- `features/_index.md`, `features/<feature>/*.md`
  - 기능별 명세 정본
- `fe-foundation-spec.md`
  - FE 기반(문서·에이전트·워크플로우) 구축 명세 및 결정 기록

## 권장 읽기 순서

1. `../CLAUDE.md` 또는 `../AGENTS.md`
2. `README.md`
3. `local-run-guide.md` (처음 띄워볼 때)
4. `architecture-guide.md`
5. `coding-conventions.md`
6. `api-integration-guide.md`
7. `auth-guide.md`
8. `../DESIGN.md`, `styling-guide.md`, `component-guide.md`
9. `external-api-guide.md` (지도 작업 시)
10. `tooling-guide.md` (설정 변경 시)
11. `testing-guide.md`
12. `done-checklist.md`
13. `screen-inventory.md`
14. 필요 시 `features/*`

## 현재 작업 원칙

- **백엔드는 스캐폴딩 단계다.** 구현된 API 영역만 화면을 만든다 (`screen-inventory.md` 기준).
- **AI 기능 10종은 후보 상태다.** 선정 전 기능의 화면은 만들지 않는다 (루트 `README.md` 참고).
- 계약은 추측하지 않는다. **정본은 로컬 기동 중 Swagger** (`http://localhost:8000/swagger-ui.html`).
- 새 기능 구현 전에 화면 책임, 사용 API, 상태(loading/empty/404/5xx), 문구부터 명세로 확정한다.
- 코드 변경과 문서 변경은 같이 움직인다.
- 문서는 추상 지침만 적지 않고 현재 구현 패턴을 예시로 포함한다.

## 백엔드 계약 요약

세부는 `api-integration-guide.md`. 정본은 Swagger이며, 서술 문서는 `backend/docs/api-design-guide.md`.

| 항목 | 값 |
|------|-----|
| 게이트웨이 | `http://localhost:8000` (dev `6000`, prod `9000`) |
| 통합 Swagger | `http://localhost:8000/swagger-ui.html` |
| 공통 래퍼 | `{dataHeader:{success,resultCode,resultMessage}, dataBody}` |
| 목록 | `SliceResponse<T> = {contents, hasNext}` 커서 기반 |
| 에러 | HTTP 상태로 분기. `resultCode` 는 `{도메인}_{번호}` |

## 스킬 사용 예시

Claude Code는 `/스킬명`(`.claude/skills/*`)으로 호출한다.

- `/fe-feature-bootstrap`: 새 화면/기능 착수 가이드
- `/fe-api-check`: FE 호출부 ↔ Swagger 계약 대조
- `/fe-boundary-guard`: server/client 경계·데이터 페칭 계층 점검
- `/fe-multi-agent`: 큰 작업을 역할별로 나눠 설계/구현/검증
- `/issue`, `/pr`, `/mr`: 이슈/PR/MR 초안 작성

서브에이전트는 `team-playbook.md` 참고.
