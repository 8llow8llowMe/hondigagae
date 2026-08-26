# 혼디가개 Frontend

혼디가개 웹 프론트엔드 워크스페이스.

## 문서 엔트리

**작업 시작 전에 [CLAUDE.md](CLAUDE.md) 또는 [AGENTS.md](AGENTS.md) 를 먼저 읽는다.**
규칙 정본은 [docs/](docs/README.md) 와 [DESIGN.md](DESIGN.md) 다.

## 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | Next.js (App Router) + TypeScript |
| 패키지 매니저 | pnpm |
| 스타일링 | Tailwind CSS (토큰 정본: `DESIGN.md`) |
| 서버 상태 | React Query |
| 클라이언트 상태 | Zustand |
| 지도 | 카카오 지도 SDK |
| 테스트 | Vitest (`environment: node`) |

선정 근거는 [docs/architecture-guide.md](docs/architecture-guide.md) §1.

## 백엔드 연동

- 브라우저는 백엔드를 직접 부르지 않는다. **`/api/bff` 프록시 경유** ([docs/architecture-guide.md](docs/architecture-guide.md) §5).
- 공통 응답 래퍼는 `Response<T>` (`dataHeader` / `dataBody`) 구조다.
- 계약 정본은 **로컬 기동 중 Swagger** (`http://localhost:8000/swagger-ui.html`). 서술 문서는 [backend/docs](../backend/docs/README.md).
- 세부 규약: [docs/api-integration-guide.md](docs/api-integration-guide.md), [docs/auth-guide.md](docs/auth-guide.md)

## 화면 현황

착수 가능 범위와 대기 항목은 [docs/screen-inventory.md](docs/screen-inventory.md) 가 단일 기준이다.

- **착수 가능**: 인증/회원, 반려견 프로필, 장소 탐색, 여행 일정, AI 일정 생성(골격)
- **대기**: 산책 코스, 여행 적합도, 긴급 동물병원, 여행 후기, 일정 공유, AI 상담사/비서, 성향 분석

> AI 기능 10종은 후보 상태이며 선정 전이다 (루트 [README.md](../README.md)).
> **선정되지 않은 기능의 화면은 만들지 않는다.**

## 로컬 실행

프로젝트 부트스트랩 전이다. 절차는 [docs/local-run-guide.md](docs/local-run-guide.md).

## 작업 방식

- 4단계 워크플로우(Specify → Plan → Tasks → Decisions) + superpowers 스킬
- 스킬: `/fe-feature-bootstrap`, `/fe-api-check`, `/fe-boundary-guard`, `/fe-multi-agent`, `/issue`, `/pr`, `/mr`
- 서브에이전트 7종: [docs/team-playbook.md](docs/team-playbook.md)
- 완료 기준: [docs/done-checklist.md](docs/done-checklist.md)
- 기반 구축 명세·결정 기록: [docs/fe-foundation-spec.md](docs/fe-foundation-spec.md)
