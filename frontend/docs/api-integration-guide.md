# Frontend API Integration Guide

> **계약 정본은 로컬 기동 중 Swagger다.** `http://localhost:8000/swagger-ui.html`
> 서술 문서는 `backend/docs/api-design-guide.md`, 서비스별 책임은 `backend/docs/service-inventory.md`.
> 이 문서의 내용은 백엔드 코드 실측 기준이며, 충돌하면 Swagger가 이긴다.

## 1. 진입점

| 항목          | 값                                                                                   |
| ------------- | ------------------------------------------------------------------------------------ |
| 게이트웨이    | `http://localhost:8000` (dev `6000`, prod `9000`)                                    |
| FE dev 서버   | `http://localhost:3000`                                                              |
| 라우팅 prefix | `/api/v1/{auth,members,places,walk-courses,emergencies,plans,ai-plans,assistant}/**` |
| BFF 매핑      | `/api/bff/{path}` → `{GATEWAY}/api/v1/{path}`                                        |

서비스 개별 Swagger: auth `8081` / tour `8082` / plan `8083` / ai `8085`

## 2. 공통 응답 래퍼

```ts
export type ApiResponse<T> = {
  dataHeader: {
    success: boolean
    resultCode: string | null
    resultMessage: unknown | null // 백엔드 타입이 Object 다. string 으로 타이핑하지 않는다
  }
  dataBody: T | null
}
```

- 성공: `{ dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody: T }`
- 실패: `{ dataHeader: { success: false, resultCode: "PET_001", resultMessage: "..." }, dataBody: null }`

**규칙**

- `dataBody` 를 바로 쓰지 않는다. 반드시 `src/lib/api/response.ts` 를 경유해 `dataHeader.success` 를 판별한다.
- `resultMessage` 는 문자열이 아닐 수 있다. Bean Validation 실패 시 필드별 구조가 들어온다. **`unknown` 으로 받고 렌더 직전 정규화한다.**

```ts
// src/lib/api/response.ts (개념)
export function unwrap<T>(res: ApiResponse<T>, status: number): T {
  if (!res.dataHeader.success || res.dataBody === null) {
    throw new ApiError(status, res.dataHeader.resultCode, res.dataHeader.resultMessage)
  }
  return res.dataBody
}

export function toMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.length > 0) return raw
  return fallback
}
```

## 3. 에러 처리 규약

| HTTP         | 의미                                 | UI                                                                 |
| ------------ | ------------------------------------ | ------------------------------------------------------------------ |
| 400          | 요청 검증 실패 (`{도메인}_1xx` 대역) | 입력 수정 유도. 가능하면 필드 매핑                                 |
| 401          | 토큰 만료/무효                       | 재발급 **1회** → 실패 시 세션 비우고 로그인 유도                   |
| 404          | 데이터 부재 **또는 타인 리소스**     | **재시도 버튼 금지.** `resultMessage` 그대로 노출 + 다음 행동 안내 |
| 그 외 4xx    | 요청 문제                            | 입력 수정 / 권한 안내                                              |
| 5xx · 무응답 | 일시 장애                            | **재시도 버튼 제공**                                               |

**핵심**

- 백엔드는 **타인 리소스 접근도 404** 로 응답한다 (존재 자체 노출 차단). 403을 기대하면 안 된다.
- `resultCode` 는 `{도메인}_{번호}` 문자열이다. 예: `PET_001`(없는 반려견), `PET_100`(요청 검증), `PET_113`(파라미터 형식). **번호 1xx 대역 = 요청 검증.**
- **404와 5xx의 시각 언어를 다르게 한다.** 데이터 없음에 에러 톤·재시도 버튼을 쓰지 않는다.

```ts
// 개념
export type ErrorKind = 'validation' | 'unauthorized' | 'not-found' | 'forbidden' | 'temporary'

export function classify(status: number): ErrorKind {
  if (status === 404) return 'not-found'
  if (status === 401) return 'unauthorized'
  if (status === 400) return 'validation'
  if (status >= 500 || status === 0) return 'temporary'
  return 'forbidden'
}
```

`'not-found'` 는 재시도 버튼을 렌더하지 않는다. 이 판정은 `src/lib/api/` 의 순수 함수로 두고 테스트한다 (`testing-guide.md`).

## 4. 목록 — SliceResponse 무한 스크롤

```ts
export type SliceResponse<T> = { contents: T[]; hasNext: boolean }
```

- 커서 기반이다. **`content`(단수)나 `totalPages`/`totalElements` 는 없다.**
- 장소 목록(`GET /api/v1/places`), 일정 목록(`GET /api/v1/plans`)이 이 형태 → **무한 스크롤이 기본 UI 패턴**이다.
- `useInfiniteQuery` 로 다루고, `hasNext === false` 면 마지막 도달 상태를 화면에 표현한다.

```ts
useInfiniteQuery({
  queryKey: placeKeys.list(filters),
  queryFn: ({ pageParam }) => fetchPlaces({ ...filters, cursor: pageParam }),
  getNextPageParam: (last) => (last.hasNext ? nextCursorOf(last) : undefined),
})
```

커서 파라미터의 실제 이름·형태는 Swagger로 확인한다. 추측하지 않는다.

## 5. 비동기 AI 작업 (폴링)

```text
POST /api/v1/ai-plans            → 202 Accepted + { jobId }
                                   (캐시 히트 시 200 + 결과)
GET  /api/v1/ai-plans/jobs/{id}  → 폴링
```

**반드시 지킬 것**

- **작업 실패는 HTTP 200 + `status=FAILED` + `errorCode`/`errorMessage` 로 온다. HTTP 5xx 가 아니다.**
  `dataHeader.success === true` 만 보고 성공 처리하면 실패를 놓친다.
- 결과 페이로드는 status별 **nullable** 이다.
- 동일 사용자·동일 요청이 in-flight면 백엔드가 **기존 jobId를 재사용**한다(멱등). 그래도 UI에서 중복 제출을 막는다.
- **SSE(`/stream`) 를 쓴다** ([#91](https://github.com/8llow8llowMe/hondigagae/issues/91)).
  BFF 가 요청 `Accept: text/event-stream` 을 보고 스트림 분기로 빠져 `response.body` 를 그대로
  흘려보낸다(`handleEventStream`) — 그 전에는 응답을 통째로 버퍼링해 통과시키지 못했다.
  **이벤트 이름은 `job-update` 이고 `data` 에 공통 래퍼가 없다**(조회 응답의 `dataBody` 와 동일).
  종결 상태에서 클라이언트가 `close()` 하지 않으면 `EventSource` 가 자동 재연결해 무한 재구독이
  된다. 계약 함정 전체는 ai-plan 공통명세 S3.
- **스트림을 새로 붙일 때는 토큰 스트립을 건너뛰어도 되는지 먼저 따진다.** 통과 경로는 프레임을
  파싱하지 않으므로 응답 본문에 토큰이 실릴 수 있는 엔드포인트는 통과시켜서는 안 된다.
- 폴링은 **완료·실패 시 반드시 멈춘다.** `refetchInterval` 이 계속 도는 것이 대표 사고다.

```ts
useQuery({
  queryKey: aiPlanKeys.job(jobId),
  queryFn: () => fetchAiPlanJob(jobId),
  refetchInterval: (query) => {
    const s = query.state.data?.status
    return s === 'COMPLETED' || s === 'FAILED' ? false : 2000
  },
})
```

- 수초~수십초가 걸리므로 **진행 중임을 납득 가능하게 보여준다.** 무한 스피너만 두지 않는다.

`status` 값의 실제 enum은 Swagger로 확인한다.

## 6. enum metadata / XAI

백엔드는 상태·등급·추천 이유를 **한국어 표시 문구까지 포함한 metadata 객체**로 내려준다.

```json
{
  "suitabilityLevel": {
    "code": "HIGH",
    "name": "여행 적합",
    "description": "...",
    "scoreDescription": "..."
  },
  "score": 82,
  "reasons": [
    {
      "code": "WEATHER_OK",
      "name": "기온 적정",
      "description": "현재 기온 24℃로 반려견 활동에 적합합니다."
    }
  ]
}
```

**규칙**

- **`name` / `description` 을 그대로 렌더한다.**
- **FE에 코드→한국어 매핑 테이블을 만들지 않는다.** 백엔드가 문구를 바꾸면 즉시 드리프트가 생기고, 새 코드가 추가되면 화면이 빈다.
- 색·아이콘 매핑만 FE가 가진다. 그때도 **모르는 `code` 에 대한 기본값**을 반드시 둔다.
- `reasons` 는 XAI 근거다. 잘리지 않게 렌더하고, 빈 배열이면 섹션을 숨긴다.

**이 규칙이 닿지 않는 자리: 서버가 값을 주지 않는 컨트롤**

매핑 금지는 **서버가 준 값을 FE 가 다시 번역하지 말라**는 뜻이다. 반대로 **서버가 값을 줄 수
없는 자리**에는 적용되지 않는다 — 대표적으로 **선택지를 그리는 컨트롤**이다. 응답 metadata 는
"이미 선택된 값 하나"뿐이라 아직 선택되지 않은 선택지의 표시명이 없다.

| 자리                           | 라벨 출처               | 근거                                 |
| ------------------------------ | ----------------------- | ------------------------------------ |
| 목록 행 · 상세 · 배지          | 서버 `name`             | 데이터가 있는 자리다                 |
| 등록 폼의 선택지               | FE 고정 라벨            | `docs/features/pet/공통명세.md` S6-1 |
| **결과 0건일 수 있는 필터 칩** | **FE 고정 라벨** (#205) | 아래                                 |

`/emergency` 의 유형 칩이 라벨을 **응답 목록에서 역추적**하고 있었다
(`facilities.find(...)?.facilityType.name ?? code`). 이 화면은 유형을 서버로 보내지 않고
클라이언트에서 좁히므로(칩마다 개수를 보여주려고) **개수 0 인 칩도 반드시 그리는데**, 그 칩은
목록에 표본이 없어 `?? code` 로 떨어졌다 — dev 에서 `ANIMAL_HOSPITAL 0 · ANIMAL_PHARMACY 0`
이 그대로 화면에 나갔다. 데이터가 차더라도 "반경 안에 병원만 있는" 흔한 경우에 재현된다.

**"결과에서 라벨을 역추적한다" 는 매핑 금지의 우회로가 아니다.** 표본이 없는 순간 코드가
노출되고, 그 순간은 결과가 비었을 때 — 즉 **사용자가 가장 헤매고 있을 때**다. 선택지 집합이
FE 에 이미 상수로 있다면(`FACILITY_TYPE_CODES`) 라벨도 함께 두고, `satisfies
Record<Code, string>` 으로 값이 늘 때 컴파일 단계에서 잡는다.

## 7. React Query 규약

### query key 팩토리

**문자열을 인라인으로 쓰지 않는다.** 서버 프리페치와 클라이언트가 **같은 key를 써야** 하이드레이션이 성립한다 (`architecture-guide.md` §9).

```ts
export const placeKeys = {
  all: ['places'] as const,
  list: (filters: PlaceFilters) => [...placeKeys.all, 'list', filters] as const,
  detail: (placeId: string) => [...placeKeys.all, 'detail', placeId] as const,
}
```

- key에는 **파싱된 필터 객체**를 넣는다. URL 문자열을 넣으면 파라미터 순서만 달라도 캐시가 갈린다.
- key 배열 요소 순서는 `[도메인, 종류, 파라미터]` 로 고정한다. `invalidateQueries({queryKey: placeKeys.all})` 로 도메인 단위 무효화가 가능해진다.

### 전역 기본값

`QueryClient` 의 `defaultOptions` 에 두고, 도메인별 예외만 `queries.ts` 에서 덮어쓴다.

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: (count, error) => (isRetriable(error) ? count < 2 : false),
      refetchOnWindowFocus: false, // 모바일에서 앱 전환마다 재조회하면 데이터를 낭비한다
    },
    mutations: {
      retry: 0, // 중복 생성 위험. 재시도는 사용자가 결정한다
    },
  },
})
```

`isRetriable` 은 **5xx·무응답만 true** 다. `classify()` 를 재사용한다 (§3).

- **401은 retry 대상이 아니다.** 재발급 흐름이 처리한다 (`auth-guide.md` §3).
- **404는 retry 대상이 아니다.** 데이터 부재는 재시도해도 같다.
- **400도 retry 대상이 아니다.** 요청이 잘못됐다.

### 도메인별 표준값

기본값이 없으면 각자 정하고, 그게 곧 불일치다. **아래 표를 따르고, 벗어날 때는 주석으로 근거를 남긴다.**

| 도메인           | `staleTime` | `gcTime` | `retry` | 근거                                                                |
| ---------------- | ----------- | -------- | ------- | ------------------------------------------------------------------- |
| 장소 목록·상세   | **5분**     | 30분     | 2       | batch 적재 데이터. 세션 중 거의 불변                                |
| 주변 장소(지도)  | **5분**     | 30분     | 1       | 같은 장소 데이터다. 지도를 옮기면 key 가 달라져 즉시 재조회된다     |
| 내 정보 (`me`)   | **1분**     | 10분     | 1       | 본인이 수정. mutation 후 invalidate가 담당                          |
| 반려견 목록·상세 | **1분**     | 10분     | 1       | 위와 동일                                                           |
| 장소 인사이트    | **5분**     | 30분     | 1       | 적합도·산책 위험도. 기상 예보 단위가 1시간이라 잦은 재조회가 낭비다 |
| 일정 목록·상세   | **30초**    | 10분     | 1       | mutation 빈번                                                       |
| **AI job 상태**  | **0**       | 1분      | **0**   | 폴링(`refetchInterval`)이 신선도를 담당. retry는 폴링과 중복        |

**해석**

- 장소 데이터에 5분을 준 이유: 배치로 적재되므로 사용자 세션 중에 바뀌지 않는다. 필터를 왕복하며 만지는 화면이라 재조회를 줄이는 게 체감 성능에 직결된다.
- 장소 인사이트에 5분을 준 이유: 장소 데이터와 값은 같지만 **이유가 다르다.** 장소는 배치라 안 바뀌고,
  인사이트는 기상 예보가 1시간 단위로 갱신되므로 그보다 잦은 재조회가 의미 없다. 반려견을 바꾸면
  key 가 달라져 즉시 재조회된다.
- AI job에 `staleTime: 0` + `retry: 0` 을 준 이유: 상태가 초 단위로 바뀌고, 실패는 **HTTP 200 + `status=FAILED`** 로 오므로(§5) retry가 개입할 여지가 없다.
- `gcTime` 은 항상 `staleTime` 보다 크게 둔다. 뒤로가기로 돌아왔을 때 캐시가 살아 있어야 한다.

### invalidate 규칙

mutation 후 무효화 대상을 **명세와 코드 양쪽에 명시한다.**

| mutation                     | invalidate                                                      |
| ---------------------------- | --------------------------------------------------------------- |
| 일정 생성/수정/삭제          | `planKeys.all`                                                  |
| 일자 항목 교체               | `planKeys.detail(planId)`                                       |
| **항목 방문 체크**           | `planKeys.detail(planId)` (**판정은 무효화하지 않는다** — 아래) |
| 반려견 등록/수정/삭제        | `petKeys.all`                                                   |
| 프로필 수정 / 이미지 변경    | `memberKeys.me()`                                               |
| **AI 일정 → 일정 확정 저장** | `planKeys.all` (ai job은 무효화하지 않는다 — 완료된 작업이다)   |

- **낙관적 업데이트(optimistic update)는 기본으로 쓰지 않는다.** 백엔드 검증(장소 존재 여부 Feign 확인, 반려견 등록 상한)이 실패할 수 있어 롤백이 잦다. 필요한 화면에서만 명세에 근거를 적고 쓴다.
- 일자 항목은 **일괄 교체**라 부분 무효화가 의미 없다. `planKeys.detail(planId)` 전체를 무효화한다.
- **방문 체크는 판정(`planKeys.weather`)을 무효화하지 않는다.** 그날 판정은 **첫 장소 항목** 기준인데
  방문 체크는 항목 구성·순서를 바꾸지 않는다. 담기·순서편집이 판정을 다시 받는 것과 갈리는 지점이다.
  응답이 `Response<Void>` 라 `setQueryData` 로 갈아끼울 수 없어 **무효화가 유일한 갱신 경로**다
  (`docs/features/plan/일정상세-세부명세.md` D9-5).

## 8. 타입 규칙

- **`memberId` 는 `string`** 이다. `number` 로 타이핑하거나 `Number(...)` 로 파싱하면 값이 손상될 수 있다.
- 다른 ID(`petId`, `planId`, `placeId`)는 **Swagger 실물로 개별 확인**한다. 추측으로 통일하지 않는다.
- nullable 응답을 non-null로 가정해 `.map` / `.length` 를 바로 부르지 않는다. 장소 상세의 intro/petInfo/images 결합 필드가 대표 사례다.
- **nullable 섹션은 에러가 아니라 숨김**으로 처리한다.
- 단위를 타입 이름이나 주석에 남긴다: 기온 ℃, 거리 m/km, 소요 시간 분, 금액 원.

## 9. 없는 API를 부르지 않는다

`backend/docs/service-inventory.md` 기준으로 **미착수**인 기능은 호출부를 만들지 않는다.

- 산책 코스(두루누비), 여행 적합도·날씨·혼잡도, 긴급 동물병원
- 여행 후기, 일정 공유
- AI 상담사·비서(`/assistant`), 반려견 성향 분석
- AI 일정 생성 SSE 스트림 (LLM 자체는 Ollama 로 연동 완료, 스텁 없음)

착수 가능 범위는 `screen-inventory.md`.

### mock 은 언제 허용되는가

**금지되는 것과 허용되는 것을 구분한다.**

|          |                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **금지** | 백엔드에 **없는 API** 를 상상해서 mock 으로 채우는 것. 계약이 확정되면 전부 다시 짜야 하고, 그 사이 화면은 "동작하는 것처럼" 보인다 |
| **허용** | **실재하는 계약을 근거로 한** 개발용 fixture. 백엔드가 로컬에 뜨지 않았거나 데이터가 적재되기 전에 화면을 확인하기 위한 것          |

허용되는 mock 은 아래를 지킨다.

- **BFF·서버 전송 계층에서만 분기한다.** 클라이언트 코드는 mock 존재를 몰라야 한다 —
  전송·래퍼 판별·에러 분기·React Query 가 실제 경로 그대로 돌아야 검증에 의미가 있다.
- **`MOCK_API=true` 일 때만 켜지고, 프로덕션 빌드에서는 항상 비활성이다.**
- 계약 근거(어느 컨트롤러·DTO 를 봤는지)를 파일 주석에 남긴다.
- 백엔드 동작을 흉내 낸다 — 필터·커서·`size` 범위 검증·404 까지.
- 데이터는 **nullable 을 실제로 비우고 긴 한국어를 섞는다.** 그래야 오버플로와
  non-null 가정 버그가 기본 경로에서 드러난다.

구현은 `src/lib/api/mock/`. 처리 대상이 아닌 경로는 `null` 을 반환해 실제 게이트웨이로 넘어간다.
