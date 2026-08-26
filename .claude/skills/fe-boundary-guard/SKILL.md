---
name: fe-boundary-guard
description: 혼디가개 프론트엔드의 server/client 컴포넌트 경계와 데이터 페칭 계층 누수를 점검한다. SSR 오류, 토큰 노출, effect cleanup 누락, 계층 역참조가 의심될 때 사용한다.
---

# FE Boundary Guard

App Router 경계 파손과 계층 누수를 막는 스킬. 백엔드 `/hexagonal-guard` 의 FE 대응이다.

## When to Use

- SSR 오류(`window is not defined` 등)가 났을 때
- 아키텍처 리뷰나 구조 리팩터링 요청이 있을 때
- 토큰·세션이 클라이언트로 새는지 확인할 때
- 지도·차트 등 브라우저 전용 SDK를 도입했을 때

## Read First

1. [frontend/docs/architecture-guide.md](../../../frontend/docs/architecture-guide.md)
2. [frontend/docs/auth-guide.md](../../../frontend/docs/auth-guide.md)
3. [frontend/docs/coding-conventions.md](../../../frontend/docs/coding-conventions.md)

## 점검 항목

### 1. server / client 경계

```bash
grep -rn "localStorage\|sessionStorage\|window\.\|document\.\|navigator\." frontend/src frontend/app
```

- module scope / 컴포넌트 body 최상단 접근 → **위반**
- 해당 파일에 `'use client'` 가 있는가
- 브라우저 전용 SDK가 `dynamic(..., {ssr:false})` 없이 임포트되는가

### 2. 토큰 / 세션 누수

```bash
grep -rn "accessToken\|refreshToken\|Authorization" frontend/src frontend/app
```

- 토큰이 `localStorage`/`sessionStorage`/Zustand에 저장되는가 → **위반**
- 서버 전용 모듈(`src/lib/auth/`)에 `import 'server-only'` 가 있는가
- 그 모듈이 client component에서 임포트되는가

### 3. BFF 우회

```bash
grep -rn "localhost:8000\|api/v1\|BACKEND_BASE_URL" frontend/src frontend/app
```

- 클라이언트 코드가 게이트웨이를 직접 부르는가 → **위반**
- `src/lib/api/client.ts` 의 baseURL이 `/api/bff` 인가
- `BACKEND_BASE_URL` 이 `NEXT_PUBLIC_` 접두사를 갖는가 → **위반**

### 4. 응답 래퍼 판별

```bash
grep -rn "dataBody" frontend/src frontend/app
```

- `response.ts` 를 경유하지 않고 `dataBody` 를 바로 쓰는 곳이 있는가

### 5. effect cleanup

```bash
grep -rn "addEventListener\|setInterval\|setTimeout\|addListener" frontend/src frontend/app
```

- 각 effect에 대응하는 cleanup(`return () => ...`)이 있는가
- 지도 마커·오버레이가 `setMap(null)` 로 정리되는가
- 폴링 `refetchInterval` 이 완료·실패 시 멈추는가

### 6. 계층 의존 방향

```text
app/  →  src/features/  →  src/components/, src/lib/, src/types/
```

- `src/lib/` 가 `src/features/` 를 임포트하는가 → **역참조 위반**
- `src/components/` (공통 UI)가 feature를 임포트하는가 → **위반**
- feature 간 직접 임포트가 있는가
- 컴포넌트가 `fetch` 를 직접 호출하는가

### 7. 상태 소유권 (근거: `architecture-guide.md` §10)

```bash
grep -rn "create(\|useStore\|zustand" frontend/src
grep -rn "useSearchParams\|searchParams" frontend/src frontend/app
```

- 필터·정렬·탭이 Zustand·`useState` 에 있는가 → **URL `searchParams` 여야 한다**
- 서버 데이터(places/plans/pets/me)가 Zustand에 복사됐는가 → React Query가 유일한 서버 캐시
- Zustand store가 단일 전역 store인가 → 도메인별로 나눈다
- 파생 값을 저장하는가 → 계산해서 쓴다

### 8. 서버 프리페치 (근거: `architecture-guide.md` §9)

```bash
grep -rn "QueryClient\|HydrationBoundary\|initialData\|prefetch" frontend/src frontend/app
```

- **모듈 스코프에 `new QueryClient()` 가 있는가** → 요청 간 사용자 데이터 유출. 최우선
- `initialData` 를 쓰는가 → `HydrationBoundary` 로 통일
- 서버 컴포넌트가 `/api/bff` 를 부르는가 → `server.ts` 로 게이트웨이 직접 호출
- 서버·클라이언트 query key가 같은 팩토리에서 오는가

### 9. 라우팅

- `react-router-dom` 임포트가 있는가 → **위반**
- 보호 화면이 `proxy.ts` `PROTECTED_PATHS` 에 등록됐는가
- `NextResponse.redirect(req.nextUrl…)` 를 쓰는가 → standalone에서 깨진다

## lint가 이미 막는 것 / 이 스킬이 잡는 것

`tooling-guide.md` §5의 ESLint 설정이 아래를 자동으로 막는다. **lint가 통과했는데도 이 스킬을 쓰는 이유는 나머지를 잡기 위해서다.**

| 자동 (lint) | 수동 (이 스킬) |
|---|---|
| `react-router-dom` 임포트 | module scope 브라우저 API 접근 |
| `lib`/`components` → `features` 역참조 | effect cleanup 누락 |
| `localStorage`/`sessionStorage` 사용 | 토큰이 Zustand·서버 세션 경계를 넘는지 |
| 컴포넌트의 `fetch` 직접 호출 | `dataBody` 직접 사용 |
| `any` | `dynamic(..., {ssr:false})` 누락 |

**lint 통과 여부를 먼저 확인한다.** 실패하면 그것부터 보고하고, 통과 상태에서 수동 항목을 본다.

```bash
cd frontend && pnpm lint
```

## Output Format

```text
FE BOUNDARY GUARD
=================

점검 범위: [경로]

위반 (심각도 순):
1. 위치   : frontend/src/...:행
   항목   : [경계/누수/역참조/cleanup]
   문제   : ...
   영향   : ... (SSR 실패 / 토큰 노출 / 메모리 누수)
   수정 방향: ...

정상 확인:
- [항목별로 확인했고 문제 없는 것]

미확인:
- [...]
```
