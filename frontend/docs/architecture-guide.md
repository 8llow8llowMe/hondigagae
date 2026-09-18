# Frontend Architecture Guide

## 1. 스택

| 항목            | 선택                                  | 근거                                                                                        |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| 프레임워크      | Next.js (App Router) + TypeScript     | 서버 컴포넌트로 토큰을 서버에 봉인, SEO                                                     |
| 패키지 매니저   | pnpm                                  | 워크트리 다중 체크아웃, 디스크 효율                                                         |
| 스타일링        | Tailwind CSS                          | RSC 마찰 0, 런타임 0. styled-components는 모든 스타일 컴포넌트에 `"use client"` 를 강제한다 |
| 서버 상태       | React Query (`@tanstack/react-query`) | `SliceResponse` 무한 스크롤(`useInfiniteQuery`) + AI job 폴링(`refetchInterval`)            |
| 클라이언트 상태 | Zustand                               | 세션 파생값만 얕게                                                                          |
| 지도            | 카카오 지도 SDK                       | `external-api-guide.md`                                                                     |
| 테스트          | Vitest (`environment: node`)          | `testing-guide.md`                                                                          |

## 2. 디렉터리 구조

```text
frontend/
├── app/
│   ├── (main)/                 헤더·푸터 있는 경로
│   ├── (auth)/                 로그인·회원가입 (헤더 없음)
│   ├── api/bff/[...path]/route.ts   백엔드 프록시 (catch-all)
│   ├── layout.tsx
│   └── globals.css
├── proxy.ts                    보호 경로 가드 (PROTECTED_PATHS). Next 16 에서 middleware.ts 를 대체
├── src/
│   ├── components/             공통 UI (button, card, input, tab, badge, modal, empty-state, skeleton)
│   ├── features/<feature>/     기능별 컴포넌트·훅·쿼리 (place, plan, pet, auth, ai-plan)
│   ├── lib/
│   │   ├── api/                client.ts, response.ts, <domain>.ts
│   │   ├── auth/               세션·토큰 (서버 전용, import 'server-only')
│   │   ├── http/               redirect 등
│   │   └── format/             거리·기온·시간·금액 포맷
│   ├── types/                  API 응답 타입
│   └── styles/                 토큰 (DESIGN.md 대응 CSS 변수)
├── public/
├── docs/
├── _DocumentTemplates/
└── DESIGN.md
```

**배치 규칙**

- `app/` 에는 라우팅·레이아웃·페이지 조립만 둔다. 화면 로직은 `src/features/` 로 뺀다.
- 2개 이상 feature가 쓰면 `src/components/` 또는 `src/lib/` 로 올린다. 1개 feature 전용이면 feature 안에 둔다.
- **순수 로직은 `src/lib/` 하위로 뽑는다.** 테스트 가능성이 여기서 결정된다.

## 3. 의존 방향 (역참조 금지)

```text
app/  →  src/features/  →  src/components/, src/lib/, src/types/
```

- `src/lib/` 는 `src/features/` 를 임포트하지 않는다.
- `src/components/` (공통 UI)는 feature를 임포트하지 않는다.
- feature 간 직접 임포트를 피한다. 공유가 필요하면 `src/lib/` 또는 `src/components/` 로 올린다.

## 4. server / client 컴포넌트 경계

### client component로 시작해야 하는 조건

아래 중 **하나라도** 쓰면 파일 최상단에 `'use client'`.

- `window` / `document` / `localStorage` / `sessionStorage` / `navigator`
- React hook (`useState`, `useEffect`, `useRef`, ...)
- Zustand store, React Query hook
- 카카오 지도 SDK, 차트 라이브러리
- 이벤트 핸들러(`onClick`, `onChange`) 부착

### 금지 패턴

```ts
// 금지 — module scope에서 브라우저 API를 읽는다. SSR에서 터진다.
const token = localStorage.getItem('token')

// 금지 — 컴포넌트 body 최상단도 동일하다.
export function Foo() {
  const w = window.innerWidth
}
```

```ts
// 허용 — helper / guard / effect 안으로
function readWidth() {
  if (typeof window === 'undefined') return null
  return window.innerWidth
}

useEffect(() => {
  const onResize = () => setWidth(window.innerWidth)
  window.addEventListener('resize', onResize)
  return () => window.removeEventListener('resize', onResize) // cleanup 필수
}, [])
```

### SSR에서 깨지는 SDK

```ts
const MapView = dynamic(() => import('@/features/place/map-view'), { ssr: false })
```

카카오 지도는 반드시 이 형태. 세부는 `external-api-guide.md`.

### 서버 전용 모듈 잠금

토큰·세션을 다루는 모듈은 최상단에 `import 'server-only'` 를 둔다. 클라이언트에서 임포트되면 빌드가 실패해 사고를 사전에 막는다.

## 5. BFF 프록시

```text
브라우저 → /api/bff/{path} → app/api/bff/[...path]/route.ts → http://localhost:8000/api/v1/{path}
```

- **브라우저는 게이트웨이를 직접 부르지 않는다.** `src/lib/api/client.ts` 의 baseURL은 `/api/bff` 이며 바꾸지 않는다.
- 프록시가 서버 세션의 access token을 `Authorization` 헤더로 주입한다. 클라이언트 코드는 토큰을 모른다.
- 게이트웨이가 내려주는 `Set-Cookie`(refresh)는 프록시가 흡수하고, 브라우저에는 같은 오리진 세션 쿠키만 남는다.
- **FE 코드의 `/places/...` 는 실제로는 `/api/v1/places/...` 다.** 계약 대조 시 이 매핑을 적용한다.
- 본문은 **형태 그대로** 통과한다 — JSON 도, `multipart/form-data`(파일 업로드)도, SSE 도. 아래 참고.

**왜 BFF인가**

- access token이 응답 body로 온다 → 클라이언트에 두면 XSS 노출면이 생긴다.
- refresh가 HttpOnly 쿠키다 → 크로스 오리진 쿠키(`SameSite`/도메인) 문제를 같은 오리진으로 흡수한다.
- 게이트웨이 CORS는 로컬 출처로 `localhost:5174` 하나만 허용한다 (3000·5173 은 목록에서 빠졌다). `pnpm dev:alt` 포트라면 직접 호출도 가능하지만, 토큰 보관 책임을 FE가 떠안게 된다.

### BFF는 브라우저 헤더를 그대로 전달하지 않는다

프록시는 필요한 헤더(`Accept`, `Content-Type`, `Authorization`, `Cookie`)만 **새로 구성해서** 보낸다.
브라우저 요청 헤더를 통째로 포워딩하지 않는다.

- **`Origin` 이 붙지 않으므로 게이트웨이 CORS 검사 대상이 아니다.** FE dev 포트를 게이트웨이
  허용 목록에 등록할 필요가 없다.
- 브라우저 헤더를 보존해 전달하도록 "개선"하면, 허용 목록에 없는 오리진에서 **POST만 빈 403**
  이 되어 "조회는 되는데 등록만 안 되는" 형태로 나타난다. `ApiGatewayCorsConfig` 의 주석이
  경고하는 사례가 정확히 이것이다. **헤더 화이트리스트 방식을 유지한다.**
- 게이트웨이 CORS 허용 목록은 **브라우저가 게이트웨이를 직접 부를 때만** 의미가 있다
  (WebSocket 핸드셰이크, Swagger UI). 그런 경로를 새로 만들 때는 BE에 오리진 등록을 요청한다.

### SSE(`text/event-stream`) — **토큰 스트립을 건너뛰는 유일한 경로**

기본 경로는 응답을 통째로 버퍼링한다(`await response.text()` → `stripTokens`). 스트림을 그
경로에 태우면 **작업이 끝난 뒤에야 이벤트가 한꺼번에 도착한다** — 폴링만도 못하다. 그래서
`handleEventStream` 이 따로 있다 ([#91](https://github.com/8llow8llowMe/hondigagae/issues/91)).

- **분기 판정은 요청의 `Accept` 로 한다.** 응답 `Content-Type` 을 보고 갈라지려면 이미 부른
  뒤인데, 스트림 엔드포인트가 `produces = text/event-stream` 이라 BFF 가 고정으로 박는
  `Accept: application/json` 을 그대로 보내면 **406** 이다. 판정은 **완전 일치**여야 한다 —
  `*/*` 를 SSE 로 읽으면 일반 요청이 이 경로로 샌다.
- **통과 경로는 토큰을 스트립하지 않는다.** 프레임마다 파싱해야 하고 그 순간 통과가 아니라
  변환이 된다. **그래서 스트림을 새로 붙일 때마다 응답 본문에 토큰이 실릴 수 있는지 먼저
  따진다** — 실릴 수 있으면 통과시켜서는 안 된다. 현재 통과 대상(작업 상태)은
  `AiPlanJobStatusResponse` 라 토큰이 들어올 자리가 없다.
- **응답이 실제로 SSE 가 아니면 기본 경로로 되돌린다.** 스트림 시작 전 오류(404·401)는 일반
  JSON 으로 오므로, 그대로 흘려보내면 `EventSource` 가 형식 오류로만 끊기고 화면이 이유를
  잃는다. 되돌린 응답은 `stripTokens` 를 태워 규칙을 지킨다.
- **401 재시도는 스트림 시작 전만 한다.** 흐르는 스트림에 새 토큰을 주입할 방법이 없어 중간
  끊김은 클라이언트 폴백(폴링)에 넘긴다. 재발급 성공 시의 세션 갱신(`Set-Cookie`)은
  스트리밍 응답과 함께 정상적으로 나간다 — #91 에서 스텁 게이트웨이로 실측했다.
- **`request.signal` 을 스트림 fetch 에 넘긴다.** 안 넘기면 브라우저가 구독을 닫은 뒤에도
  게이트웨이의 `SseEmitter` 가 남는다.
- 버퍼링 방지 헤더는 `src/lib/api/event-stream.ts` 의 `eventStreamHeaders()` 가 한곳에서
  만든다. `X-Accel-Buffering: no` 가 빠지면 nginx 가 응답을 모아 두어 통과 작업 전체가 무효다.

### 파일 업로드(`multipart/form-data`)

본문을 읽는 책임은 `src/lib/api/forwarded-body.ts` 가 갖는다. 규칙은 셋이다.

- **원본 `Content-Type` 을 그대로 보존한다.** multipart 는 파트 경계(boundary)가 헤더 안에
  있어서, 값을 새로 만들면 게이트웨이의 파싱이 실패한다.
- **본문을 `text()` 로 읽지 않는다.** UTF-8 로 해석되면서 바이너리가 깨진다. `ArrayBuffer` 로 읽는다.
- **스트림이 아니라 버퍼로 들고 있는다.** 401 → reissue 후 원 요청을 재시도할 때 같은 본문을
  다시 보내야 하는데, 스트림은 한 번 흘리면 끝이다. 대가로 업로드가 통째로 메모리에 올라오므로
  **화면이 업로드 전에 크기를 검사한다** (서버 상한 `max-file-size: 5MB` / `max-request-size: 30MB`).

multipart 가 아니면 `Content-Type` 을 `application/json` 으로 고정한다 — 브라우저 클라이언트는
그 둘만 보내고, 그 밖의 타입을 통과시키면 BFF 가 무엇을 넘기는지 모르게 된다.

## 6. 라우팅

- `react-router-dom` 금지. `useRouter` / `usePathname` / `useSearchParams` 를 쓴다.
- 동적 세그먼트는 `[param]`. 예: `app/(main)/places/[placeId]/page.tsx`
- 헤더·푸터 노출 예외는 route group(`(auth)`)으로 처리한다.
- 보호 경로는 `proxy.ts` 의 `PROTECTED_PATHS` 와 실제 화면 목록을 **일치시킨다**. 세부는 `auth-guide.md`.
  (Next 16: `middleware.ts` → `proxy.ts`, 내보내는 함수도 `proxy`, 런타임은 nodejs 고정)
- 같은 오리진 리다이렉트는 `src/lib/http/redirect.ts` 헬퍼를 쓴다. `NextResponse.redirect(req.nextUrl…)` 는 standalone 서버에서 `http://0.0.0.0:3000` 으로 나가 깨진다.

## 7. App Router 상태 파일 규약

`coding-conventions.md` §6이 4개 상태(loading / empty·404 / 5xx / success)를 정의한다. **그 상태를 App Router의 어느 파일에서 처리하는지** 여기서 고정한다. 규칙이 없으면 구현자마다 다르게 만든다.

| 파일 / 컴포넌트       | 담당 범위                     | 어떤 상태                                              |
| --------------------- | ----------------------------- | ------------------------------------------------------ |
| `loading.tsx`         | 라우트 세그먼트 전체 Suspense | **최초 진입** loading                                  |
| `Skeleton` 컴포넌트   | 섹션 내부                     | 재조회·페이지 추가 loading                             |
| `not-found.tsx`       | `notFound()` 호출 시          | **리소스 자체가 없음** (없는 `planId`, 없는 `placeId`) |
| `EmptyState` 컴포넌트 | 섹션 내부                     | **페이지는 유효하고 결과만 0건** (필터 결과 없음)      |
| `ErrorState` 컴포넌트 | 섹션 내부                     | 부분 일시 장애 (5xx). 재시도 버튼                      |
| `error.tsx`           | 세그먼트 렌더 예외            | 예상 못 한 예외. `reset()` 을 재시도 버튼에 연결       |
| `global-error.tsx`    | root layout 예외              | 최후 폴백                                              |

### 판정 규칙

**백엔드 404를 `not-found.tsx` 로 보낼지 `EmptyState` 로 보낼지는 "경로가 가리키는 리소스가 없는가"로 정한다.**

```text
GET /plans/{planId} → 404   →  notFound()      →  not-found.tsx
                                (이 URL 자체가 무효하다)

GET /places?areaCode=39 → 200, contents: []    →  EmptyState
GET /places?... → 404                           →  EmptyState
                                (URL은 유효하고 조건에 맞는 결과가 없다)
```

- 백엔드는 **타인 리소스도 404** 로 응답한다 (`api-integration-guide.md` §3). 상세 조회의 404는 `notFound()` 로 보낸다.
- **`error.tsx` 는 5xx 톤을 쓴다.** 데이터 부재가 여기로 흘러오면 안 된다. `not-found.tsx` 와 `EmptyState` 는 중립 톤이다 (`DESIGN.md` §2).
- `error.tsx` 는 반드시 client component다. `reset` prop을 재시도 버튼에 연결한다.
- `loading.tsx` 를 두면 세그먼트 전체가 대체된다. 부분 로딩이 필요한 화면은 `loading.tsx` 대신 섹션별 `Suspense` + `Skeleton` 을 쓴다.

### `loading.tsx` 는 자식 세그먼트까지 감싼다 (soft 404 주의)

**`loading.tsx` 는 그 세그먼트 **와 모든 하위 세그먼트**를 Suspense 로 감싼다.** 경계가 있으면 응답이
먼저 스트리밍되기 시작하고, 그 뒤에 던진 `notFound()` 는 **not-found UI 는 렌더하지만 HTTP 상태를
바꾸지 못한다.** 200 + not-found 화면, 즉 soft 404 가 된다.

실측 (2026-08-27, `/places/{없는 id}`):

| 상태                                      | 응답                   |
| ----------------------------------------- | ---------------------- |
| `places/loading.tsx` 있음 (자식까지 감쌈) | **200** + not-found UI |
| 없음                                      | **404** + not-found UI |

공개 화면은 크롤러가 없는 리소스를 정상 페이지로 인식하므로 이걸 방치하면 안 된다.

**같은 일이 `/pets` 에서 또 일어났다** ([#563](https://github.com/8llow8llowMe/hondigagae/issues/563), 2026-09-14 실측).
`app/(main)/pets/loading.tsx` 가 자식인 `[petId]` 까지 감싸, `page.tsx` 가 `notFound()` 를
부르는데도 `/pets/{없는 id}` 가 **200** 으로 나갔다. 처방은 같다 — 목록을 `pets/(list)/` 로
옮겼다. **보호 화면이라 크롤러가 못 들어와도 고친다**: 모니터링이 읽는 값이고, 여기서
`loading.tsx` 를 어디에 두는지가 다음 화면의 본보기가 된다.

> 이 규칙은 `loading.tsx` 에만 걸린다. `error.tsx` 는 Error Boundary 라 Suspense 경계를
> 만들지 않는다 — 다만 목록 문구를 쓰는 경계가 상세·등록까지 덮는 것은 별개로 부적절하므로
> `loading.tsx` 와 함께 `(list)` 로 옮긴다.

**규칙**

- **`notFound()` 를 쓰는 세그먼트의 조상에 `loading.tsx` 를 두지 않는다.**
- 형제 라우트에만 `loading.tsx` 가 필요하면 **route group 으로 스코프를 좁힌다.**
  `places/loading.tsx` → `places/(list)/loading.tsx` 로 옮기면 `places/[placeId]` 는 감싸지지 않는다.
  URL 은 그대로다.
- 그 대가로 상세 화면은 최초 진입 스켈레톤이 없다. 서버 프리페치가 `retry: false` 라 실패해도 즉시
  넘어가므로 체감 지연이 작고, **상태 코드 정확성을 우선한다.**

- **AI 일정 생성 대기는 `loading.tsx` 가 아니다.** 폴링 중 상태이므로 화면 안에서 진행 표시를 렌더한다 (`api-integration-guide.md` §5).

### 404 가 아닌 상태 코드는 `proxy.ts` 가 낸다 ([#563](https://github.com/8llow8llowMe/hondigagae/issues/563))

`notFound()` 는 **404 하나만** 낼 수 있고, server component 에는 상태 코드를 정하는 다른
수단이 없다. 그런데 404 가 답이 아닌 경우가 있다 — `/places/abc` 는 컨트롤러가
`@PathVariable long` 이라 답이 **400**(`PLACE_113`)으로 정해져 있다 (`screen-inventory.md` §3).
화면은 그 400 을 구분해 `요청 조건이 올바르지 않아요` 를 그리는데 **응답만 200** 으로 나갔다.

**규칙**

- 404 가 아닌 상태 코드가 필요하면 `proxy.ts` 에서 **같은 주소로 `rewrite` 하며 상태만
  바꾼다.** `NextResponse.rewrite(request.nextUrl, { status })` 는 페이지를 정상적으로
  렌더하고 코드만 교체한다 (Next 16 실측).
- `redirect` 도 `new Response(...)` 도 쓰지 않는다 — 둘 다 사용자가 보던 화면을 잃는다.
- **판정 함수를 베끼지 않는다.** 화면과 같은 함수(`isPlaceId`)를 임포트한다. 두 벌이 되면
  게이트와 화면이 갈린다.
- 공개 경로를 이 목적으로 `config.matcher` 에 넣어도 **보호 판정은 `PROTECTED_PATHS` 가
  따로 본다** — 매처에 있다고 로그인을 요구하지 않는다.

### `generateMetadata` 의 실패 문구는 본문과 같은 판정을 쓴다 ([#206](https://github.com/8llow8llowMe/hondigagae/issues/206))

`generateMetadata` 는 본문과 **다른 try/catch** 를 갖는다. 그래서 catch 를 뭉개면 같은 요청의
`<title>` 과 `h1` 이 서로 다른 말을 한다 — dev `/places/abc` 에서 관측했다:

```text
h1     요청 조건이 올바르지 않아요      (본문이 400 을 구분했다)
title  장소를 찾을 수 없어요            (catch 가 404 문구로 뭉갰다)
```

`@PathVariable long` 이라 숫자가 아닌 id 는 404 가 아니라 **400** 이다.

**규칙**

- **`catch {}` 로 버리지 않고 `catch (error)` 로 받아 `classify()` 를 태운다.** 본문이 종류를
  구분한다면 제목도 구분해야 한다.
- **5xx·무응답에는 아무것도 단정하지 않는다.** 일시 장애라 클라이언트 재조회가 성공할 수
  있고, 그러면 실제 리소스가 그려진 화면의 탭에 "찾을 수 없어요" 가 남는다. 본문의 5xx
  문구도 쓰지 않는다 — 그쪽은 그 순간 실패한 영역을 가리키지만 **탭 제목은 페이지가 살아난
  뒤에도 남는다.** 판정하지 않는 목록 제목으로 떨어뜨린다.
- **판정을 순수 함수로 뽑는다.** async server component 는 `renderToStaticMarkup` 으로
  렌더되지 않아 라우트 안에 두면 테스트할 수 없다 (`testing-guide.md` §1).
  선례: `src/lib/place/detail-title.ts`.

### `not-found.tsx` 는 자기 탭 제목을 스스로 갖는다 ([#676](https://github.com/8llow8llowMe/hondigagae/issues/676))

> **여기에 쓰는 이유.** 404 탭 제목은 화면 하나의 사양이 아니라 `not-found.tsx` **넷에
> 공통으로 걸리는 규약**이고, 바로 위 #206 절이 이미 "탭 제목은 본문과 같은 말을 쓴다" 를
> 정하고 있다. 화면 단위 세부명세를 새로 파면 같은 규칙이 네 군데로 흩어진다.

**실측 (2026-09-18, `dev.hondigagae.com`)**

`<title>` 은 스트리밍 뒤에 교체된다 — 아래 `측정` 열의 근거는 각 응답의 **flight 청크**에
실린 `["$","title","0",{children:…}]` 값이다 (`curl` + `\uXXXX` 디코드).

| 라우트               | 렌더되는 `not-found.tsx`            | 탭 제목                            | 본문 `h1`                    | 측정        | 판정       |
| -------------------- | ----------------------------------- | ---------------------------------- | ---------------------------- | ----------- | ---------- |
| `/zzz-no-such-route` | `app/not-found.tsx`                 | **`혼디가개`**                     | `없는 주소예요`              | dev 실측    | **결함**   |
| `/places/{없는 id}`  | `(main)/places/[placeId]/not-found` | `장소를 찾을 수 없어요 · 혼디가개` | `장소를 찾을 수 없어요`      | dev 실측    | 정상       |
| `/plans/{없는 id}`   | `(main)/plans/[planId]/not-found`   | **`혼디가개`**                     | `찾을 수 없는 일정이에요`    | 소스 도출\* | **결함**   |
| `/pets/{없는 id}`    | `(main)/pets/[petId]/not-found`     | **`반려견 정보 수정 · 혼디가개`**  | `존재하지 않는 반려견이에요` | 소스 도출\* | **어긋남** |

\* `/plans` · `/pets` 는 `proxy.ts` 의 `PROTECTED_PATHS` 라 **미로그인 `curl` 이
`/login?returnTo=` 로 튕겨 실측하지 못했다.** 값은 소스에서 도출했다 —
`plans/[planId]/page.tsx` 는 `generateMetadata` 도 `export const metadata` 도 없고(주석에
"제목 하나를 위해 백엔드를 한 번 더 부를 이유가 없다" 로 명시), `pets/[petId]/page.tsx` 는
정상 화면용 `metadata`(`pet.editTitle`) 하나만 갖는다. 구현 시 로그인 상태에서 확인한다.

**`not-found.tsx` 넷 중 자기 `metadata` 를 가진 것은 0개다.** 지금 맞는 것은 `places` 뿐이고,
그것도 `page.tsx` 의 `generateMetadata` catch 갈래(#206)가 대신 내주는 것이다.

**`title.template` 은 없다.** 루트 레이아웃(`app/layout.tsx`)의 `title` 은 평문
`'혼디가개'` 이고 저장소 어디에도 `title.template` 선언이 없다. 접미사는 **각 호출부가
직접 붙인다** (`` `${...} · 혼디가개` ``, 구분자는 U+00B7 MIDDLE DOT 양옆 한 칸). 세그먼트
404 와 같은 모양을 내려면 전역 404 도 같은 방식으로 리터럴을 쓴다.

**구현 실측 (2026-09-18, 이 워크트리) — 전제가 절반만 맞았다.**

`metadata` 를 `not-found.tsx` 에 두는 것이 Next 16 에서 실제로 먹는지는 Playwright로
(dev 서버 + `MOCK_API=true`, 하이드레이션 뒤 `expect(page).toHaveTitle(...)`) 확인했다 —
**세 파일에 똑같이 두었는데 결과가 갈렸다.**

- **`app/not-found.tsx`(전역) — 먹는다.** 이 라우트는 애초에 매칭되는 `page.tsx` 가 없어
  Next 가 처음부터 error 모드로 메타데이터를 만든다. 자기 `metadata` 를 그대로 쓴다.
- **`(main)/plans/[planId]/not-found.tsx` · `(main)/pets/[petId]/not-found.tsx` — 안 먹는다.**
  두 세그먼트는 `page.tsx` 가 **비동기 조회 뒤 조건부로** `notFound()` 를 던진다. Next 16 은
  이 경우 `page.tsx`(또는 조상)가 **이미 확정해 둔 메타데이터를 그대로 쓰고, 던져진 뒤에도
  형제 `not-found.tsx` 의 `metadata` 로 되돌리지 않는다.** `plans/[planId]/page.tsx` 는
  애초에 metadata 가 없어 루트 레이아웃의 평문 `혼디가개` 그대로 남았고, `pets/[petId]/page.tsx`
  는 자신의 정상 화면용 정적 `metadata`(`pet.editTitle`) 를 그대로 물고 있어 탭이
  "반려견 정보 수정" 으로 남았다 — 이 이슈가 처음 적은 "어긋남" 그 자체다.
  (`next/dist/lib/metadata/resolve-metadata.js` 의 `resolveMetadataItemsImpl` 이 근거다 —
  `errorConvention` 이 넘어와야 `collectMetadata` 가 `not-found` 모듈을 읽는데, 페이지가
  이미 성공을 가정하고 도는 첫 렌더 경로에서는 이 값이 아직 없다.)

**규칙 — 구현 위치가 파일마다 갈린다.**

- **경쟁하는 `page.tsx` 가 없는 전역 404 만 `not-found.tsx` 가 `export const metadata` 를
  갖는다** (`app/not-found.tsx`). 부모의 제목을 물려받게 두지 않는다 — 물려받으면
  서비스명만 남는다.
- **`page.tsx` 가 조건부로 `notFound()` 를 던지는 세그먼트(`plans` · `pets`)는 그 `page.tsx`
  자신의 `generateMetadata` 가 404 제목을 정한다.** `not-found.tsx` 에는 두지 않는다 —
  죽은 코드가 된다. `places/[placeId]/page.tsx`(#206)와 같은 자리다.
- **판정 로직은 `generateMetadata` 밖으로 뽑는다.** async server component 는
  `renderToStaticMarkup` 으로 렌더되지 않아 함수 안에 두면 테스트할 수 없다
  (`testing-guide.md` §1). 선례 `src/lib/place/detail-title.ts` 를 따라
  `src/lib/plan/detail-title.ts`(`planDetailNotFoundTitle`) ·
  `src/lib/pet/detail-title.ts`(`petEditPageTitle`) 로 뽑는다.
- **백엔드를 두 번 부르지 않는다.** `generateMetadata` 와 페이지 렌더가 같은 요청 안에서
  쓰는 조회를 `cache()`(React) 로 감싸 하나로 합친다 — `places` 가 이미 쓰는 패턴
  (`loadPlaceDetail`)을 `plans`(`loadPlanDetail`) · `pets`(`loadPet`)에도 그대로 쓴다.
- **404 가 아닌 결과(성공·5xx·무응답)는 이 이슈 전과 같게 둔다.** `plans` 는 여전히 제목이
  없고(부모 상속), `pets` 는 여전히 `pet.editTitle` 이다 — 이 이슈는 **404 탭 제목만** 고친다.
  성공 시 진짜 제목을 붙이는 것은 범위 밖이다 (`plans/[planId]/page.tsx` 가 원래 `generateMetadata`
  를 안 두던 이유 — "보호 화면이라 크롤러가 못 들어오고, 제목 하나를 위해 백엔드를 한 번 더
  부를 이유가 없다" — 는 여기서도 유효하다. 지금은 그 조회를 **다시 하지 않고 재사용**할 뿐이다).
- **제목 문구는 그 화면의 `h1`(또는 `EmptyState`)과 같은 상수를 쓴다.** 새 문자열을 짓지 않는다.
- **접미사는 `` ` · 혼디가개` `` 리터럴이다.** `title.template` 이 없으므로 생략하면 그
  화면만 접미사가 빠진다.

**확정 문구**

| 화면(404)               | 구현 위치                                                    | 결과 문자열                             |
| ----------------------- | ------------------------------------------------------------ | --------------------------------------- |
| `app/not-found.tsx`     | `app/not-found.tsx` 의 `export const metadata`               | `없는 주소예요 · 혼디가개`              |
| `(main)/plans/[planId]` | `page.tsx` 의 `generateMetadata` + `planDetailNotFoundTitle` | `찾을 수 없는 일정이에요 · 혼디가개`    |
| `(main)/pets/[petId]`   | `page.tsx` 의 `generateMetadata` + `petEditPageTitle`        | `존재하지 않는 반려견이에요 · 혼디가개` |

**범위 — 어긋난 둘을 함께 맞춘다.** `app` · `plans` · `pets` 셋을 고치고, **`places` 는
손대지 않는다.** 그쪽은 이미 같은 말이 나오고, `not-found.tsx` 에 또 쓰면 400 갈래까지
가르는 `placeDetailFallbackTitle`(#206) 과 제목의 정본이 둘로 갈린다. 이 비대칭은 의도된
것이다 — `places` 만 `generateMetadata` 가 **404 와 400 을 구분해야** 해서 라우트 경계가
아니라 페이지가 제목을 정한다. `plans` · `pets` 도 결국 같은 자리(`page.tsx`)로 모인 것이라
`places` 와의 비대칭은 "누가 정하는가" 가 아니라 "`not-found.tsx` 자신도 정할 수 있는가" 뿐이다
— 전역만 그렇다.

**검증**

- **로그인 상태에서만 재현된다.** `app/not-found.tsx` 가 잡는 주소라도 `PROTECTED_PATHS`
  아래(`/plans/...` 등)면 미로그인은 `/login?returnTo=` 로 먼저 간다. e2e 는 인증
  `storageState` 로 연다.
- **`<title>` 을 `curl`·`view-source` 로 판정하지 않는다.** 초기 HTML 의 `<head>` 에는 셸
  기본값(`혼디가개`)이 들어 있고 진짜 제목은 스트림 뒤쪽 flight 청크로 와서 React 가
  바꿔 끼운다 — `/places/{없는 id}` 가 원시 HTML 에서는 `혼디가개` 로 보인다.
  **하이드레이션 뒤에 읽는다** (Playwright `expect(page).toHaveTitle(...)`, `e2e/not-found-title.spec.ts`).
- 같은 스펙에서 **HTTP 상태가 404 인지** 함께 본다. 위 `loading.tsx` 절의 soft 404 가
  재발하면 제목만 고쳐도 반쪽이다 (`e2e/resource-status.spec.ts` 가 이미 잡는다).

> **후속 후보 (이번 범위 아님).** 루트 레이아웃에 `title: { default, template: '%s · 혼디가개' }`
> 를 들이면 접미사 리터럴이 20여 곳에서 사라진다. 전 화면의 metadata 를 한 번에 건드리는
> 변경이라 404 수정과 섞지 않는다.

## 8. 데이터 페칭 계층

```text
src/lib/api/<domain>.ts       경로·파라미터·응답 타입 (얇게)
        ↓
src/features/<f>/queries.ts   React Query key / hook / invalidate 규칙
        ↓
src/features/<f>/*.tsx        렌더
```

- 컴포넌트에서 `fetch` 를 직접 호출하지 않는다.
- `src/lib/api/` 는 래퍼 판별(`response.ts`)까지만 하고 UI를 모른다.
- 세부 규약은 `api-integration-guide.md`.

### 클라이언트가 둘이다 (중요)

`src/lib/api/` 에는 **두 개의 전송 계층**이 있고, 호출 주체에 따라 다른 것을 쓴다.

| 파일        | 호출 주체                         | 경로                                   | 잠금                   |
| ----------- | --------------------------------- | -------------------------------------- | ---------------------- |
| `client.ts` | **브라우저**                      | `/api/bff/{path}` → 프록시             | —                      |
| `server.ts` | **서버 컴포넌트 / route handler** | `{BACKEND_API_URL}/api/v1/{path}` 직접 | `import 'server-only'` |

**서버 컴포넌트가 `/api/bff` 를 부르면 안 된다.** 자기 자신을 HTTP로 다시 호출하는 것이라 왕복이 낭비되고, standalone 서버에서는 자기 오리진을 몰라 깨진다. 서버는 게이트웨이를 직접 부르고 세션에서 토큰을 주입한다.

"브라우저는 백엔드를 직접 부르지 않는다"(§5)는 그대로 유효하다. 서버는 브라우저가 아니다.

```ts
// src/lib/api/<domain>.ts — 도메인 함수는 전송 계층을 주입받는다
export function placesPath(filters: PlaceFilters) {
  return `/places?${toQuery(filters)}`
}

// 브라우저:  clientFetch(placesPath(f))
// 서버:      serverFetch(placesPath(f))
```

경로·타입·래퍼 판별은 한 곳에 두고 **전송만 갈린다.** 도메인 함수를 두 벌 만들지 않는다.

## 9. 어디서 데이터를 가져오는가 (서버 vs 클라이언트)

`§4` 는 *어떤 컴포넌트가 client가 되는가*를 정한다. 이 절은 *데이터를 서버에서 가져올지 클라이언트에서 가져올지*를 정한다. **둘은 다른 결정이다.**

### 결정 트리

```text
1. 초기 화면에 보이는 데이터인가?
   아니오 → 클라이언트 (상호작용 후 조회)
   예 ↓

2. 폴링·무한 스크롤로 계속 변하는 데이터인가?
   예 → 클라이언트 (첫 페이지만 서버 프리페치 가능)
   아니오 ↓

3. → 서버 프리페치 (기본값)
```

**기본은 서버 프리페치다.** 서버가 세션·토큰을 이미 갖고 있어 왕복이 하나 줄고, LCP가 개선되고, 공개 화면은 SEO를 얻는다.

### 서버 프리페치 패턴은 하나만 쓴다

```tsx
// app/(main)/places/page.tsx  — server component
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'

export default async function Page({ searchParams }) {
  const filters = parsePlaceFilters(await searchParams)
  const queryClient = getServerQueryClient() // 요청마다 새 인스턴스

  await queryClient.prefetchInfiniteQuery({
    queryKey: placeKeys.list(filters),
    queryFn: () => fetchPlacesOnServer(filters),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlaceListSection />
    </HydrationBoundary>
  )
}
```

- **`HydrationBoundary` 를 표준으로 쓴다. `initialData` 는 쓰지 않는다.** 두 패턴이 섞이면 같은 화면에서 캐시 동작이 갈린다(`initialData` 는 `dataUpdatedAt` 을 서버 시점으로 갖지 못해 즉시 refetch 되거나 반대로 오래 신선해 보인다).
- `getServerQueryClient()` 는 **요청마다 새 인스턴스**를 만든다. 모듈 스코프에 QueryClient를 두면 요청 간에 데이터가 섞인다. 이건 사용자 데이터 유출이다.
- **queryKey가 서버·클라이언트에서 완전히 같아야 한다.** 다르면 프리페치가 버려지고 클라이언트가 다시 조회한다. 그래서 key 팩토리(`api-integration-guide.md` §7)를 양쪽에서 공유한다.
- 프리페치 실패를 화면 전체 실패로 만들지 않는다. 실패하면 클라이언트가 재조회하도록 두고, 치명적인 경우만 `notFound()`/`error.tsx` 로 보낸다.
- **서버 프리페치에는 `retry: false` 를 준다.** 전역 기본값(5xx 2회 재시도)을 그대로 쓰면 백엔드가 느리거나 죽었을 때 **서버 렌더가 재시도 백오프만큼 통째로 블로킹된다.** 실측: 게이트웨이 다운 시 `GET /places` 가 3.1초 → `retry: false` 적용 후 0.03초. 재시도는 클라이언트가 사용자 조작으로 수행한다.

### 화면별 확정표

| 화면             | 초기 데이터                  | 이후                      | 비고                                                                                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 장소 목록        | **서버 프리페치** (1페이지)  | client `useInfiniteQuery` | 공개 화면 → SEO                                                                                                                                                                                                                                                                                              |
| 장소 상세        | **서버 프리페치**            | client                    | 지도만 `ssr:false`, 데이터는 캐시 공유                                                                                                                                                                                                                                                                       |
| 지도 뷰          | 목록 캐시 재사용             | client                    | **첫 화면은 별도 조회 금지.** 사용자가 지도를 옮긴 뒤에만 `/places/nearby` (#14)                                                                                                                                                                                                                             |
| 내 정보          | **서버 프리페치**            | client (mutation)         |                                                                                                                                                                                                                                                                                                              |
| 반려견 목록/상세 | **서버 프리페치**            | client (mutation)         |                                                                                                                                                                                                                                                                                                              |
| 반려견 등록 폼   | 없음                         | client (mutation)         | 폼만. 채울 초기값이 없다                                                                                                                                                                                                                                                                                     |
| 홈               | **서버 프리페치** (3종 병렬) | client                    | 인사이트는 client. 판정이 반려견 조건에 딸린다                                                                                                                                                                                                                                                               |
| 일정 목록        | **서버 프리페치** (1페이지)  | client `useInfiniteQuery` | 필터를 query key 에 넣지 않는다 — 서버 파라미터가 없다                                                                                                                                                                                                                                                       |
| 일정 상세        | **서버 프리페치**            | client                    |                                                                                                                                                                                                                                                                                                              |
| 일정에 장소 담기 | **서버 프리페치** (2종)      | client `useInfiniteQuery` | 일정 상세는 `fetchQuery`+404 판별, 장소는 1페이지                                                                                                                                                                                                                                                            |
| 일정 만들기 폼   | 없음                         | client (mutation)         | 폼만. 반려견 목록만 client 조회                                                                                                                                                                                                                                                                              |
| 일정 편집 폼     | **서버 프리페치** (초기값)   | client                    |                                                                                                                                                                                                                                                                                                              |
| 산책 코스 목록   | **서버 프리페치**            | client `useQuery`         | 공개 화면 → SEO. **커서가 없다**(29개 전량). 활동량 기본값은 **대표견**이라 서버가 `GET /members/me/pets` 를 함께 부른다 — nav 선택견은 `localStorage` 라 서버가 못 읽어 첫 렌더 뒤 29 → 6 으로 줄어드는 것이 보인다 (#618)                                                                                  |
| 산책 코스 상세   | **서버 프리페치**            | client                    | 공개 화면. 골든타임은 client 이고 **좌표가 있는 코스에서만** 부른다 (25/29 가 `lat`/`lng` null)                                                                                                                                                                                                              |
| 긴급 시설        | **없음**                     | client                    | 좌표가 브라우저에만 있어 서버가 무엇을 조회할지 모른다. **지도 이동으로 재조회하지 않는다** — `distanceMeters` 가 지도 중심 기준이 되어 "가까운 순 · 480m" 이 거짓이 된다 (#353). 필터·반경은 **URL 소유**이고 `page.tsx` 는 프리페치가 아니라 **보기 전환 링크를 만들려고** `searchParams` 를 읽는다 (#371) |
| AI 조건 입력     | 없음                         | client                    | 폼만                                                                                                                                                                                                                                                                                                         |
| **AI job 폴링**  | **프리페치 금지**            | client only               | 서버에서 한 번 떠도 즉시 낡는다                                                                                                                                                                                                                                                                              |
| 로그인           | 없음                         | client                    | 폼만. 서버 컴포넌트는 세션 판별만 한다                                                                                                                                                                                                                                                                       |
| 회원가입         | 없음                         | client                    | 폼만. 서버 컴포넌트는 세션 판별만 한다                                                                                                                                                                                                                                                                       |
| 비밀번호 찾기    | 없음                         | client (mutation)         | 폼만. `searchParams` 도 읽지 않는다 — 이메일을 URL 에 싣지 않는다                                                                                                                                                                                                                                            |
| **소셜 콜백**    | **프리페치 금지**            | client only               | `code`·`state` 교환이 1회용이다. 서버에서 한 번 쓰면 브라우저가 다시 쓸 수 없다                                                                                                                                                                                                                              |
| 소셜 가입 동의   | 없음                         | client                    | 체크박스만. 서버 컴포넌트는 **제공자 세그먼트 검증(→404)과 세션 판별**만 한다 (#707)                                                                                                                                                                                                                         |

화면을 추가하면 이 표에 한 줄을 넣는다. 표에 없는 화면은 **결정 트리로 판단하고 표를 갱신한다.**

## 10. 상태 소유권 (어디에 저장하는가)

저장소가 네 개다. **선택 규칙이 없으면 화면마다 다른 곳에 같은 성격의 상태가 생긴다.**

| 저장소                      | 판단 질문                                     | 예                                                          |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| **URL `searchParams`**      | 링크로 공유했을 때 같은 화면이 나와야 하는가? | 장소 필터(지역·타입·반려견 동반), 정렬, 탭                  |
| **React Query**             | 서버가 소유한 데이터인가?                     | places, plans, pets, me, job                                |
| **Zustand**                 | 여러 라우트에 걸친 클라이언트 전용 상태인가?  | 세션 파생값(`memberId`/`isAuthenticated`/`me`), 전역 토스트 |
| **`useState`/`useReducer`** | 한 컴포넌트 트리 안에서 끝나는가?             | 모달 열림, 아코디언, 입력 중 값                             |

### 규칙

- **URL이 기본이다.** 여행 서비스는 링크 공유·뒤로가기·새로고침 유지가 자연스럽게 기대된다. 필터를 Zustand에 두면 공유한 링크가 다른 화면을 보여준다.
- **서버 데이터를 Zustand에 복사하지 않는다.** React Query가 유일한 서버 캐시다. 복사하면 두 캐시가 어긋난다.
- **토큰은 어느 저장소에도 없다.** 서버 세션 전용 (`auth-guide.md` §2).
- Zustand store는 **도메인별로 파일 하나**. 전역 단일 store 금지.
- 파생 값을 저장하지 않는다. 계산해서 쓴다.

### searchParams 직렬화 규약

규약이 없으면 `?type=CAFE&type=FOOD` 와 `?type=CAFE,FOOD` 가 같은 프로젝트에 섞인다.

| 항목    | 규칙                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| 키 이름 | **백엔드 쿼리 파라미터 이름과 동일하게** (`areaCode`, `contentTypeId`). 매핑 레이어를 없앤다                             |
| 배열    | **콤마 구분 단일 키** — `?contentTypeId=12,39`. 반복 키 금지 (`useSearchParams().get()` 이 첫 값만 반환해 조용히 잘린다) |
| 기본값  | **URL에서 생략한다.** 빈 URL = 기본 상태                                                                                 |
| boolean | `true` 일 때만 키를 넣는다. `?petAllowed=true` / 아니면 키 없음                                                          |
| 커서    | **URL에 넣지 않는다.** 무한 스크롤 위치는 공유 대상이 아니다                                                             |
| 읽기    | server: `page.tsx` 의 `searchParams` prop / client: `useSearchParams()`                                                  |
| 쓰기    | `router.replace` 기본 (히스토리 오염 방지). 사용자가 명시적으로 이동한 것(탭 전환)만 `push`                              |

**보기 전환 (`view`) 기본값 — 화면마다 상수로 관리**

`/places` 와 `/emergency` 는 모두 **지도가 기본**이다 (`PLACES_DEFAULT_VIEW` · `EMERGENCY_DEFAULT_VIEW`). 둘을 같은 상수로 두지 않는 것은 의도된 설계다 — 각 화면이 자신의 기본값을 소유해야 한 쪽이 바뀐 뒤에도 다른 쪽이 영향받지 않는다. 긴급 시설은 한때 목록이 기본이었다 — _"급할 때 필요한 것은 위치가 아니라 전화번호"_ 였기 때문이다. 그 근거는 (#353 에서) **두 장치로 옮겨 지켰다**: 모바일 시트가 중간 단계로 열려 첫 화면에 행과 52px 전화 버튼이 이미 보이고, 지도 SDK 가 실패하면 목록 갈래로 되돌린다. **`parseViewMode` 와 `viewModeHref` 는 같은 기본값을 받아야 한다** — 어긋나면 토글이 가리키는 보기와 페이지가 그리는 보기가 달라진다.

**파싱·직렬화는 `src/lib/url/<domain>-filters.ts` 순수 함수 한 곳에 둔다.**

```ts
export function parsePlaceFilters(
  sp: URLSearchParams | Record<string, string | string[]>,
): PlaceFilters
export function toPlaceQuery(filters: PlaceFilters): string

// 긴급 시설 — 조건이 필터 하나가 아니라 「필터 + 조회 파라미터」다
export function parseEmergencyBoardParams(sp: RawParams): EmergencyBoardParams
export function toEmergencyBoardQuery(params: EmergencyBoardParams): string
```

- **round-trip 테스트를 반드시 쓴다**: `parse(toQuery(f))` 가 `f` 와 같아야 한다. 기본값 생략 규칙 때문에 이 테스트가 실제로 버그를 잡는다 (`testing-guide.md`).
- 잘못된 값(범위 밖 `areaCode`, 없는 enum)은 **예외를 던지지 말고 기본값으로 떨어뜨린다.** URL은 사용자가 손으로 고칠 수 있다.
- **파싱된 필터 객체를 그대로 query key에 넣는다.** URL 문자열을 key로 쓰면 파라미터 순서만 달라도 캐시가 갈린다.
- **초기화 대상이 아닌 값은 `filters` 밖에 둔다.** 긴급 시설의 반경이 그렇다 — URL 에는 싣지만(`?radius=40000`) 필터가 아니라 조회 파라미터라 「초기화」가 되돌리지 않는다. `EmergencyBoardParams = { filters, radius }` 가 그 구분을 타입 모양으로 새긴다. 초기화는 `filters` 만 갈아 끼운다.
- **선택지가 유한하면 범위 검사가 아니라 화이트리스트로 받는다.** 긴급 시설 반경은 `RADIUS_OPTIONS`(10/20/40/50km) 밖이면 기본값으로 떨어진다. 백엔드 상한(`@Max(50_000)`)만 보고 통과시키면 `?radius=33333` 이 살아남아 칩은 "33.3km" 인데 반경 시트에는 선택된 항목이 없는 화면이 된다.

**`view` 와 조건을 합치는 것은 `viewModeHref` 한 곳이다 — 지금 이 규칙을 지키는 것은 `/emergency` 뿐이다.**

두 곳이 링크를 만든다 — 서버(`page.tsx` 의 보기 전환 토글)와 클라이언트(조건을 바꿀 때 도는 `router.replace`). **양쪽 다 `viewModeHref(pathname, toXQuery(params), view, 화면기본값)` 을 거쳐야 한다.**

- 토글이 조건을 안 실으면 목록↔지도 전환이 좁힌 조건을 통째로 버린다 (`/emergency` 가 실제로 그랬다 — `viewModeHref('/emergency', '', …)`).
- 조건 변경이 `view` 를 안 실으면 칩을 누를 때마다 지도가 목록으로 튄다.

`/emergency` 는 (#371) `use-emergency-nav.ts` 가 양쪽 다 `viewModeHref` 를 거치도록
고쳐 이 규칙을 지킨다. **`/places` 는 아직 아니다** ([#372](https://github.com/8llow8llowMe/hondigagae/issues/372)) — `use-place-filter-nav.ts` 의
`apply` 는 `pathname` 과 쿼리 문자열만으로 `router.replace` 를 직접 조립하고 `view` 를
싣지 않는다. `PLACES_DEFAULT_VIEW` 가 `'map'` 이므로 `/places?view=list` 에서 필터
칩을 하나만 눌러도 `view=list` 가 URL 에서 빠져 지도로 튄다 — 위 두 번째 항목이 바로
이 화면에서 실제로 일어난다. 코드 수정은 별도 이슈로 분리한다 (이슈 번호 미배정 —
"`/places` 가 `view=list` 를 잃는다"로 검색해 찾는다). 그때까지 이 문단의 "한 곳"은
`/emergency` 에만 참이다.

**프리페치가 없는 화면은 클라이언트 훅이 읽기까지 한다.** `/places` 는 서버 프리페치가 있어 `page.tsx` 가 읽고 `usePlaceFilterNav` 는 쓰기만 하지만, `/emergency` 는 좌표가 브라우저에만 있어 프리페치가 없다(§9). 읽기를 페이지에 두면 지도 → 패널 → 시트로 조건을 prop 으로 꿰야 하고 그 사슬이 끊기면 두 갈래가 다른 조건을 본다. `useEmergencyNav` 가 `useSearchParams()` 로 직접 읽는 이유다.
