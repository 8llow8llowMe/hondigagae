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

### 왜 백엔드가 필요 없나

`playwright.config.ts` 의 `webServer` 가 **`MOCK_API=true`** 로 dev 서버를 띄운다. 이 플래그는 **BFF 프록시와 `serverFetch`(SSR 프리페치) 양쪽**을 덮으므로(`app/api/bff/[...path]/route.ts` · `src/lib/api/server.ts`), `page.route()` 로 브라우저 요청만 가로채는 방식과 달리 **서버 렌더까지 같은 fixture** 를 본다. `BACKEND_API_URL` 은 닿을 수 없는 주소로 덮어써 둔다 — 실수로 dev 게이트웨이를 때리는 경로를 원천에서 없앤다.

### 알아 둘 제약 셋

1. **`next dev` 로 띄운다 (`next build && next start` 가 아니다).** `isMockEnabled()` 가 `NODE_ENV === 'production'` 에서 항상 false 라, 프로덕션 빌드로는 목을 쓸 수 없다.
2. **산출물 디렉터리를 `.next-e2e` 로 가른다** (`NEXT_DIST_DIR`). Next 16 은 한 디렉터리에 dev 서버를 하나만 허용해서, 갈라 두지 않으면 사람이 5174 에 띄워 둔 서버를 죽여야 돌아간다. 워크트리를 다른 세션과 공유하므로 남의 서버를 죽이게 된다.
3. **`toHaveScreenshot` 을 아직 쓰지 않는다.** dev 오버레이가 픽셀을 흔들고, 기준선은 macOS 와 CI(Linux)의 폰트 렌더가 달라 따로 관리해야 한다. 대신 `getComputedStyle` · `getBoundingClientRect` 실측을 단언한다 — 3층 표면 검토에서 실제로 결함을 잡아낸 것이 픽셀 비교가 아니라 이 값들이었다.

### 로그인

`e2e/auth.setup.ts` 가 **실제 로그인 폼으로** 들어가 `storageState` 를 만들고, 나머지 스펙이 그것을 나눠 쓴다. 세션 쿠키를 `seal()` 로 위조하지 않는다 — 그러면 로그인 경로가 검증되지 않고 세션 형식이 바뀔 때 그 파일만 조용히 낡는다. 계정은 목 저장소의 일반 계정(`demo@hondigagae.dev`)이다 (`src/lib/api/mock/store.ts`).

`e2e/.auth/` 는 `.gitignore` 대상이다. 목 계정이지만 쿠키 스냅샷이라 커밋하지 않는다.

### CI

`.github/workflows/frontend-ci.yml` 의 **별도 `e2e` job** 이고 **`continue-on-error: true`** 다. `pnpm verify`(= lint · typecheck · test) 안에 넣지 않는다 — 브라우저 내려받기와 서버 기동이 붙어 시간이 늘고, 기준이 안정될 때까지 PR 을 막지 않는다. 필수 체크로 올리는 시점은 [#467](https://github.com/8llow8llowMe/hondigagae/issues/467) 본문에서 정한다.

### 이 방식이 대체한 것

3층 표면 작업(#455) 내내 쓰던 **임시 하네스** — `renderToStaticMarkup` 결과를 `public/__check/*.html` 로 쓰고 dev 서버 CSS 를 링크해 눈으로 재던 방식이다. 커밋 전마다 손으로 지워야 했고 [#67](https://github.com/8llow8llowMe/hondigagae/issues/67) 이 그 한계를 추적했다. **더 쓰지 않는다.**
