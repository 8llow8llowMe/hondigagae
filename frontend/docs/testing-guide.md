# Frontend Testing Guide

## 1. 방식 (이 저장소 고유)

- **`environment: 'node'`** — jsdom 없음, testing-library 없음, DOM 이벤트 시뮬레이션 없음
- `include`: `src/**/*.test.ts`, `app/**/*.test.ts` — **`.tsx` 는 수집되지 않는다**
- alias: `@` → `src`

| 항목          | 규칙                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| 파일명        | `*.test.ts` (`.tsx` 아님)                                                |
| 엘리먼트 생성 | JSX 대신 `createElement`                                                 |
| 렌더          | `renderToStaticMarkup` (react-dom/server)                                |
| 검증          | 결과 **마크업 문자열** 에 대한 `toContain` / `not.toContain` / `toMatch` |

**왜 이 방식인가**: 설정 부담이 거의 없고, 공모전 일정에서 순수 로직 커버리지를 빠르게 확보할 수 있다.

**레이아웃과 로그인 뒤 화면은 Playwright 가 맡는다 (§12).** 경계를 반드시 읽고 쓴다 — 마크업 문자열로 볼 수 없는 것을 여기서 확인하려 들면 단언이 거짓 안심을 준다.

**한계 (반드시 알 것)**

- `async` server component는 `renderToStaticMarkup` 으로 렌더되지 않는다 → **안에서 쓰는 순수 함수를 뽑아 테스트한다.**
- React Query hook, Zustand store를 쓰는 컴포넌트는 렌더되지 않는다 → **props로 데이터를 받는 presentational 컴포넌트로 분리**한 뒤 그것을 테스트한다. 이 분리가 테스트 가능성의 핵심이다.
- 클릭·입력·포커스 이동은 검증할 수 없다. 그 부분은 `fe-design-reviewer` 의 브라우저 검토가 담당한다.
- **적용된 CSS 와 실제 레이아웃을 볼 수 없다.** `class="..."` 문자열은 보이지만 계산된 값은 아니다 — §12 의 Playwright 가 맡는다.
- **보호 라우트의 실화면을 볼 수 없다.** `/mypage` · `/pets` · `/favorites` · `/plans` · `/ai-plans` 는 307 로 `/login` 에 걸린다 — 같은 곳.

## 2. vitest.config.ts

```ts
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'app/**/*.test.ts'],
    globals: false, // describe/it/expect 를 명시적으로 import
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/features/**'],
      exclude: ['**/*.test.ts', 'src/test/**'],
    },
  },
  resolve: {
    alias: {
      // tsconfig.json 의 paths 와 값이 같아야 한다
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' 는 node 환경에서 throw 하므로 빈 스텁으로 대체
      'server-only': fileURLToPath(new URL('./src/test/stubs/server-only.ts', import.meta.url)),
    },
  },
})
```

- **`server-only` alias가 필수다.** `src/lib/env.server.ts`, `src/lib/auth/**` 가 이 모듈을 임포트하므로 스텁 없이는 테스트가 임포트 단계에서 죽는다.
- `globals: false` 로 두고 `import { describe, expect, it } from 'vitest'` 를 명시한다. 임포트 누락을 타입체커가 잡아준다.
- 커버리지는 **리포트만** 낸다. 임계값 게이트는 두지 않는다 (§8).

```ts
// src/test/stubs/server-only.ts
export {}
```

## 3. 예시

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import PlaceListSection from '@/features/place/place-list-section'

describe('PlaceListSection', () => {
  it('데이터 부재(404)에서는 재시도 버튼을 노출하지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListSection, { status: 404, message: '조건에 맞는 장소가 없습니다.' }),
    )

    expect(markup).toContain('조건에 맞는 장소가 없습니다.')
    expect(markup).not.toContain('다시 시도')
  })

  it('일시 장애(5xx)에서는 재시도 버튼을 노출한다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListSection, { status: 503, message: null }),
    )

    expect(markup).toContain('다시 시도')
  })
})
```

## 4. 무엇을 테스트하는가

### 우선순위 1 — 순수 로직 (`src/lib/**`)

마크업 문자열 검증보다 훨씬 견고하다. 이 프로젝트에서 특히 중요한 것:

- `dataHeader.success` 판별, `resultMessage` 정규화, `fieldErrors` → 필드 매핑
- HTTP 상태 → 에러 종류 매핑 (404 / 401 / 400 / 5xx)
- **비동기 job 상태 판정** — HTTP 200 + `status=FAILED` 를 **실패로** 판정하는지
- `SliceResponse` 페이지 병합과 `hasNext` 종료 판정
- 포맷 함수 (거리 m/km, 기온 ℃, 소요 시간 분, 금액 원, 날짜)
- 재발급 1회 제한 로직
- 좌표 검증 (`lat`=위도 / `lng`=경도, `null`·`0`·범위 밖 배제 — 백엔드가 이미 Double 로 정규화해 내려준다)
- **URL 필터 파싱·직렬화 round-trip** (`src/lib/url/**`) — 기본값 생략·콤마 배열 규칙의 비대칭을 잡는다

### 우선순위 2 — 렌더 분기

loading / empty·404 / 5xx / success 가 **서로 배타적으로** 나오는지. 특히:

- **404에서 "다시 시도" 버튼이 나오지 않는지**, 서버 `resultMessage` 가 그대로 노출되는지
- 5xx·무응답에서는 재시도 버튼이 나오는지
- nullable 섹션(장소 상세의 intro/petInfo/images)이 에러가 아니라 **숨김** 으로 처리되는지
- 서버 enum metadata의 `name`/`description` 이 그대로 렌더되는지 (하드코딩 한국어가 아닌지)
- **모르는 enum `code` 에서 화면이 비지 않는지** (기본값 폴백)

### 우선순위 3 — 접근성 계약

마크업에 드러나는 것: `aria-label`, `aria-pressed`, `aria-expanded`, `role`.

## 5. 테스트 헬퍼 / fixture 전략

응답 래퍼를 매번 손으로 쓰면 fixture가 제각각이 된다. **빌더로 고정한다.**

```ts
// src/test/api.ts
import type { ApiResponse } from '@/types/api'

export function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

export function fail(
  resultCode: string,
  resultMessage: string | null = null,
  fieldErrors: ValidationErrorItem[] | null = null,
): ApiResponse<never> {
  return { dataHeader: { success: false, resultCode, resultMessage, fieldErrors }, dataBody: null }
}

/** 검증 실패 — 대표 메시지는 문자열이고 필드 목록은 fieldErrors 로 간다 */
export function failWithFields(resultCode: string, fields: Record<string, string>) {
  return fail(resultCode, fields)
}
```

```ts
// src/test/fixtures/place.ts  — Swagger / 백엔드 코드 실측 기준
import type { PlaceSummary } from '@/types/place'

export const placeSummary: PlaceSummary = {
  placeId: '212481712381923328', // 문자열이다 (백엔드 내부는 long, 응답 DTO는 String)
  title: '제주특별자치도립김창열미술관', // 긴 한국어 실데이터를 기본 fixture 로
  lat: 33.3608276172, // 백엔드가 Double 로 정규화해 내려준다
  lng: 126.7818122232,
  firstImage: null, // nullable
  contentType: { code: 'TOURIST_SPOT', name: '관광지', description: '자연·문화 관광지' },
  petAllowanceType: { code: 'PARTIALLY_ALLOWED', name: '부분 동반 가능', description: '...' },
  addr1: '제주특별자치도 제주시 한림읍 용금로 906-107',
  sigunguCode: '4',
  firstImage2: null,
  tel: null,
}
```

**fixture 규칙**

- 위치: `src/test/fixtures/<domain>.ts`. 테스트 파일 안에 인라인으로 흩뿌리지 않는다.
- **기본 fixture에 긴 한국어 실데이터를 넣는다.** 짧은 더미(`'테스트'`)를 쓰면 오버플로 문제를 영원히 못 잡는다.
- **nullable 필드의 기본값을 `null` 로 둔다.** non-null 가정 버그가 기본 경로에서 드러난다.
- 문자열 ID는 문자열로 둔다.
- 네트워크를 실제로 타지 않는다. `fetch` 를 모킹하지 말고 **함수에 fixture를 주입**하는 구조를 우선한다.

### 소스 단언은 주석을 걷은 사본에 (`src/test/source.ts`)

렌더할 수 없는 계약 — 라우트 규약 파일(`error.tsx` · `not-found.tsx` · `loading.tsx` ·
`layout.tsx`)이나 **한 파일에 없는 짝**(카드를 그리는 곳과 상태를 그리는 곳이 다를 때) — 은
소스를 문자열로 읽어 단언한다. 그때 **반드시 주석을 걷은 사본에 대해** 한다.

- **걷지 않으면 주석에 속아 통과한다.** 이 저장소의 주석은 근거를 길게 적어 클래스명·
  컴포넌트명이 그대로 등장한다 (#451 에서 실제로 났고, 뒤이어 뮤테이션으로 확인한 것만 셋이다).
- **반대 방향도 있다.** "이 prop 을 넘기지 않는다" 를 주석으로 적어 둔 파일에서는, 걷지
  않으면 그 낱말 때문에 단언이 **헛되이 실패**한다.

```ts
// src/test/source.ts
import { openingTags, readSource, readSourceWithoutComments, stripComments } from '@/test/source'
```

- `readSourceWithoutComments(relPath)` — 계약 단언의 기본. 경로는 **저장소 루트(`frontend/`) 기준**이다.
- `readSource(relPath)` — 주석까지 그대로 (css 처럼 걷을 이유가 없을 때).
- `openingTags(source, /<Foo\b/g)` — JSX **열기 태그**를 통째로 집는다. 정규식
  (`/<Foo\b[\s\S]*?\/>/`)은 `action={<Bar />}` 처럼 prop 안에 든 self-closing 자식의
  `/>` 에서 **잘린다** — 저장소에 실재하는 모양이라 스캐너를 쓴다.

**각자 만들지 않는다** (#458). 예전에는 아홉 파일이 각자 갖고 있었고 이름도 범위도 갈렸다 —
`strip`+`code` · `withoutComments` · `source` · 인라인 `replace` · `code`. 그중 **둘은 블록
주석만 걷고 일곱은 줄 주석까지 걷어** 같은 이름이 다른 일을 했다.

## 6. fixture를 Swagger 실측으로 만드는 절차

**상상한 응답으로 테스트하면 계약 드리프트를 못 잡는다.** 통과하는 테스트가 거짓 안심을 준다.

```bash
# 1) 실호출 (인증 불필요 GET만)
curl -s --max-time 15 "http://localhost:8000/api/v1/places" \
  | python3 -m json.tool --no-ensure-ascii > /tmp/places.json

# 2) 필요한 부분만 발췌해 fixture 로 옮긴다
head -60 /tmp/places.json
```

- fixture 파일 상단에 **출처와 확인 일시를 주석으로 남긴다.**
- 백엔드 계약이 바뀌면 `/fe-api-check` 로 드리프트를 확인하고 fixture를 갱신한다.
- 저장·수정·삭제 API는 호출하지 않는다. 그 fixture는 Swagger 스키마로 손으로 만든다.

## 7. TDD 적용 범위

`superpowers:test-driven-development` 를 **모든 코드에 적용하지 않는다.** 비용 대비 효과로 나눈다.

| 대상                                                     | TDD          | 이유                                          |
| -------------------------------------------------------- | ------------ | --------------------------------------------- |
| `src/lib/**` 순수 로직 (에러 판정, job 상태, 포맷, 좌표) | **적용**     | 입출력이 명확하고 회귀 비용이 크다            |
| `src/lib/api/**` 래퍼 판별                               | **적용**     | 계약이 명세로 확정돼 있다                     |
| presentational 컴포넌트의 상태 분기                      | 구현 후 작성 | 마크업이 먼저 정해져야 assertion을 쓸 수 있다 |
| 레이아웃·스타일                                          | 미적용       | `fe-design-reviewer` 의 브라우저 검토가 담당  |
| React Query hook 배선                                    | 미적용       | node 환경에서 의미 있는 검증이 어렵다         |

버그를 만나면 `superpowers:systematic-debugging` 으로 근본원인을 찾고, **재현 테스트를 먼저 추가한 뒤** 고친다.

## 8. 커버리지 기준

**수치 목표를 두지 않는다.** 임계값 게이트는 의미 없는 테스트를 양산한다. 대신 **아래가 비어 있으면 미완성으로 본다.**

- [ ] 에러 분기 판정 함수
- [ ] 비동기 job 실패 판정 (HTTP 200 + `FAILED`)
- [ ] `resultMessage` 정규화 (비문자열 입력 포함) · `fieldErrors` → 필드 매핑
- [ ] `SliceResponse` 병합 / `hasNext` 종료
- [ ] 포맷 함수 전부
- [ ] 좌표 파싱·검증
- [ ] URL 필터 round-trip
- [ ] 새로 만든 화면의 404 / 5xx 분기
- [ ] 모르는 enum code 폴백

리포트는 `pnpm test:coverage` 로 확인한다.

## 9. 규약

- **테스트 이름은 한국어로, 동작을 서술한다.** "renders correctly" 금지.
- **한 `it` 은 하나를 주장한다.**
- **구현을 테스트에 맞춰 바꾸지 않는다.** 실패하면 진짜 버그인지 먼저 판단하고, 버그면 보고한다.
- 파일은 UTF-8 (no BOM) 로 저장한다.
- 테스트 작성·보강은 `fe-test-author` 서브에이전트를 쓴다 (`team-playbook.md`).

## 10. 실행

```bash
cd frontend
pnpm test              # 1회 실행
pnpm test:watch        # 감시 모드
pnpm test:coverage     # 커버리지 리포트
```

## 11. 첫 테스트 목록 (Phase 3 착수 시)

프로젝트 부트스트랩과 **함께** 작성한다. 화면보다 먼저 이 순수 함수들이 생기고, 각각 테스트를 가진다.

| #   | 대상                  | 파일                                 | 핵심 주장                                                                |
| --- | --------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| 1   | `unwrap()` 래퍼 판별  | `src/lib/api/response.test.ts`       | `success:false` 면 throw, `dataBody:null` 이면 throw                     |
| 2   | `toMessage()` 정규화  | `src/lib/api/response.test.ts`       | 객체·`null`·빈 문자열 입력에서 폴백 문구 반환                            |
| 3   | `classify(status)`    | `src/lib/api/error.test.ts`          | 404→`not-found`, 401→`unauthorized`, 400→`validation`, 500·0→`temporary` |
| 4   | `isJobFailed()`       | `src/lib/ai-plan/job.test.ts`        | **HTTP 200 + `status:'FAILED'` 를 실패로 판정**                          |
| 5   | `shouldKeepPolling()` | `src/lib/ai-plan/job.test.ts`        | `COMPLETED`/`FAILED` 에서 `false`                                        |
| 6   | `mergeSlices()`       | `src/lib/api/slice.test.ts`          | `contents` 누적, `hasNext:false` 에서 종료                               |
| 7   | `formatDistance()`    | `src/lib/format/distance.test.ts`    | 999m→`999m`, 1200m→`1.2km`, `null`→`'-'`                                 |
| 8   | `formatTemperature()` | `src/lib/format/temperature.test.ts` | 단위 `℃` 포함                                                            |
| 9   | `toLatLng()`          | `src/lib/geo/coord.test.ts`          | **`lat` 이 위도로 먼저**, `null`·`0`·범위 밖은 `null` 반환               |
| 10  | `canRetryReissue()`   | `src/lib/auth/reissue.test.ts`       | 2회차 시도에서 `false`                                                   |
| 11  | **필터 round-trip**   | `src/lib/url/place-filters.test.ts`  | `parse(toQuery(f)) === f` — 기본값 생략·콤마 배열 인코딩 포함            |

이 11개가 통과하면 `docs/done-checklist.md` §7의 절반이 자동으로 충족된다.

**#11 을 따로 둔 이유**: 기본값을 URL에서 생략하는 규칙(`architecture-guide.md` §10) 때문에 직렬화와 파싱이 비대칭이 되기 쉽다. round-trip 테스트가 이 비대칭을 바로 잡아낸다. 필터가 늘어날 때마다 케이스를 추가한다.

## 12. Playwright — 레이아웃 · 보호 라우트 (이슈 #467)

**E2E 스위트가 아니다.** vitest 가 볼 수 없는 둘만 맡는다.

배포된 dev 를 실제로 부르는 로그인 스모크는 설정부터 따로다 — §13.

```bash
cd frontend
pnpm e2e            # 1회 실행 (서버는 설정이 알아서 띄운다)
pnpm e2e:ui         # 감시 · 디버깅 UI
pnpm e2e:report     # 마지막 실행 리포트
```

### 경계 — 무엇을 어디서 쓰는가

| 대상                                          | 도구           | 이유                                             |
| --------------------------------------------- | -------------- | ------------------------------------------------ |
| 순수 로직 (`src/lib/**`)                      | vitest         | 입출력이 명확하고 가장 싸다                      |
| 렌더 분기 (loading / 404 / 5xx / success)     | vitest         | 마크업 문자열로 충분하다                         |
| 접근성 계약 중 마크업에 드러나는 것           | vitest         | `aria-*` · `role` 은 문자열에 있다               |
| **계산된 레이아웃** (배경·radius·세로 기준선) | **Playwright** | 문자열에는 없다. 브라우저가 계산해야 한다        |
| **보호 라우트 가드와 그 뒤의 화면**           | **Playwright** | `proxy.ts` 는 미들웨어라 렌더 테스트가 못 닿는다 |
| 클릭·입력 단위 상호작용                       | 아직 없음      | 필요해지면 jsdom + testing-library 가 더 싸다    |

**화면 고유의 배치를 Playwright 로 잠그지 않는다.** 여기서 보는 것은 **층 규약**뿐이다 — 화면별 판단은 렌더 테스트와 `fe-design-reviewer` 의 몫이고, 그것까지 여기로 가져오면 디자인을 바꿀 때마다 스펙이 깨진다.

**층 규약 옆에 하나를 더 둔다 — 공용 컴포넌트의 반응형 계약** (#539, `back-link-title-row.spec.ts`). 브레이크포인트에 따라 자리·크기가 달라지는 컴포넌트는 클래스가 붙었는지로는 검증되지 않는다. `md:basis-full` 이 실제로 줄바꿈을 만드는지, 44px 가 정말 44px 인지는 재 봐야 안다.

**레이아웃 클래스의 DOM 순서 약속도 이 갈래다** (#653, `plan-status.spec.ts`). `.rail-layout-split` 은 _"레일이 본문 앞뒤 둘로 갈리고 `lg` 미만에서는 DOM 순서대로 쌓인다"_ 를 약속하는데, 클래스가 붙었는지로는 그 약속이 지켜졌는지 알 수 없고 해당 화면은 React Query 훅을 들어 렌더 테스트로 못 본다. **다만 순서만 잰다 — 픽셀 임계값(`< 844` 같은 것)은 화면 고유의 배치라 여기서 잠그지 않는다.**

**둘을 가르는 기준은 "몇 곳에서 같은 것을 보는가" 다.** 한 화면에서만 재면 그 화면의 배치를 잠그는 것이고(§12 가 막는 것), **같은 계약을 그 컴포넌트의 모든 사용처에서** 재면 컴포넌트의 계약을 잠그는 것이다. 그래서 `back-link-title-row.spec.ts` 는 `titleRow` 를 쓰는 **네 자리를 전부** 본다 — 한 곳만 봤을 때 실제로 데스크톱 회귀(링크 상자가 줄 전체 폭이 됨)를 놓쳤다.

### 왜 백엔드가 필요 없나

`playwright.config.ts` 의 `webServer` 가 **`MOCK_API=true`** 로 dev 서버를 띄운다. 이 플래그는 **BFF 프록시와 `serverFetch`(SSR 프리페치) 양쪽**을 덮으므로(`app/api/bff/[...path]/route.ts` · `src/lib/api/server.ts`), `page.route()` 로 브라우저 요청만 가로채는 방식과 달리 **서버 렌더까지 같은 fixture** 를 본다. `BACKEND_API_URL` 은 닿을 수 없는 주소로 덮어써 둔다 — 실수로 dev 게이트웨이를 때리는 경로를 원천에서 없앤다.

### 알아 둘 제약 셋

1. **`next dev` 로 띄운다 (`next build && next start` 가 아니다).** `isMockEnabled()` 가 `NODE_ENV === 'production'` 에서 항상 false 라, 프로덕션 빌드로는 목을 쓸 수 없다.
2. **산출물 디렉터리를 `.next-e2e` 로 가른다** (`NEXT_DIST_DIR`). Next 16 은 한 디렉터리에 dev 서버를 하나만 허용해서, 갈라 두지 않으면 사람이 5174 에 띄워 둔 서버를 죽여야 돌아간다. 워크트리를 다른 세션과 공유하므로 남의 서버를 죽이게 된다.
3. **`toHaveScreenshot` 을 쓰지 않는다** — [#483](https://github.com/8llow8llowMe/hondigagae/issues/483) 에서 **도입하지 않기로 정했다.** dev 오버레이가 픽셀을 흔들고, 기준선은 macOS 와 CI(Linux)의 폰트 렌더가 달라 따로 관리해야 한다. 대신 `getComputedStyle` · `getBoundingClientRect` 실측을 단언한다.
   **그 편이 실제로 더 잘 잡았다.** 지금까지 잡아낸 결함을 전수 집계했을 때 **픽셀 비교로만 잡혔을 항목은 0건**이었다 — 바닥 폭(`getBoundingClientRect`) · 열 간격(rect 차) · 재검색 오탐(`haversine`) · 겹침(`elementFromPoint`) · 스냅과 자동 스크롤(`scrollLeft` · `scrollY` 시계열)이 전부 값 단언이었다. 이 서비스에서 깨지는 것은 **색·여백·정렬의 수치**이고, 그것은 계산된 값이 더 정확하고 안정적으로 잡는다.
   **뒤집을 조건은 하나다** — 픽셀로만 잡히는 결함이 실제로 나오면 그 사례가 곧 도입 근거가 된다. 그때 다시 판단한다.

### 계산 스타일은 `locator.evaluate()` 로 읽지 않는다 (#581)

`loading.tsx` 가 있는 라우트(`/` · `/plans` · `/olle` · `/emergency` · `/mypage` · `/pets` · `/favorites` · `/places`)는 **Suspense 경계**를 만들고, 폴백이 풀리는 순간 React 가 서브트리를 **통째로 교체**한다. 이 저장소의 폴백은 레이아웃 점프를 막으려고 **실화면과 같은 층·같은 랜드마크를 일부러 그린다**(#475) — 그래서 로케이터가 폴백 쪽에 먼저 붙고, 그 직후 노드가 detach 된다.

`locator.evaluate()` 는 **attach 를 한 번만 기다리고 재해소하지 않는다.** 떨어져 나간 노드에서 `getComputedStyle` 을 부르면 모든 속성이 **빈 문자열**이라 단언이 `Received: ""` 로 깨진다. CI 는 `retries: 1` 이라 이것이 오래 가려져 있었다.

- ✅ **자동 재시도 단언을 쓴다** — `await expect(main).toHaveCSS('background-color', rgb)`. 재시도마다 로케이터를 다시 해소하므로 경합이 구조적으로 사라진다.
- ✅ 여러 속성을 한 번에 읽어야 하면 `surfaceStyle()`(`e2e/helpers/layout.ts`)을 쓴다 — 붙어 있는 노드를 읽을 때까지 재시도한다.
- ✅ `page.evaluate(() => document.querySelector('main'))` 형태는 **브라우저 안에서 그 시점에 다시 조회**하므로 안전하다. 바꾸지 않아도 된다.
- ❌ `await locator.evaluate((el) => getComputedStyle(el).x)` 를 `goto` 직후에 쓰지 않는다.

폴백을 재도 층 규약 검증은 유효하다 — 폴백이 같은 규약을 따르도록 그려져 있는 것이 그 이유다. 막으려는 것은 **교체되는 순간에 걸리는 것** 하나다.

### 로그인

`e2e/auth.setup.ts` 가 **실제 로그인 폼으로** 들어가 `storageState` 를 만들고, 나머지 스펙이 그것을 나눠 쓴다. 세션 쿠키를 `seal()` 로 위조하지 않는다 — 그러면 로그인 경로가 검증되지 않고 세션 형식이 바뀔 때 그 파일만 조용히 낡는다. 계정은 목 저장소의 일반 계정(`demo@hondigagae.dev`)이다 (`src/lib/api/mock/store.ts`).

`e2e/.auth/` 는 `.gitignore` 대상이다. 목 계정이지만 쿠키 스냅샷이라 커밋하지 않는다.

### CI

`.github/workflows/frontend-ci.yml` 의 **별도 `e2e` job** 이다. `pnpm verify`(= lint · typecheck · test) 안에 넣지 않는다 — 브라우저 내려받기와 서버 기동이 붙어 시간이 늘고, 직렬로 묶으면 lint 한 줄 때문에 레이아웃 결과를 못 보게 된다.

**`continue-on-error` 는 걷었다** ([#587](https://github.com/8llow8llowMe/hondigagae/issues/587)). 연속 24회 무결로 선행 조건을 채웠다. **e2e 가 깨지면 워크플로가 빨간불이 된다.**

**아직 required status check 는 아니다.** 저장소가 private + Free 라 브랜치 보호 API 가 403 이고, public 전환이냐 플랜 업그레이드냐를 고르는 결정이 남아 있다 ([#286](https://github.com/8llow8llowMe/hondigagae/issues/286)). 그때까지 **머지 버튼 자체는 막히지 않는다** — 빨간불을 보고도 머지하지 않는 것은 사람의 몫이다.

> **워크플로 conclusion 만 보고 판단하지 않는다.** `continue-on-error` 시절에는 e2e 가 깨져도 `gh run list` 의 conclusion 이 전부 `success` 로 보였다. 이제는 그렇지 않지만, 개별 job 을 봐야 어느 spec 이 깨졌는지 알 수 있다.
>
> ```bash
> gh run view <runId> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
> ```

### 이 방식이 대체한 것

3층 표면 작업(#455) 내내 쓰던 **임시 하네스** — `renderToStaticMarkup` 결과를 `public/__check/*.html` 로 쓰고 dev 서버 CSS 를 링크해 눈으로 재던 방식이다. 커밋 전마다 손으로 지워야 했고 [#67](https://github.com/8llow8llowMe/hondigagae/issues/67) 이 그 한계를 추적했다. **더 쓰지 않는다.**

## 13. Playwright — dev 로그인 스모크 (이슈 #757)

**§12 와 정반대 편이다.** §12 는 `MOCK_API=true` 로 **PR 의 코드**를 재고 dev 를 부르지 않도록 막아 두었다. 이것은 **이미 배포된 dev** 를 실제로 불러 로그인 · BFF 세션 · 실데이터 조회가 서 있는지 본다. 그래서 설정·디렉터리를 가른다 — 한 파일에 섞으면 `pnpm e2e` 가 dev 를 칠 수 있는 길이 생긴다.

| 무엇      | 파일                                                                |
| --------- | ------------------------------------------------------------------- |
| 설정      | `playwright.dev-smoke.config.ts` (`webServer` 없음)                 |
| 스펙      | `e2e-dev-smoke/*.smoke.ts`                                          |
| 로그인    | `e2e-dev-smoke/login.setup.ts` → `e2e-dev-smoke/.auth/` (gitignore) |
| 로그아웃  | `e2e-dev-smoke/logout.teardown.ts`                                  |
| 공용 가드 | `e2e-dev-smoke/fixtures.ts`                                         |
| CI        | `.github/workflows/frontend-dev-smoke.yml`                          |

### 무엇을 보는가 — 읽기만

로그인 뒤 **내 정보 · 장소 검색 · 긴급시설 검색 · 여행 일정 · 반려견 · 저장한 장소** 여섯 화면을 연다. 화면마다 둘을 본다.

1. **BFF 조회가 성공한다** (`readBff`) — 상태 200 + `dataHeader.success`. SSR 프리페치는 실패를 삼키고 클라이언트가 다시 부르므로 화면만으로는 "0건" 과 "조회 실패" 를 가를 수 없다.
2. **화면이 그 화면의 오류 상태 없이 열린다** (`openScreen`) — `/login` 으로 튕기지 않고, 로딩 골격이 걷힌 뒤 **그 화면의 오류 제목**과 `다시 시도` 버튼이 없다.

**오류 제목은 화면마다 다르다** — 여섯 화면 모두 `ErrorState` 를 쓰지만 제목은 `messages.member.loadFailedTitle` · `messages.plan.errorTitle` 처럼 도메인 문구다. 공용 문구 하나로 찾으면 어느 화면에도 없는 글자를 찾아 늘 통과한다(검토에서 실제로 잡혔다). 그래서 호출부가 그 화면의 제목을 넘긴다. **`networkidle` 을 기다리지 않는다** — 쿼리 재시도 backoff 사이에 먼저 풀려 오류를 놓치고, 지도 SDK 처럼 요청이 이어지는 화면에서는 끝나지 않는다. 쿼리는 재시도가 끝날 때까지 골격을 그리므로 **골격(`animate-pulse`)이 걷히기**를 기다린다.

**개수는 공공 데이터(장소·긴급시설)만 1건 이상으로 본다.** 일정·반려견·저장 목록은 계정에 따라 0건이 정상이다.

**쓰기는 fixture 가 네트워크에서 끊는다.** dev 출처로 나가는 `GET`·`HEAD` 밖의 요청은 전부 abort 되고, 하나라도 있었으면 그 테스트가 실패한다. 같은 fixture 가 **dev 의 5xx 응답과 브라우저 `pageerror`** 도 모아 실패로 올린다 — 이슈가 기준으로 삼은 실측(2026-09-19)이 "HTTP 200, 서버 5xx·런타임 오류 없음" 이었다. 로그인·로그아웃만 이 가드 밖이다.

### 비밀값 — 무엇이 어디에 남는가

| 값                   | 받는 곳                  | 남지 않게 한 방법                                                                                                                                                                                                                           |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계정 이메일·비밀번호 | CI secret → 환경 변수    | **폼을 채우지 않는다.** playwright 는 `fill` 의 단계 제목에 입력값을 그대로 적는다(`Fill "{value}"`). BFF 로그인을 `request.post` 로 부르면 제목이 메서드·URL 뿐이다. 로그인 프로젝트는 trace·스크린샷을 끈다(요청 본문이 trace 에 담긴다). |
| 세션 쿠키            | `e2e-dev-smoke/.auth/`   | gitignore · 아티팩트 경로 밖. teardown 이 **로그아웃**해 쿠키를 죽이고 파일을 지운다.                                                                                                                                                       |
| 실패 trace           | 아티팩트(실패 시만, 3일) | 네트워크 기록에 세션 쿠키가 실린다 — 뺄 방법이 없어 위 로그아웃으로 무효화한다.                                                                                                                                                             |

- **실패 메시지에 응답 본문·쿼리를 싣지 않는다.** 경로 · 상태 · `resultCode` 만 남긴다. 내 정보 응답은 계정의 이메일·이름을 담는다.
- **실패 스크린샷과 `error-context.md`(페이지 ARIA 스냅샷)에는 화면에 원래 보이는 계정 표시(헤더의 이름, 마이페이지의 이메일)가 담길 수 있다.** 그래서 **스모크 전용 계정**을 쓴다 — 개인 계정을 secret 에 넣지 않는다.
- 로컬에서 돌릴 때도 값은 셸 환경 변수로만 준다. `.env.*` 나 예시 파일에 실제 값을 적지 않는다.

### 실행

```bash
cd frontend
DEV_SMOKE_BASE_URL=https://dev.hondigagae.com \
DEV_SMOKE_EMAIL='<스모크 계정 이메일>' \
DEV_SMOKE_PASSWORD='<스모크 계정 비밀번호>' \
pnpm e2e:dev-smoke
```

### 언제 · 어디서 도는가

- **CI: `frontend-dev-smoke` 워크플로.** PR·push 에는 걸지 않는다 — PR 의 코드는 아직 dev 에 없으므로 그 결과가 PR 을 말해 주지 못한다.
- **매일 09:10 KST 한 번** (`schedule`). 밤사이 배치·배포가 깨뜨린 것을 아침에 본다. `schedule` 은 기본 브랜치(`develop`)의 워크플로 파일로만 돈다.
- **dev 배포 직후 손으로** (`workflow_dispatch`). Jenkins dev 배포(`Jenkinsfile.frontend-common.groovy` · 백엔드 공통)가 끝나면 Actions 탭 `Run workflow` 또는 `gh workflow run frontend-dev-smoke.yml --ref develop`. Jenkins 가 자동으로 부르게 하는 것은 아직 하지 않았다 — GitHub 토큰을 Jenkins 에 새로 넣어야 한다.
- 실행은 `concurrency` 로 한 번에 하나다. 같은 계정 세션이라 겹치면 한쪽 로그아웃이 다른 쪽을 끊는다.

필요한 저장소 설정은 셋이다. **secret 은 저장소 범위다** — 같은 저장소의 다른 브랜치 워크플로도 읽을 수 있다. 브랜치를 `develop` 으로 묶는 GitHub Environment secret 이 맞는 자리지만, private + Free 저장소라 쓸 수 없다(#286 과 같은 제약). 그래서 **권한이 좁은 스모크 전용 계정**을 쓰는 것으로 피해 범위를 줄인다. 플랜이 바뀌면 `environment:` 로 옮긴다.

| 종류   | 이름                 | 없으면                               |
| ------ | -------------------- | ------------------------------------ |
| secret | `DEV_SMOKE_EMAIL`    | 로그인 setup 이 이름을 대고 실패한다 |
| secret | `DEV_SMOKE_PASSWORD` | 위와 같다                            |
| 변수   | `DEV_SMOKE_BASE_URL` | `https://dev.hondigagae.com` 을 쓴다 |
