# 혼디가개 Frontend Claude Guide

## 목적

- 이 문서는 `frontend/` 작업 시 Claude Code가 먼저 확인하는 요약 엔트리다.
- 실제 규칙의 단일 기준은 `frontend/docs/*.md` 와 `frontend/DESIGN.md` 다.

## 우선 확인 문서

1. `docs/README.md`
2. `docs/local-run-guide.md` (처음 띄워볼 때)
3. `docs/architecture-guide.md`
4. `docs/coding-conventions.md`
5. `docs/api-integration-guide.md`
6. `docs/auth-guide.md`
7. `DESIGN.md`, `docs/styling-guide.md`, `docs/component-guide.md`
8. `docs/tooling-guide.md` (설정·lint·테스트 도구)
9. `docs/testing-guide.md`
10. `docs/done-checklist.md`
11. `docs/screen-inventory.md`

## 절대 규칙 (자주 깨지는 것)

- **백엔드를 브라우저에서 직접 부르지 않는다.** 전부 `/api/bff` 프록시 경유.
- **토큰은 Next 서버만 보관한다.** `localStorage`/`sessionStorage` 금지.
- **`dataHeader.success` 판별을 건너뛰지 않는다.** `dataBody` 를 바로 쓰지 않는다.
- **404에 재시도 버튼을 달지 않는다.** 404는 데이터 부재이고 5xx가 일시 장애다.
- **비동기 AI 작업 실패는 HTTP 200 + `status=FAILED`** 로 온다. `success` 만 보면 놓친다.
- **`memberId` 는 `string`** 이다. ID를 `number` 로 타이핑하지 않는다.
- **서버 enum metadata(`{code,name,description}`)를 그대로 렌더한다.** 한국어 매핑 테이블 금지.
- **백엔드에 없는 API를 부르지 않는다.** 착수 가능 범위는 `docs/screen-inventory.md`.
- **초기 화면 데이터는 서버 프리페치가 기본이다.** 패턴은 `HydrationBoundary` 하나만 쓴다 (`docs/architecture-guide.md` §9).
- **필터·정렬·탭은 URL `searchParams` 에 둔다.** Zustand에 두지 않는다 (`docs/architecture-guide.md` §10).
- **`staleTime` 을 임의로 정하지 않는다.** 도메인별 표준값이 있다 (`docs/api-integration-guide.md` §7).
- **컴포넌트 `className` 으로 외형(색·radius·shadow·padding)을 덮지 않는다.** 레이아웃 유틸리티만 (`docs/component-guide.md` §3).

## 운영 원칙

- `AGENTS.md`, `CLAUDE.md`는 엔트리 문서다.
- 세부 규칙은 `docs/`에 모은다.
- 구현 중 새 규칙이 생기면 엔트리 문서보다 해당 `docs/*.md`를 먼저 갱신한다.
- 기능별 명세는 `docs/features/<feature>/*.md`에 정리한다.
- 코드 변경과 문서 변경은 같이 움직인다.

## 파일 인코딩 규칙 (필수)

- **모든 소스 / 설정 / 문서 파일은 반드시 `UTF-8` (no BOM) 로 저장한다.**
- 루트 `.editorconfig`(`charset = utf-8`, ts/tsx 2-space)와 `.gitattributes`(`*.ts *.tsx *.json *.css` 등 `working-tree-encoding=UTF-8`)가 이미 강제한다. 덮어쓰지 말 것.
- `git status` 에서 수정한 적 없는데 diff가 잡히면 인코딩 문제를 의심한다.
