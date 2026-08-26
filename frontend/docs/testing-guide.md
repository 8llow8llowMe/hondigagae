# Frontend Testing Guide

## 1. 방식 (이 저장소 고유)

- **`environment: 'node'`** — jsdom 없음, testing-library 없음, DOM 이벤트 시뮬레이션 없음
- `include`: `src/**/*.test.ts`, `app/**/*.test.ts` — **`.tsx` 는 수집되지 않는다**
- alias: `@` → `src`

| 항목 | 규칙 |
|------|------|
| 파일명 | `*.test.ts` (`.tsx` 아님) |
| 엘리먼트 생성 | JSX 대신 `createElement` |
| 렌더 | `renderToStaticMarkup` (react-dom/server) |
| 검증 | 결과 **마크업 문자열** 에 대한 `toContain` / `not.toContain` / `toMatch` |

**왜 이 방식인가**: 설정 부담이 거의 없고, 공모전 일정에서 순수 로직 커버리지를 빠르게 확보할 수 있다. 상호작용(클릭·입력) 테스트가 필요해지면 jsdom + testing-library를 추가 도입하고 이 문서를 갱신한다.

**한계 (반드시 알 것)**

- `async` server component는 `renderToStaticMarkup` 으로 렌더되지 않는다 → **안에서 쓰는 순수 함수를 뽑아 테스트한다.**
- React Query hook, Zustand store를 쓰는 컴포넌트는 렌더되지 않는다 → **props로 데이터를 받는 presentational 컴포넌트로 분리**한 뒤 그것을 테스트한다. 이 분리가 테스트 가능성의 핵심이다.
- 클릭·입력·포커스 이동은 검증할 수 없다. 그 부분은 `fe-design-reviewer` 의 브라우저 검토가 담당한다.

## 2. vitest.config.ts

```ts
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'app/**/*.test.ts'],
    globals: false,                       // describe/it/expect 를 명시적으로 import
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

- `dataHeader.success` 판별과 `resultMessage` 정규화 (**문자열이 아닐 수 있다**)
- HTTP 상태 → 에러 종류 매핑 (404 / 401 / 400 / 5xx)
- **비동기 job 상태 판정** — HTTP 200 + `status=FAILED` 를 **실패로** 판정하는지
- `SliceResponse` 페이지 병합과 `hasNext` 종료 판정
- 포맷 함수 (거리 m/km, 기온 ℃, 소요 시간 분, 금액 원, 날짜)
- 재발급 1회 제한 로직
- 좌표 파싱·검증 (`mapy`=위도 / `mapx`=경도, `null`·`0`·비수치 배제)
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

export function fail(resultCode: string, resultMessage: unknown = null): ApiResponse<never> {
  return { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null }
}

/** Bean Validation 실패처럼 resultMessage 가 문자열이 아닌 경우 */
export function failWithFields(resultCode: string, fields: Record<string, string>) {
  return fail(resultCode, fields)
}
```

```ts
// src/test/fixtures/place.ts  — Swagger 실측 응답 기준
import type { PlaceSummary } from '@/types/place'

export const placeSummary: PlaceSummary = {
  placeId: '126508',
  title: '제주특별자치도립김창열미술관',   // 긴 한국어 실데이터를 기본 fixture로
  mapx: '126.4106264',                    // 문자열로 온다
  mapy: '33.3616666',
  firstImage: null,                       // nullable
}
```

**fixture 규칙**

- 위치: `src/test/fixtures/<domain>.ts`. 테스트 파일 안에 인라인으로 흩뿌리지 않는다.
- **기본 fixture에 긴 한국어 실데이터를 넣는다.** 짧은 더미(`'테스트'`)를 쓰면 오버플로 문제를 영원히 못 잡는다.
- **nullable 필드의 기본값을 `null` 로 둔다.** non-null 가정 버그가 기본 경로에서 드러난다.
- 문자열 ID는 문자열로 둔다.
- 네트워크를 실제로 타지 않는다. `fetch` 를 모킹하지 말고 **함수에 fixture를 주입**하는 구조를 우선한다.

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

| 대상 | TDD | 이유 |
|------|-----|------|
| `src/lib/**` 순수 로직 (에러 판정, job 상태, 포맷, 좌표) | **적용** | 입출력이 명확하고 회귀 비용이 크다 |
| `src/lib/api/**` 래퍼 판별 | **적용** | 계약이 명세로 확정돼 있다 |
| presentational 컴포넌트의 상태 분기 | 구현 후 작성 | 마크업이 먼저 정해져야 assertion을 쓸 수 있다 |
| 레이아웃·스타일 | 미적용 | `fe-design-reviewer` 의 브라우저 검토가 담당 |
| React Query hook 배선 | 미적용 | node 환경에서 의미 있는 검증이 어렵다 |

버그를 만나면 `superpowers:systematic-debugging` 으로 근본원인을 찾고, **재현 테스트를 먼저 추가한 뒤** 고친다.

## 8. 커버리지 기준

**수치 목표를 두지 않는다.** 임계값 게이트는 의미 없는 테스트를 양산한다. 대신 **아래가 비어 있으면 미완성으로 본다.**

- [ ] 에러 분기 판정 함수
- [ ] 비동기 job 실패 판정 (HTTP 200 + `FAILED`)
- [ ] `resultMessage` 정규화 (비문자열 입력 포함)
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

| # | 대상 | 파일 | 핵심 주장 |
|---|------|------|-----------|
| 1 | `unwrap()` 래퍼 판별 | `src/lib/api/response.test.ts` | `success:false` 면 throw, `dataBody:null` 이면 throw |
| 2 | `toMessage()` 정규화 | `src/lib/api/response.test.ts` | 객체·`null`·빈 문자열 입력에서 폴백 문구 반환 |
| 3 | `classify(status)` | `src/lib/api/error.test.ts` | 404→`not-found`, 401→`unauthorized`, 400→`validation`, 500·0→`temporary` |
| 4 | `isJobFailed()` | `src/lib/ai-plan/job.test.ts` | **HTTP 200 + `status:'FAILED'` 를 실패로 판정** |
| 5 | `shouldKeepPolling()` | `src/lib/ai-plan/job.test.ts` | `COMPLETED`/`FAILED` 에서 `false` |
| 6 | `mergeSlices()` | `src/lib/api/slice.test.ts` | `contents` 누적, `hasNext:false` 에서 종료 |
| 7 | `formatDistance()` | `src/lib/format/distance.test.ts` | 999m→`999m`, 1200m→`1.2km`, `null`→`'-'` |
| 8 | `formatTemperature()` | `src/lib/format/temperature.test.ts` | 단위 `℃` 포함 |
| 9 | `toLatLng()` | `src/lib/geo/coord.test.ts` | **`mapy` 가 위도로 먼저**, `null`·`'0'`·`''` 는 `null` 반환 |
| 10 | `canRetryReissue()` | `src/lib/auth/reissue.test.ts` | 2회차 시도에서 `false` |
| 11 | **필터 round-trip** | `src/lib/url/place-filters.test.ts` | `parse(toQuery(f)) === f` — 기본값 생략·콤마 배열 인코딩 포함 |

이 11개가 통과하면 `docs/done-checklist.md` §7의 절반이 자동으로 충족된다.

**#11 을 따로 둔 이유**: 기본값을 URL에서 생략하는 규칙(`architecture-guide.md` §10) 때문에 직렬화와 파싱이 비대칭이 되기 쉽다. round-trip 테스트가 이 비대칭을 바로 잡아낸다. 필터가 늘어날 때마다 케이스를 추가한다.
