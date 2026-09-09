# 긴급 시설 화면을 장소 찾기 지도 문법으로 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/emergency` 의 지도 보기를 `/places` 지도 보기와 같은 레이아웃·같은 상호작용으로 만들고, 시설 제목·행·핀 어디를 눌러도 지도가 도로 단위로 확대되게 한다.

**Architecture:** 지도가 바탕이 되고 목록이 그 위에 얹힌다 — 데스크톱은 좌측 400 부동 패널, 모바일은 3단 하단 시트(`MapSheet`). 첫 카메라는 `framedCamera`(신규 순수 함수)가 anchor 와 조회 반경으로 역산하고, `MapCanvas` 는 새 `camera` prop 으로 그것을 받는다. 조회는 지금처럼 내 위치 기준 한 번이고 **지도를 옮겨도 재조회하지 않는다** — 대신 이미 받은 배열을 지도 영역으로 거른다.

**Tech Stack:** Next.js App Router (Turbopack) · React 19 · TanStack Query · Tailwind v4 · 카카오 지도 SDK · vitest (node 환경 + `renderToStaticMarkup` 문자열 assertion, jsdom 없음)

**Spec:** `docs/superpowers/specs/2026-09-09-emergency-map-unification-design.md`

## Global Constraints

모든 태스크의 요구사항에 아래가 암묵적으로 포함된다.

- **작업 워크트리는 `/Users/seonghoho/Documents/projects/hondigagae-353` 다.** 브랜치는 `refactor/fe/353-emergency-map-unification`, 이슈는 [#353](https://github.com/8llow8llowMe/hondigagae/issues/353). 아래 모든 경로와 명령은 그 워크트리의 `frontend/` 기준이다
- **원래 트리(`../hondigagae`)를 건드리지 않는다.** 다른 세션이 쓰고 있다
- **`git add -A` / `git add .` / `git stash` 를 쓰지 않는다.** 경로를 하나씩 적어 스테이징한다 (`docs/git-workflow.md` §4-1)
- **모든 파일은 UTF-8 (no BOM).** `.editorconfig` · `.gitattributes` 를 덮어쓰지 않는다
- **백엔드를 브라우저에서 직접 부르지 않는다.** 전부 `/api/bff` 경유 (`clientFetch`)
- **`facilityId` 는 `string`** 이다. Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다
- **서버 enum metadata(`{code,name,description}`)를 그대로 렌더한다.** 단, **필터 칩 라벨만 예외**다 — 개수 0 인 칩은 표본이 없어 서버 값을 얻을 수 없다 (`messages/emergency.ts` 의 `typeByCode` 주석)
- **컴포넌트 `className` 으로 외형(색·radius·shadow·padding)을 덮지 않는다.** 레이아웃 유틸리티만
- 문구 어미는 **해요체** (`DESIGN.md` §1). 새 문구는 전부 `src/lib/messages/` 에 둔다
- 터치 타겟 최소 44px, 전화 버튼은 52px (`DESIGN.md` §7)
- 커밋 제목은 `[FE] <type>: <요약>` (`feat`/`fix`/`chore`/`refactor`/`style`/`docs`/`test`). 문서만 바꾸는 커밋은 `[DOCS] docs:`
- 검증 명령은 `pnpm verify` (= `lint && typecheck && test`) 와 `pnpm format:check`
- dev 서버는 **`pnpm dev:alt` (포트 5174)** 로 띄운다. 3000 은 카카오 지도 키에 도메인이 등록돼 있지 않아 지도가 항상 폴백으로 떨어진다
- **`/places` 의 화면 결과를 바꾸지 않는다.** 공유 코드를 꺼내 쓸 뿐이다. `src/features/place/**` 에서 고치는 것은 **단 한 줄** — `place-map-view.tsx` 의 `<MapSheet label="장소 목록">` 인자다 (Task 3). `MapSheet.label` 을 필수 prop 으로 만들면 그 호출부가 타입 에러가 되므로 피할 수 없고, 값이 이전 하드코딩과 같은 문자열이라 화면은 바뀌지 않는다. **그 외에는 한 줄도 고치지 않는다.**

---

## File Structure

**새로 만드는 것**

| 파일 | 책임 |
| --- | --- |
| `src/test/fixtures/emergency.ts` | `facility()` 픽스처 — 지금 `emergency-section.test.ts` 안에 있는 것을 꺼내 세 테스트가 공유 |
| `src/features/emergency/emergency-map-view.tsx` | 지도 갈래 조립 (지도 + 패널 + 시트 + 컨트롤) |
| `src/features/emergency/emergency-list-view.tsx` | 목록 갈래 + SDK 실패 폴백 |
| `src/features/emergency/use-emergency-board.ts` | 위치 · 반경 · 필터 · 조회를 소유. 두 갈래가 같은 상태 모델을 쓴다 |
| `src/features/emergency/emergency-filter-bar.tsx` | 패널 머리 · 시트 툴바 공용 필터 줄 |
| `src/features/emergency/emergency-filter-bar.test.ts` | 개수 배열 · 반경 라벨 · 노출 조건 |
| `src/features/emergency/emergency-map-panel.tsx` | 패널·시트 안의 선택 가능한 목록 |
| `src/features/emergency/emergency-map-panel.test.ts` | 선택 표현 · 좌표 없음 · 길찾기 노출 |
| `src/features/emergency/facility-row.test.ts` | 행 구조 (중첩 금지 · 전화 자리 · 길찾기 조건) |

**고치는 것**

| 파일 | 변경 |
| --- | --- |
| `src/lib/map/viewport.ts` | `levelForSpanMeters` · `framedCamera` 추가 |
| `src/lib/map/viewport.test.ts` | 위 둘의 테스트 추가 |
| `src/features/map/map-canvas.tsx` | `camera` prop 추가. 기존 `center` 는 그대로 |
| `src/lib/geo/coord.ts` | `SELECTED_FACILITY_MAP_LEVEL = 4` 추가 |
| `src/components/map-sheet.tsx` | `label` prop 추가 (`messages.map.sheetLabel` 하드코딩 제거) |
| `src/lib/messages/map.ts` | `sheetLabel` 제거 (호출부 인자로 이동) |
| `src/lib/messages/emergency.ts` | `sheetLabel` · 영역 0건 문구 · 반경 문구 추가 |
| `src/features/emergency/facility-filters.ts` | `labelWithCount` 를 export (지금 두 곳에서 사복될 예정) |
| `src/features/emergency/facility-row.tsx` | `FacilityRowContent` · `CallButton` export. 선택 버튼 + 길찾기 |
| `src/features/emergency/emergency-section.tsx` | `withCount` 로컬 함수를 공용 `labelWithCount` 로 갈아탄다 (ruling F2 로 `countBase` 는 넣지 않는다) |
| `src/features/emergency/emergency-section.test.ts` | 로컬 `facility()` 를 공용 픽스처 import 로 교체 |
| `src/lib/url/view-mode.ts` | `EMERGENCY_DEFAULT_VIEW` 추가, 기본값 주석 갱신 |
| `src/lib/url/view-mode.test.ts` | 새 상수 테스트 추가 |
| `app/(main)/emergency/page.tsx` | 두 갈래 분기 |
| `app/globals.css` | `emergency-map-height` 삭제 |

**지우는 것** (Task 9)

| 파일 | 이유 |
| --- | --- |
| `src/features/emergency/emergency-view.tsx` | 두 갈래 뷰 + 훅으로 갈라진다 |
| `src/features/emergency/emergency-map.tsx` | `EmergencyMapView` 가 `MapCanvas` 를 직접 조립한다 |
| `src/features/emergency/facility-selected-card.tsx` | 부동 카드를 걷는다 (spec §4) |
| `src/features/emergency/facility-selected-card.test.ts` | 위와 함께 |

---

## Task 1: 카메라 계산 — `levelForSpanMeters` · `framedCamera`

지도 첫 화면의 중심과 확대 단계를 **순수 함수로** 만든다. `MapCanvas` 안에서 계산하면 SDK 없이 테스트할 수 없다.

**Files:**
- Modify: `src/lib/map/viewport.ts`
- Test: `src/lib/map/viewport.test.ts`
- Create: `src/test/fixtures/emergency.ts`

**Interfaces:**
- Consumes: 기존 `metersPerPixel(level)` · `framedCenterLat(anchorLat, heightPx, level, seaRatio)` (같은 파일)
- Produces:
  - `levelForSpanMeters(meters: number, pixels: number): number`
  - `framedCamera(input: { anchor: LatLng; spanMeters: number; width: number; height: number; seaRatio: number }): { lat: number; lng: number; level: number }`
  - `facility(overrides?: Partial<NearbyFacilityItem>): NearbyFacilityItem` (fixtures)

- [ ] **Step 1: 픽스처를 꺼낸다**

`src/test/fixtures/emergency.ts` 를 만든다. 내용은 `src/features/emergency/emergency-section.test.ts` 안의 `facility()` 를 그대로 옮긴 것이다 (Task 7 에서 그 파일이 이것을 import 하도록 바꾼다).

```ts
import type { NearbyFacilityItem, NearbyFacilityResult } from '@/types/emergency'

/**
 * 긴급 시설 한 곳. 기본값은 **모든 정보가 갖춰진 병원**이다 —
 * 각 테스트가 없애고 싶은 것만 `null` 로 덮어쓴다.
 */
export function facility(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return {
    facilityId: '4611686018427387904',
    facilityType: { code: 'ANIMAL_HOSPITAL', name: '동물병원', description: null },
    name: '제주24시동물병원',
    addr: '제주특별자치도 제주시 연북로 100',
    lat: 33.48,
    lng: 126.49,
    tel: '064-000-0000',
    operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
    restDate: '일요일',
    open24: true,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 480,
    ...overrides,
  }
}

/** 약국 — 유형 배지와 마커 톤 낮춤이 걸리는 쪽 */
export function pharmacy(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return facility({
    facilityId: '4611686018427387905',
    facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
    name: '한라동물약국',
    open24: false,
    openNow: false,
    distanceMeters: 1200,
    ...overrides,
  })
}

export function facilityResult(
  overrides: Partial<NearbyFacilityResult> = {},
): NearbyFacilityResult {
  const facilities = overrides.facilities ?? [facility(), pharmacy()]

  return {
    facilities,
    totalCount: facilities.length,
    radius: 10_000,
    open24Only: false,
    providerName: '제주특별자치도',
    ...overrides,
  }
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/lib/map/viewport.test.ts` 의 import 에 `framedCamera` 와 `levelForSpanMeters` 를 더하고, 파일 끝에 붙인다.

```ts
describe('levelForSpanMeters', () => {
  /*
    반경 10km = 지름 20km. 카카오는 level 이 작을수록 확대이고
    픽셀당 미터가 `0.25 × 2^(level-1)` 이다.
  */
  it('반경 10km 를 375px 에 담으면 level 9 다 (64m/px × 375 = 24km)', () => {
    expect(levelForSpanMeters(20_000, 375)).toBe(9)
  })

  it('같은 반경을 800px 에 담으면 한 단계 더 확대된다 (32m/px × 800 = 25.6km)', () => {
    expect(levelForSpanMeters(20_000, 800)).toBe(8)
  })

  it('반경을 넓히면 단계가 따라 올라간다 — "보는 범위 = 조회한 범위"', () => {
    expect(levelForSpanMeters(40_000, 375)).toBe(10)
    expect(levelForSpanMeters(80_000, 375)).toBe(11)
  })

  it('딱 맞는 폭은 담기는 것으로 본다 (경계 포함)', () => {
    // level 8 · 375px = 12,000m
    expect(levelForSpanMeters(12_000, 375)).toBe(8)
    expect(levelForSpanMeters(12_001, 375)).toBe(9)
  })

  it('픽셀을 모르면(0) 대체 높이로 계산한다 — 0 을 그대로 쓰면 최대 축소가 된다', () => {
    // FALLBACK_HEIGHT_PX(640) 기준: level 9 = 64 × 640 = 40,960m
    expect(levelForSpanMeters(20_000, 0)).toBe(levelForSpanMeters(20_000, 640))
  })

  it('아무리 넓어도 카카오 상한 14 를 넘기지 않는다', () => {
    expect(levelForSpanMeters(40_000_000, 375)).toBe(14)
  })

  it('폭이 0 이하면 최대 축소로 떨어뜨린다 — 계산 불가를 예외로 던지지 않는다', () => {
    expect(levelForSpanMeters(0, 375)).toBe(14)
    expect(levelForSpanMeters(-1, 375)).toBe(14)
  })
})

describe('framedCamera', () => {
  const anchor = { lat: 33.4996213, lng: 126.5311884 }

  it('짧은 변으로 단계를 정한다 — 긴 변으로 맞추면 짧은 변에서 잘린다', () => {
    const wide = framedCamera({ anchor, spanMeters: 20_000, width: 1280, height: 800, seaRatio: 0.35 })

    expect(wide.level).toBe(levelForSpanMeters(20_000, 800))
  })

  it('경도는 anchor 그대로다 — 틀잡기는 위도만 옮긴다', () => {
    const camera = framedCamera({ anchor, spanMeters: 20_000, width: 375, height: 700, seaRatio: 0.35 })

    expect(camera.lng).toBe(anchor.lng)
  })

  it('seaRatio 0.35 면 중심이 anchor 보다 남쪽이다 — anchor 가 화면 위쪽에 온다', () => {
    const camera = framedCamera({ anchor, spanMeters: 20_000, width: 375, height: 700, seaRatio: 0.35 })

    expect(camera.lat).toBeLessThan(anchor.lat)
  })

  it('seaRatio 0.5 면 anchor 가 그대로 중심이다', () => {
    const camera = framedCamera({ anchor, spanMeters: 20_000, width: 375, height: 700, seaRatio: 0.5 })

    expect(camera.lat).toBeCloseTo(anchor.lat, 10)
  })

  it('framedCenterLat 과 같은 값을 준다 — 두 경로가 갈리면 첫 화면 구도가 달라진다', () => {
    const camera = framedCamera({ anchor, spanMeters: 20_000, width: 375, height: 700, seaRatio: 0.35 })

    expect(camera.lat).toBe(framedCenterLat(anchor.lat, 700, camera.level, 0.35))
  })
})
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `pnpm vitest run src/lib/map/viewport.test.ts`
Expected: FAIL — `levelForSpanMeters is not a function` / `framedCamera is not a function` (import 자체가 깨져 파일 전체가 실패한다)

- [ ] **Step 4: 최소 구현을 쓴다**

`src/lib/map/viewport.ts` 의 `framedCenterLat` **아래**에 붙인다 (`FALLBACK_HEIGHT_PX` 와 같은 모듈이어야 한다).

```ts
/**
 * 카카오 확대 단계의 범위. **작을수록 확대**다.
 *
 * SDK 가 상수로 노출하지 않아 여기 적어 둔다 — 범위를 벗어난 값을 `setLevel` 에 넣으면
 * 조용히 무시되고, 그러면 첫 화면이 "왜 이 확대인지" 설명할 수 없는 상태가 된다.
 */
const MIN_MAP_LEVEL = 1
const MAX_MAP_LEVEL = 14

/**
 * `meters` 가 `pixels` 안에 들어오는 **가장 작은(= 가장 확대된) 확대 단계.**
 *
 * 긴급 시설 화면이 "내 위치 반경 10km 를 조회했으니 그만큼을 보여준다" 를 지키기 위한
 * 역산이다. 단계를 상수로 박으면 뷰포트마다 보이는 범위가 달라져, 375 에서는 반경
 * 절반이 화면 밖이고 1280 에서는 빈 바다가 절반이 된다.
 *
 * **경계는 담기는 쪽으로 본다** (`>=`). 딱 맞는 폭을 한 단계 더 축소하면 조회 범위
 * 바깥이 화면에 들어오고, 그 자리는 재조회하지 않는 이 화면에서 영구히 비어 보인다.
 *
 * `pixels` 가 0 이면 `framedCenterLat` 과 같은 대체 높이를 쓴다 — 시트나 탭 뒤에서
 * 지도가 만들어지면 `clientHeight` 가 0 이고, 그대로 계산하면 최대 축소로 떨어진다.
 */
export function levelForSpanMeters(meters: number, pixels: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return MAX_MAP_LEVEL

  const span = Number.isFinite(pixels) && pixels > 0 ? pixels : FALLBACK_HEIGHT_PX

  for (let level = MIN_MAP_LEVEL; level <= MAX_MAP_LEVEL; level += 1) {
    if (metersPerPixel(level) * span >= meters) return level
  }

  return MAX_MAP_LEVEL
}

/**
 * 기준점과 담고 싶은 폭으로 **첫 카메라(중심 + 확대 단계)** 를 만든다.
 *
 * `framedCenterLat` 과 `levelForSpanMeters` 를 한 번에 묶는다 — 두 함수를 호출부가
 * 따로 부르면 **level 을 두 번 정하게 되고**(하나는 확대용, 하나는 위도 폭 환산용)
 * 둘이 어긋나면 구도가 조용히 틀어진다.
 *
 * **짧은 변으로 단계를 정한다.** 긴 변에 맞추면 짧은 변에서 잘려 조회 범위의 일부가
 * 화면 밖에 남는다.
 */
export function framedCamera(input: {
  anchor: LatLng
  /** 화면에 담고 싶은 폭(m). 반경이면 **지름**을 넘긴다 */
  spanMeters: number
  width: number
  height: number
  /** 기준점이 화면 위쪽 몇 할 지점에 올지. 0.5 면 정중앙 */
  seaRatio: number
}): { lat: number; lng: number; level: number } {
  const level = levelForSpanMeters(input.spanMeters, Math.min(input.width, input.height))

  return {
    lat: framedCenterLat(input.anchor.lat, input.height, level, input.seaRatio),
    lng: input.anchor.lng,
    level,
  }
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인한다**

Run: `pnpm vitest run src/lib/map/viewport.test.ts`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/map/viewport.ts src/lib/map/viewport.test.ts src/test/fixtures/emergency.ts
git commit -m "[FE] feat: 반경에서 지도 첫 카메라를 역산하는 순수 함수를 더한다"
```

---

## Task 2: `MapCanvas` 에 `camera` prop

좌표가 도착하기를 기다리지 않고 지도를 먼저 그린 뒤, 좌표가 오면 카메라를 한 번 확정한다.

**Files:**
- Modify: `src/features/map/map-canvas.tsx`

**Interfaces:**
- Consumes: `framedCamera` (Task 1)
- Produces: `MapCanvas` 의 새 prop — `camera?: { anchor: LatLng; spanMeters: number } | null`

**이 태스크에는 단위 테스트가 없다.** 카카오 SDK 가 있어야 돌고 이 저장소에는 jsdom 이 없다. 계산은 Task 1 이 덮었고, 적용은 Task 10 의 브라우저 실측으로 확인한다. 대신 **`/places` 무회귀**를 `pnpm verify` 와 Task 10 실측으로 지킨다 — 기존 `center` prop 을 남기고 호출부를 건드리지 않는 것이 그 장치다.

- [ ] **Step 1: prop 을 선언한다**

`src/features/map/map-canvas.tsx` 의 props 목록에서 `center` 바로 아래에 더한다.

```tsx
  /**
   * **기준점 + 담고 싶은 폭으로 카메라를 확정한다.** `center` 와 달리 확대 단계까지 함께
   * 옮긴다.
   *
   * 좌표를 비동기로 얻는 화면(`/emergency`)이 쓴다. 지도는 모듈 상수 기준으로 **먼저**
   * 만들고, 좌표가 도착하면 이것으로 한 번 옮긴다 — `position` 을 기다렸다가 만들면
   * 위치 타임아웃(10초)만큼 지도가 비어 있다.
   *
   * **호출부는 반드시 `useMemo` 로 만든다.** 렌더 중에 새 객체를 만들면 참조가 매번
   * 바뀌어 필터를 누를 때마다 카메라가 되돌아간다.
   */
  camera?: { anchor: LatLng; spanMeters: number } | null
```

시그니처의 구조분해에도 `camera,` 를 더한다 (`center,` 옆).

- [ ] **Step 2: import 를 더한다**

```tsx
import { framedCamera, framedCenterLat, type MapBounds } from '@/lib/map/viewport'
```

(`JEJU_MAP_SEA_RATIO` 는 이미 `@/lib/geo/coord` 에서 import 돼 있다.)

- [ ] **Step 3: 적용 effect 를 더한다**

기존 "밖에서 중심을 옮길 때 (현재 위치 버튼)" effect **바로 아래**에 붙인다.

```tsx
  /*
    ── 밖에서 카메라를 확정할 때 (좌표가 늦게 도착하는 화면) ────────────────

    **`center` effect 와 나란히 두고 합치지 않는다.** 둘이 하는 일이 다르다 —
    `center` 는 확대를 건드리지 않고 옮기기만 하고(사용자가 맞춰 둔 확대를 지킨다),
    이쪽은 확대까지 확정한다(조회 범위와 보이는 범위를 맞춘다). 한 effect 로 묶으면
    어느 쪽 의도로 불렸는지 알 수 없다.

    컨테이너 크기를 여기서 읽는다 — 이 컴포넌트가 그것을 아는 유일한 곳이다.
  */
  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    const container = containerRef.current
    if (map === null || maps === null || container === null) return
    if (camera === null || camera === undefined) return

    const next = framedCamera({
      anchor: camera.anchor,
      spanMeters: camera.spanMeters,
      width: container.clientWidth,
      height: container.clientHeight,
      seaRatio: JEJU_MAP_SEA_RATIO,
    })

    // **단계를 먼저, 중심을 나중에.** 순서가 뒤집히면 옛 중심을 확대한 뒤 옮기게 되어
    // 한 프레임 동안 엉뚱한 곳이 보인다 (선택 핀 확대에서 같은 판단을 했다)
    map.setLevel(next.level)
    map.setCenter(new maps.LatLng(next.lat, next.lng))
  }, [camera, status])
```

**`status` 를 의존성에 넣는 이유:** SDK 로드가 끝나기 전에 `camera` 가 도착하면 `mapRef.current` 가 아직 `null` 이라 이 effect 가 아무 일도 못 한다. `status` 가 `'ready'` 로 바뀔 때 한 번 더 돌아야 그 카메라가 적용된다.

- [ ] **Step 4: 검증**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. `/places` 는 `camera` 를 넘기지 않으므로 `camera === undefined` 로 조기 반환한다 — 동작 무변경

- [ ] **Step 5: 커밋**

```bash
git add src/features/map/map-canvas.tsx
git commit -m "[FE] feat: MapCanvas 가 기준점과 폭으로 카메라를 확정할 수 있게 한다"
```

---

## Task 3: 공유 상수 · 문구 · `MapSheet` 라벨

여러 태스크가 함께 쓰는 상수와 문구를 먼저 놓는다. 뒤 태스크들이 이것을 import 한다.

**Files:**
- Modify: `src/lib/geo/coord.ts`
- Modify: `src/lib/messages/emergency.ts`
- Modify: `src/lib/messages/map.ts`
- Modify: `src/components/map-sheet.tsx`
- Modify: `src/features/place/place-map-view.tsx` — **예외적으로 한 줄만** (`label` 인자 추가). 이것 없이는 타입이 깨진다
- Modify: `src/features/emergency/facility-filters.ts`
- Test: `src/components/map-sheet.test.ts` (신규)

**Interfaces:**
- Produces:
  - `SELECTED_FACILITY_MAP_LEVEL = 4` (`@/lib/geo/coord`)
  - `MapSheet` 의 필수 prop `label: string`
  - `labelWithCount(label: string, count: number, show: boolean): string` (`@/features/emergency/facility-filters`)
  - `messages.emergency.sheetLabel` · `.emptyInViewDescription` · `.radiusLabel` · `.radiusGroupLabel`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/map-sheet.test.ts` 를 만든다.

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MapSheet, nextStop } from '@/components/map-sheet'

function render(label: string) {
  return renderToStaticMarkup(
    createElement(MapSheet, {
      label,
      stop: 'mid' as const,
      onStopChange: () => undefined,
      header: createElement('p', null, '지도에 보이는 2곳'),
      children: createElement('ul', null),
    }),
  )
}

describe('MapSheet', () => {
  it('시트 이름을 호출부가 정한다 — 병원 목록이 "장소 목록" 으로 읽히면 안 된다', () => {
    expect(render('병원 · 약국 목록')).toContain('aria-label="병원 · 약국 목록"')
  })

  it('다른 화면은 다른 이름을 준다', () => {
    expect(render('장소 목록')).toContain('aria-label="장소 목록"')
  })

  it('한 번에 한 단계씩만 움직인다 — 최소에서 크게 끌어도 최대로 뛰지 않는다', () => {
    expect(nextStop('min', -500)).toBe('mid')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm vitest run src/components/map-sheet.test.ts`
Expected: FAIL — `label` 이 알 수 없는 prop 이라 `aria-label` 에 여전히 `'장소 목록'` 이 박혀 있다 (첫 테스트가 통과할 수도 있으나 두 번째가 실패한다)

- [ ] **Step 3: `MapSheet` 에 `label` 을 더한다**

`src/components/map-sheet.tsx`:

props 타입에 더한다.

```tsx
  /**
   * 시트의 접근성 이름. **화면마다 다르다** — 장소 찾기는 "장소 목록", 긴급 시설은
   * "병원 · 약국 목록" 이다. 문구를 이 컴포넌트가 들고 있던 시절에는 병원 목록이
   * "장소 목록" 으로 읽혔다.
   */
  label: string
```

구조분해에 `label,` 을 더하고, `<section aria-label={messages.map.sheetLabel}` 을 `<section aria-label={label}` 으로 바꾼다.

`messages` import 가 파일 안에서 다른 곳(`collapseSheet` · `expandSheet`)에도 쓰이므로 **import 는 남긴다.**

- [ ] **Step 4: `sheetLabel` 을 옮긴다**

`src/lib/messages/map.ts` 에서 아래 한 줄을 **지운다.**

```ts
  sheetLabel: '장소 목록',
```

`src/features/place/place-map-view.tsx` 의 `<MapSheet` 에 인자를 더한다 — **이 계획에서 `features/place` 를 고치는 유일한 곳이고, 값이 이전과 같은 문자열이라 화면은 바뀌지 않는다.**

```tsx
      <MapSheet
        label="장소 목록"
        stop={sheetStop}
```

- [ ] **Step 5: 긴급 문구를 더한다**

`src/lib/messages/emergency.ts` 의 `// ── 상태 ───` 절 앞에 붙인다.

```ts
  // ── 지도 ───────────────────────────────────────────────────────────────

  /** `MapSheet` 의 접근성 이름. **`/places` 와 달라야 한다** */
  sheetLabel: '병원 · 약국 목록',

  /**
   * 지도를 반경 밖으로 옮겨 영역 안이 0건일 때.
   *
   * **"조건을 풀어 보세요" 로 끝내지 않는다** (`messages.map.emptyInViewDescription` 은
   * 그렇게 말한다). 이 화면은 지도를 옮겨도 재조회하지 않으므로, 반경 밖으로 나간
   * 사용자에게 필요한 것은 조건이 아니라 **반경**이다.
   */
  emptyInViewDescription: '지도를 조회한 범위로 되돌리거나 반경을 넓혀 보세요.',

  /** 반경 칩 라벨. `{radius}` 치환 — 서버가 준 값을 그대로 쓴다 */
  radiusLabel: '반경 {radius}',
  /** 반경 선택 시트의 축 이름 */
  radiusGroupLabel: '검색 반경',
  /** 반경 선택 시트 제목 */
  radiusSheetTitle: '반경 고르기',
```

- [ ] **Step 6: 선택 확대 단계를 더한다**

`src/lib/geo/coord.ts` 의 `SELECTED_PLACE_MAP_LEVEL` **아래**에 붙인다.

```ts
/**
 * 긴급 시설에서 **한 곳을 고를 때** 맞추는 확대 단계.
 *
 * `SELECTED_PLACE_MAP_LEVEL`(5) 보다 **한 단계 깊다.** 장소 찾기가 5 에서 멈춘 이유는
 * 위에 적힌 대로 "4로 내리면 목록이 한두 건으로 남아 다음 카드를 이어 누를 수가 없다"
 * 인데, 이 화면은 밀도가 다르다 — 반경 10km 안에 136곳이다
 * (`docs/features/emergency/공통명세.md` E2-1 · dev 실측 2026-09-08).
 *
 * 그리고 `cellSizeFor(4) === 0` 이라(`lib/map/cluster.ts`) **묶음이 전부 풀려 개별 핀이
 * 된다.** 1280 폭에서 2.6km, 375 폭에서 750m — 도로와 골목이 읽히는 단계다. 아픈 개를
 * 안고 "그래서 이게 어디냐" 를 묻는 화면이라 동네가 아니라 건물이 보여야 한다.
 */
export const SELECTED_FACILITY_MAP_LEVEL = 4
```

- [ ] **Step 7: `labelWithCount` 를 꺼낸다**

`src/features/emergency/facility-filters.ts` 끝에 붙인다.

```ts
/**
 * 칩 라벨에 개수를 붙인다. **붙일 수 있을 때만 붙인다** — 잘린 목록에서 센 수는
 * 전체가 아니고, 틀린 개수는 없는 개수보다 나쁘다 (`countsAreComplete`).
 *
 * 목록 갈래(`EmergencySection`)와 지도 갈래(`EmergencyFilterBar`)가 함께 쓴다.
 * 각자 갖고 있으면 한쪽만 고쳐져 같은 칩이 화면마다 다르게 보인다.
 */
export function labelWithCount(label: string, count: number, show: boolean): string {
  return show ? `${label} ${String(count)}` : label
}
```

- [ ] **Step 8: 테스트가 통과하는 것을 확인한다**

Run: `pnpm vitest run src/components/map-sheet.test.ts && pnpm typecheck`
Expected: PASS. typecheck 가 `messages.map.sheetLabel` 을 쓰는 곳이 남아 있으면 잡아 준다

- [ ] **Step 9: 커밋**

```bash
git add src/lib/geo/coord.ts src/lib/messages/emergency.ts src/lib/messages/map.ts src/components/map-sheet.tsx src/components/map-sheet.test.ts src/features/place/place-map-view.tsx src/features/emergency/facility-filters.ts
git commit -m "[FE] refactor: 지도 시트 이름을 호출부로 올리고 긴급 시설 공유 상수를 더한다"
```

---

## Task 4: `FacilityRow` — 내용 추출 · 선택 · 길찾기

행이 선택 가능해지고, 선택되면 길찾기가 나온다. **`<a>` 를 `<button>` 안에 넣지 않는다.**

**Files:**
- Modify: `src/features/emergency/facility-row.tsx`
- Test: `src/features/emergency/facility-row.test.ts` (신규)

**Interfaces:**
- Consumes: `facility()` (Task 1), `directionsUrl` (`@/lib/geo/map-link`), `messages.map.directions`
- Produces:
  - `FacilityRowContent({ facility, showDistance }): JSX` — 이름·배지·시간·거리·주소만. 래퍼와 액션은 호출부가 붙인다
  - `CallButton({ name, tel }): JSX` — 52px 전화. `tel === null` 이면 비활성 자리
  - `DirectionsLink({ facility }): JSX | null` — 좌표가 없으면 `null`
  - `FacilityRow({ facility, showDistance, last })` — 목록 갈래용. **동작 무변경**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/emergency/facility-row.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { DirectionsLink, FacilityRow, FacilityRowContent } from '@/features/emergency/facility-row'
import { messages } from '@/lib/messages'
import { facility } from '@/test/fixtures/emergency'

describe('FacilityRowContent', () => {
  it('이름과 진료시간 원문을 그대로 쓴다 — 요약하지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(), showDistance: true }),
    )

    expect(markup).toContain('제주24시동물병원')
    expect(markup).toContain('월~금 09:00~19:00, 토 09:00~13:00')
  })

  it('showDistance 가 false 면 거리를 감춘다 — 제주 중심 기준 거리를 내 위치로 읽는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(), showDistance: false }),
    )

    expect(markup).not.toContain('480m')
  })

  it('내용에는 링크도 버튼도 없다 — 호출부가 선택 버튼으로 감쌀 수 있어야 한다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRowContent, { facility: facility(), showDistance: true }),
    )

    expect(markup).not.toContain('<a ')
    expect(markup).not.toContain('<button')
  })
})

describe('DirectionsLink', () => {
  it('좌표가 있으면 길찾기를 준다', () => {
    const markup = renderToStaticMarkup(
      createElement(DirectionsLink, { facility: facility() }),
    )

    expect(markup).toContain(messages.map.directions)
    expect(markup).toContain('target="_blank"')
  })

  it('좌표가 없으면 아무것도 그리지 않는다 — 눌러도 못 가는 버튼은 없는 것만 못하다', () => {
    const markup = renderToStaticMarkup(
      createElement(DirectionsLink, { facility: facility({ lat: 0, lng: 0 }) }),
    )

    expect(markup).toBe('')
  })
})

describe('FacilityRow', () => {
  it('번호가 없어도 전화 자리를 비우지 않는다 — 자리가 사라지면 화면이 깨진 것으로 읽힌다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility({ tel: null }), showDistance: true }),
    )

    expect(markup).toContain(messages.emergency.telMissing)
    // 아이콘 자리는 남는다
    expect(markup).toContain('<svg')
  })

  it('번호가 있으면 tel 링크에서 숫자 아닌 문자를 걷는다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, {
        facility: facility({ tel: '064-000-0000' }),
        showDistance: true,
      }),
    )

    expect(markup).toContain('href="tel:0640000000"')
  })

  it('목록 갈래에는 길찾기를 두지 않는다 — 급할 때 누를 것이 둘이면 고르는 데 시간이 든다', () => {
    const markup = renderToStaticMarkup(
      createElement(FacilityRow, { facility: facility(), showDistance: true }),
    )

    expect(markup).not.toContain(messages.map.directions)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm vitest run src/features/emergency/facility-row.test.ts`
Expected: FAIL — `FacilityRowContent` / `DirectionsLink` 를 export 하지 않는다

- [ ] **Step 3: `facility-row.tsx` 를 재구성한다**

파일 전체를 아래로 바꾼다. **`FacilityRow` 의 렌더 결과는 이전과 같다** — 내용을 함수로 갈랐을 뿐이다.

```tsx
import { Badge } from '@/components/badge'
import { PhoneIcon } from '@/components/icons'
import { Row } from '@/components/surface'
import { formatDistance } from '@/lib/format/distance'
import { directionsUrl } from '@/lib/geo/map-link'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 긴급 시설 행 — 아트보드 `혼디가개 긴급 시설` 01.
 *
 * **약국을 따로 묶지 않는다.** 유형이 다르다고 섹션을 나누면 "4.46km 약국" 이
 * "3.12km 병원" 보다 위로 올라간다. 거리가 우선이고 유형은 태그로 구분한다
 * (아트보드 주석).
 *
 * **진료시간은 서버 문자열 그대로 렌더한다.** `"월~금 09:00~19:00, 토 09:00~13:00"` 을
 * 파싱해 "오늘 19:00까지" 로 요약하지 않는다 — 서식이 조금만 달라도 틀린 시간을 말하게 된다.
 *
 * **내용(`FacilityRowContent`)과 액션(`CallButton` · `DirectionsLink`)이 갈려 있다.**
 * 지도 패널은 내용만 선택 버튼으로 감싸고 액션은 그 **형제**로 둔다 —
 * `<a>` 를 `<button>` 안에 넣을 수 없다. 내용을 복제하면 두 목록의 행이 갈리므로
 * 여기서 공유한다.
 */
export function FacilityRow({
  facility,
  /** 위치 폴백이면 거리를 숨긴다 — 제주 중심에서 480m 인 것을 "480m" 라고 쓸 수 없다 */
  showDistance,
  last = false,
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  last?: boolean
}) {
  return (
    <Row as="li" last={last}>
      <div className="flex items-center gap-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FacilityRowContent facility={facility} showDistance={showDistance} />
        </div>

        <CallButton name={facility.name} tel={facility.tel} />
      </div>
    </Row>
  )
}

/**
 * 행이 보여주는 사실 — 이름 · 유형 · 영업 상태 · 진료시간 · 거리 · 주소.
 *
 * **링크도 버튼도 두지 않는다.** 호출부가 이것을 선택 버튼으로 감싸므로, 여기에
 * interactive content 가 있으면 중첩이 된다. 시설 상세 라우트가 없어(이슈 #148)
 * 제목을 링크로 만들 이유도 없다.
 *
 * `<div className="flex min-w-0 flex-1 flex-col gap-1.5">` 는 **호출부가 씌운다** —
 * 목록 행과 지도 패널 행에서 그 래퍼가 각각 다른 것(`div` / `button`)이어야 한다.
 */
export function FacilityRowContent({
  facility,
  showDistance,
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
}) {
  const meta = [
    showDistance ? formatDistance(facility.distanceMeters) : null,
    shortAddress(facility.addr),
  ].filter((part): part is string => part !== null && part !== '')

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-title-2 text-fg font-semibold break-keep">{facility.name}</span>
        {/* 유형은 병원이 기본이라 약국일 때만 붙인다 — 모든 행에 붙으면 신호가 죽는다 */}
        {facility.facilityType.code === 'ANIMAL_PHARMACY' && (
          <Badge tone="neutral" size="sm" className="shrink-0">
            {facility.facilityType.name}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {facility.open24 && <Badge tone="neutral">{messages.emergency.open24}</Badge>}
        <OpenStatus openNow={facility.openNow} />
      </div>

      {/* 운영시간 원문. 없으면 없다고 말한다 — "닫힘" 과 구분된다 */}
      {facility.operatingHoursKnown && facility.operatingHours !== null ? (
        <p className="text-body-2 text-fg break-keep tabular-nums">
          {facility.operatingHours}
          {facility.restDate !== null && (
            <span className="text-fg-muted">
              {' · '}
              {facility.restDate} {messages.emergency.restPrefix}
            </span>
          )}
        </p>
      ) : (
        <p className="text-body-2 text-fg-muted break-keep">{messages.emergency.hoursUnknown}</p>
      )}

      {meta.length > 0 && (
        <p className="text-body-2 text-fg-muted break-keep tabular-nums">{meta.join(' · ')}</p>
      )}

      {/* 번호가 없으면 이유와 다음 방법을 준다. 버튼만 비활성으로 두면 왜인지 알 수 없다 */}
      {facility.tel === null && (
        <p className="text-caption text-fg-muted break-keep">{messages.emergency.telMissing}</p>
      )}
    </>
  )
}

/**
 * 영업 상태 3상태 — `openNow` 가 근거다.
 *
 * **등급 색을 쓰지 않는다** (아트보드 주석). 초록·주황은 산책 위험도 전용이고
 * 영업 여부는 판정이 아니다. `null` 은 점선으로 "모름" 을 드러낸다.
 *
 * **장소 상세의 `PlaceOpenStatus` 와 합치지 않았다** (#294). 규칙(등급색 금지 · 색이
 * 아니라 무게)은 같지만 문구가 다르고(`진료중` vs `영업 중`) `null` 처리가 갈린다 —
 * 이 화면은 `operatingHoursKnown: false` 처럼 **원문조차 없는 곳**이 있어 "모름" 이
 * 정보지만, 장소는 운영시간 원문이 항상 함께 있어 정보가 아니다. 규칙을 바꿀 때는
 * 양쪽을 같이 본다.
 */
function OpenStatus({ openNow }: { openNow: boolean | null }) {
  if (openNow === null) {
    return (
      <span className="text-caption text-fg-muted border-border-strong inline-flex items-center rounded-sm border border-dashed px-2 py-1 font-semibold">
        {messages.emergency.statusUnknown}
      </span>
    )
  }

  return (
    // 진료중은 채운 태그, 영업 종료는 흐리게 — 색이 아니라 무게로 가른다
    <Badge tone="neutral" className={openNow ? 'text-fg font-semibold' : ''}>
      {openNow ? messages.emergency.statusOpen : messages.emergency.statusClosed}
    </Badge>
  )
}

/**
 * 52px 전화 버튼.
 *
 * **번호가 없어도 자리를 비우지 않는다.** 자리가 사라지면 "이 병원만 뭔가 다르다" 가
 * 아니라 "화면이 깨졌다" 로 읽힌다 (아트보드 주석).
 */
export function CallButton({ name, tel }: { name: string; tel: string | null }) {
  const base =
    'flex size-13 shrink-0 items-center justify-center rounded-md border transition-colors'

  if (tel === null) {
    return (
      <span aria-hidden className={cn(base, 'border-border text-fg-subtle')}>
        <PhoneIcon size={24} />
      </span>
    )
  }

  return (
    <a
      href={`tel:${tel.replace(/[^\d+]/g, '')}`}
      aria-label={messages.emergency.callLabel.replace('{name}', name)}
      className={cn(
        base,
        'border-border-strong text-fg hover:bg-band',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      <PhoneIcon size={24} />
    </a>
  )
}

/**
 * 길찾기 — **선택된 한 행에만 나온다.**
 *
 * 노출 조건은 부동 카드 시절과 같다 (*"급할 때 누를 것이 둘이면 고르는 데 시간이
 * 든다"*). 그것을 담는 표면만 카드에서 행으로 옮겼다.
 *
 * **경로 안내를 우리가 그리지 않는다** — 외부 지도 앱 딥링크다. 좌표가 없으면
 * `directionsUrl` 이 `null` 이고 아무것도 그리지 않는다.
 */
export function DirectionsLink({ facility }: { facility: NearbyFacilityItem }) {
  const href = directionsUrl({ name: facility.name, lat: facility.lat, lng: facility.lng })
  if (href === null) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'border-border-strong text-fg hover:bg-band flex h-11 items-center justify-center rounded-md border font-semibold transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
      )}
    >
      {messages.map.directions}
    </a>
  )
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `pnpm vitest run src/features/emergency/`
Expected: PASS — 새 테스트와 기존 `emergency-section.test.ts` 가 함께 통과한다 (`FacilityRow` 의 렌더 결과가 같다)

- [ ] **Step 5: 커밋**

```bash
git add src/features/emergency/facility-row.tsx src/features/emergency/facility-row.test.ts
git commit -m "[FE] refactor: 시설 행의 내용과 액션을 갈라 선택 버튼으로 감쌀 수 있게 한다"
```

---

## Task 5: `EmergencyMapPanel` — 선택 가능한 목록

**Files:**
- Create: `src/features/emergency/emergency-map-panel.tsx`
- Test: `src/features/emergency/emergency-map-panel.test.ts`

**Interfaces:**
- Consumes: `FacilityRowContent` · `CallButton` · `DirectionsLink` (Task 4), `messages.map.noCoordinate`
- Produces: `EmergencyMapPanel({ facilities, selectedId, onSelect, showDistance })`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/emergency/emergency-map-panel.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyMapPanel } from '@/features/emergency/emergency-map-panel'
import { messages } from '@/lib/messages'
import { facility, pharmacy } from '@/test/fixtures/emergency'

const target = facility()

function render(overrides: Partial<Parameters<typeof EmergencyMapPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(EmergencyMapPanel, {
      facilities: [target, pharmacy()],
      selectedId: null,
      onSelect: () => undefined,
      showDistance: true,
      ...overrides,
    }),
  )
}

describe('EmergencyMapPanel', () => {
  it('행이 링크가 아니라 버튼이다 — 지도 화면에서 행을 누르는 것은 핀 고르기다', () => {
    const markup = render()

    expect(markup).toContain('<button')
    expect(markup).toContain('aria-pressed="false"')
  })

  it('선택된 행을 aria-pressed 와 배경으로 함께 알린다', () => {
    const markup = render({ selectedId: target.facilityId })

    expect(markup).toContain('aria-pressed="true"')
    // 선택 배경은 --row-selected 다. 판정 색(metric-*)을 쓰지 않는다
    expect(markup).toContain('bg-row-selected')
    expect(markup).not.toContain('metric-')
  })

  it('선택된 행에만 길찾기가 나온다', () => {
    expect(render()).not.toContain(messages.map.directions)
    expect(render({ selectedId: target.facilityId })).toContain(messages.map.directions)
  })

  it('선택 버튼 안에 링크를 넣지 않는다 — <a> 를 <button> 안에 둘 수 없다', () => {
    const markup = render({ selectedId: target.facilityId })
    const open = markup.indexOf('<button')
    const close = markup.indexOf('</button>')
    const inside = markup.slice(open, close)

    expect(open).toBeGreaterThan(-1)
    expect(inside).not.toContain('<a ')
  })

  it('전화는 선택 여부와 무관하게 항상 있다 — 급할 때 읽을 것을 선택 뒤로 숨기지 않는다', () => {
    expect(render()).toContain('href="tel:0640000000"')
  })

  it('좌표가 없는 곳도 목록에는 남기고 이유를 말한다 — 병원을 숨기지 않는다', () => {
    const markup = render({ facilities: [facility({ lat: 0, lng: 0 })] })

    expect(markup).toContain(target.name)
    expect(markup).toContain(messages.map.noCoordinate)
  })

  it('좌표가 있는 곳에는 그 안내를 붙이지 않는다', () => {
    expect(render()).not.toContain(messages.map.noCoordinate)
  })

  it('showDistance 가 false 면 거리를 감춘다', () => {
    expect(render({ showDistance: false })).not.toContain('480m')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm vitest run src/features/emergency/emergency-map-panel.test.ts`
Expected: FAIL — 모듈이 없다

- [ ] **Step 3: 컴포넌트를 만든다**

`src/features/emergency/emergency-map-panel.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'

import {
  CallButton,
  DirectionsLink,
  FacilityRowContent,
} from '@/features/emergency/facility-row'
import { toLatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 지도 옆(데스크톱 패널) · 시트 안(모바일)의 목록.
 *
 * **`Row`(components/surface.tsx)를 쓰지 않는다.** `Row` 의 좌우 여백이
 * `px-4 md:px-10` 인데 `md:` 는 **뷰포트** 기준이라, 1280 데스크톱의 400px 패널
 * 안에서도 40px 씩 먹어 내용 폭이 320 으로 줄어든다. `PlaceMapPanel` 이 같은 이유로
 * 평평한 `px-4` 를 쓴다.
 *
 * **행 전체가 버튼이 아니다.** 내용만 버튼이고 전화·길찾기 링크는 그 **형제**다 —
 * `<a>` 를 `<button>` 안에 넣을 수 없다 (`facility-row.tsx` 머리주석).
 *
 * **행 전체가 링크도 아니다.** 지도 화면에서 행을 누르는 것은 "이동" 이 아니라
 * "이 핀을 고르기" 다. 시설 상세 라우트도 없다 (이슈 #148).
 */
export function EmergencyMapPanel({
  facilities,
  selectedId,
  onSelect,
  showDistance,
  className,
}: {
  /** **이미 영역·필터가 적용된 배열이다.** 여기서 다시 좁히지 않는다 */
  facilities: NearbyFacilityItem[]
  selectedId: string | null
  onSelect: (facilityId: string) => void
  showDistance: boolean
  className?: string
}) {
  /*
    고른 행을 보이는 곳으로 끌어온다.

    **`behavior` 를 주지 않는다.** 기본값 `'auto'` 는 CSS `scroll-behavior` 를 따르므로
    `prefers-reduced-motion` 규칙(app/globals.css)이 그대로 먹는다 — `'smooth'` 를 박으면
    그 규칙을 우회해 어지럼을 줄여야 하는 사용자에게도 애니메이션이 나간다.

    `block: 'nearest'` 다. `'center'` 로 두면 이미 보이는 행을 눌러도 목록이 움직여
    사용자가 읽던 자리를 잃는다.
  */
  const selectedRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (selectedId === null) return
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <ul className={cn('divide-border divide-y', className)}>
      {facilities.map((entry) => {
        const selected = entry.facilityId === selectedId

        return (
          <li
            key={entry.facilityId}
            ref={selected ? selectedRef : null}
            /* 선택 배경을 li 에 걸어 길찾기 줄까지 함께 물든다 — 선택된 것이 어디서
               어디까지인지가 한 덩어리로 읽혀야 한다 */
            className={selected ? 'bg-row-selected' : ''}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => onSelect(entry.facilityId)}
                aria-pressed={selected}
                className={cn(
                  'focus-visible:ring-brand-500 flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left',
                  'focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
                )}
              >
                <FacilityRowContent facility={entry} showDistance={showDistance} />
              </button>

              {/* 버튼의 형제다. 선택 여부와 무관하게 항상 있다 */}
              <CallButton name={entry.name} tel={entry.tel} />
            </div>

            {/* 선택된 행에만. 전화 옆이 아니라 아래 전폭이라 오조작이 적다 */}
            {selected && (
              <div className="px-4 pb-3">
                <DirectionsLink facility={entry} />
              </div>
            )}

            {toLatLng(entry) === null && (
              <p className="text-caption text-fg-subtle px-4 pb-3 font-medium">
                {messages.map.noCoordinate}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `pnpm vitest run src/features/emergency/emergency-map-panel.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/emergency/emergency-map-panel.tsx src/features/emergency/emergency-map-panel.test.ts
git commit -m "[FE] feat: 지도 패널·시트에 들어가는 선택 가능한 시설 목록을 더한다"
```

---

## Task 6: `EmergencyFilterBar` — 패널 머리 · 시트 툴바 공용

**Files:**
- Create: `src/features/emergency/emergency-filter-bar.tsx`
- Test: `src/features/emergency/emergency-filter-bar.test.ts`

**Interfaces:**
- Consumes: `facilityCounts` · `labelWithCount` (Task 3), `messages.emergency.radiusLabel` 등 (Task 3), `Chip`/`ChipGroup`, `BottomSheet`, `useScrollRail`/`ScrollRailArrows`
- Produces:
  - `RADIUS_OPTIONS: readonly number[]`
  - `EmergencyFilterBar({ facilities, filters, onFiltersChange, radius, onRadiusChange, showCounts })`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/emergency/emergency-filter-bar.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyFilterBar, RADIUS_OPTIONS } from '@/features/emergency/emergency-filter-bar'
import { MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { DEFAULT_FACILITY_FILTERS } from '@/types/emergency'
import { facility, pharmacy } from '@/test/fixtures/emergency'

function render(overrides: Partial<Parameters<typeof EmergencyFilterBar>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(EmergencyFilterBar, {
      facilities: [facility(), pharmacy()],
      filters: DEFAULT_FACILITY_FILTERS,
      onFiltersChange: () => undefined,
      radius: 10_000,
      onRadiusChange: () => undefined,
      showCounts: true,
      ...overrides,
    }),
  )
}

describe('EmergencyFilterBar', () => {
  it('개수는 넘긴 배열에서 센다 — 지도 화면에서는 "이 지역" 이 기준이다', () => {
    // 병원 1 · 약국 1 = 전체 2
    const markup = render()

    expect(markup).toContain(`${messages.emergency.typeAll} 2`)
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_HOSPITAL} 1`)
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 1`)
  })

  it('개수가 0 인 칩도 그린다 — 그리지 않으면 그 유형으로 갈 방법이 없다', () => {
    const markup = render({ facilities: [facility()] })

    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 0`)
  })

  it('잘린 목록이면 숫자를 뺀다 — 틀린 개수는 없는 개수보다 나쁘다', () => {
    const markup = render({ showCounts: false })

    expect(markup).toContain(messages.emergency.typeAll)
    expect(markup).not.toContain(`${messages.emergency.typeAll} 2`)
  })

  it('반경을 현재 값으로 라벨에 쓴다', () => {
    const markup = render({ radius: 20_000 })

    expect(markup).toContain(
      messages.emergency.radiusLabel.replace('{radius}', formatDistance(20_000)),
    )
  })

  it('24시간을 켜면 결과가 적다는 사실을 알린다 — 백엔드 스키마가 명시한 안내다', () => {
    expect(render()).not.toContain(messages.emergency.open24Note)
    expect(
      render({ filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true } }),
    ).toContain(messages.emergency.open24Note)
  })

  it('기본 조건이면 초기화를 두지 않는다', () => {
    expect(render()).not.toContain(messages.place.resetFilters)
  })

  it('조건이 걸려 있으면 초기화가 나온다', () => {
    const markup = render({ filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true } })

    expect(markup).toContain(messages.place.resetFilters)
  })

  it('반경은 초기화 대상이 아니다 — 필터가 아니라 조회 파라미터다', () => {
    const markup = render({ radius: MAX_RADIUS_METERS })

    expect(markup).not.toContain(messages.place.resetFilters)
  })

  it('반경 선택지는 넓히기 사다리와 상한을 따른다', () => {
    expect(RADIUS_OPTIONS).toEqual([10_000, 20_000, 40_000, MAX_RADIUS_METERS])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm vitest run src/features/emergency/emergency-filter-bar.test.ts`
Expected: FAIL — 모듈이 없다

- [ ] **Step 3: 컴포넌트를 만든다**

`src/features/emergency/emergency-filter-bar.tsx`:

```tsx
'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { ChevronDownIcon } from '@/components/icons'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { facilityCounts, labelWithCount } from '@/features/emergency/facility-filters'
import { MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import {
  DEFAULT_FACILITY_FILTERS,
  FACILITY_TYPE_CODES,
  type FacilityFilters,
  type NearbyFacilityItem,
} from '@/types/emergency'

/**
 * 반경 선택지.
 *
 * **`widen()` 의 ×2 사다리와 상한을 그대로 따른다** (`emergency-view` 시절의 10 → 20 →
 * 40 → 50). 두 경로가 다른 값을 쓰면 0건 화면의 "반경 넓히기" 를 누른 뒤 칩이 목록에
 * 없는 값을 가리킨다.
 */
export const RADIUS_OPTIONS = [10_000, 20_000, 40_000, MAX_RADIUS_METERS] as const

/**
 * 지도 보기의 필터 줄 — 패널 머리와 시트 툴바가 같은 것을 쓴다.
 *
 * **`/places` 의 `PlaceMapFilterBar` 와 같은 자리·같은 문법이다.** 1행은 유형 축
 * 가로 스크롤러, 2행은 나머지 축이다.
 *
 * **개수는 호출부가 넘긴 배열에서 센다.** 지도 갈래는 **영역 안 · `applyFilters` 전**
 * 배열을 넘긴다 — 캡션이 "지도에 보이는 12곳" 인데 칩이 "병원 120" 이면 두 숫자가
 * 서로를 부정하고, 다른 조건이 이미 걸린 배열을 세면 칩이 화면 목록과 같은 수가 되어
 * 아무것도 알려주지 못한다 (`facilityCounts` 머리주석).
 *
 * **반경이 이 줄에 있는 이유:** 이 화면은 지도를 옮겨도 재조회하지 않으므로
 * (거리가 내 위치 기준으로 남아야 한다) 반경이 "더 넓게 찾기" 의 유일한 손잡이다.
 * 0건 화면에만 두면 지도에서는 닿을 수 없다.
 */
export function EmergencyFilterBar({
  facilities,
  filters,
  onFiltersChange,
  radius,
  onRadiusChange,
  showCounts,
  className,
}: {
  /** **영역 안 · 필터 적용 전** 배열 */
  facilities: NearbyFacilityItem[]
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  radius: number
  onRadiusChange: (next: number) => void
  /** `countsAreComplete` 결과. false 면 칩에서 숫자를 뺀다 */
  showCounts: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // 시트 초안. 열 때 현재 값을 복사하고 적용 전까지 조회를 건드리지 않는다
  const [draft, setDraft] = useState(radius)

  const counts = facilityCounts(facilities)
  const rail = useScrollRail<HTMLDivElement>()

  /*
    **반경은 `dirty` 에 넣지 않는다.** 필터가 아니라 조회 파라미터다 — "초기화" 가
    반경까지 되돌리면 넓혀 찾던 사용자가 조건 하나를 끄려다 결과를 통째로 잃는다.
  */
  const dirty =
    filters.type !== DEFAULT_FACILITY_FILTERS.type ||
    filters.open24Only !== DEFAULT_FACILITY_FILTERS.open24Only ||
    filters.openNowOnly !== DEFAULT_FACILITY_FILTERS.openNowOnly

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {/* ── 1행: 유형 ─────────────────────────────────────────────────────
          `.scroll-rail`(globals.css)이 화살표를 앉히는 기준면이고 **묶음 자신이
          스크롤러**다. 바깥 div 를 스크롤러로 삼으면 마지막 칩이 잘린다 */}
      <div className="scroll-rail">
        <ChipGroup
          ref={rail.ref}
          onScroll={rail.onScroll}
          label={messages.emergency.typeGroupLabel}
          exclusive
          className={cn('flex scrollbar-none gap-1.5 overflow-x-auto', rail.fadeClassName)}
        >
          <Chip
            exclusive
            selected={filters.type === null}
            onSelect={() => onFiltersChange({ ...filters, type: null })}
          >
            {labelWithCount(messages.emergency.typeAll, counts.all, showCounts)}
          </Chip>
          {FACILITY_TYPE_CODES.map((code) => (
            <Chip
              key={code}
              exclusive
              selected={filters.type === code}
              onSelect={() => onFiltersChange({ ...filters, type: code })}
            >
              {labelWithCount(
                messages.emergency.typeByCode[code],
                counts.byType[code],
                showCounts,
              )}
            </Chip>
          ))}
        </ChipGroup>

        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.place.filterTypePrev}
          nextLabel={messages.place.filterTypeNext}
        />
      </div>

      {/* ── 2행: 반경 · 영업 조건 · 초기화 ──────────────────────────────── */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Chip
          selected={radius !== RADIUS_OPTIONS[0]}
          expanded={open}
          onSelect={() => {
            setDraft(radius)
            setOpen(true)
          }}
          className="shrink-0"
        >
          {messages.emergency.radiusLabel.replace('{radius}', formatDistance(radius))}
          <ChevronDownIcon size={16} />
        </Chip>

        <ChipGroup label={messages.emergency.narrowGroupLabel} className="flex gap-1.5">
          <Chip
            selected={filters.open24Only}
            onSelect={() => onFiltersChange({ ...filters, open24Only: !filters.open24Only })}
          >
            {labelWithCount(messages.emergency.open24, counts.open24, showCounts)}
          </Chip>
          <Chip
            selected={filters.openNowOnly}
            onSelect={() => onFiltersChange({ ...filters, openNowOnly: !filters.openNowOnly })}
          >
            {labelWithCount(messages.emergency.openNow, counts.openNow, showCounts)}
          </Chip>
        </ChipGroup>

        {dirty && (
          <Chip
            selected={false}
            onSelect={() => onFiltersChange(DEFAULT_FACILITY_FILTERS)}
            className="shrink-0"
          >
            {messages.place.resetFilters}
          </Chip>
        )}
      </div>

      {/* 백엔드 스키마가 화면에 알리라고 명시한 사실이다 */}
      {filters.open24Only && (
        <p className="text-caption text-fg-muted break-keep">{messages.emergency.open24Note}</p>
      )}

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={messages.emergency.radiusSheetTitle}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              {messages.place.filterCancel}
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-2"
              onClick={() => {
                onRadiusChange(draft)
                setOpen(false)
              }}
            >
              {messages.place.filterApply}
            </Button>
          </div>
        }
      >
        <ChipGroup
          label={messages.emergency.radiusGroupLabel}
          exclusive
          className="flex flex-wrap gap-1.5 px-4 py-3"
        >
          {RADIUS_OPTIONS.map((option) => (
            <Chip
              key={option}
              exclusive
              selected={draft === option}
              onSelect={() => setDraft(option)}
            >
              {formatDistance(option)}
            </Chip>
          ))}
        </ChipGroup>
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `pnpm vitest run src/features/emergency/emergency-filter-bar.test.ts`
Expected: PASS

**실패하면 먼저 확인할 것:** `messages.place.filterTypePrev` · `filterTypeNext` · `resetFilters` · `filterCancel` · `filterApply` 가 실제로 있는지 (`grep -n "filterTypePrev\|resetFilters\|filterCancel\|filterApply" src/lib/messages/place.ts`). 없으면 `messages/emergency.ts` 에 같은 뜻의 문구를 더하고 그것을 쓴다 — **`/places` 문구를 고치지 않는다.**

- [ ] **Step 5: 커밋**

```bash
git add src/features/emergency/emergency-filter-bar.tsx src/features/emergency/emergency-filter-bar.test.ts
git commit -m "[FE] feat: 긴급 시설 지도 보기의 필터 줄과 반경 선택을 더한다"
```

---

## Task 7: `EmergencySection` — 개수 라벨 헬퍼 중복 제거

> **컨트롤러 ruling (pre-flight F2):** 이 태스크는 원래 `countBase?: NearbyFacilityItem[]`
> prop 을 더해 "지도 갈래가 영역 안 배열을 센다" 를 지원하려 했다. **그 prop 을 뺐다.**
>
> 프로덕션에서 `EmergencySection` 을 렌더하는 곳은 `EmergencyListView` 하나이고, 그것은
> 반경 전량을 센다 (설계 §5-3: *"목록 갈래의 개수는 지금처럼 반경 전량 기준이다 — 거기에는
> 지도 영역이 없다"*). 지도 갈래는 `EmergencySection` 을 **쓰지 않는다** — Task 8 의
> `PanelBody` 와 `EmergencyFilterBar` 가 `inBounds` 를 센다. 그래서 설계 §5-3 의 요구는
> 그대로 충족되고, `countBase` 는 **호출자가 없는 죽은 prop** 이 된다.
>
> 설계 §7 이 `countBase` 를 적은 것은 지도 갈래가 `EmergencySection` 을 재사용할 것이라는
> 전제였고, Task 8 이 그 전제를 버렸다 (지도 패널은 0건 분기가 다르고 여백이 `px-4` 다).
>
> 남는 일은 하나다: `withCount` 로컬 함수를 Task 3 의 `labelWithCount` 로 갈아탄다.
> 같은 헬퍼가 두 파일에 사복되면 한쪽만 고쳐져 같은 칩이 화면마다 다르게 보인다.

**Files:**
- Modify: `src/features/emergency/emergency-section.tsx`
- Modify: `src/features/emergency/emergency-section.test.ts`

**Interfaces:**
- Consumes: `labelWithCount` (Task 3), `facility` · `facilityResult` (Task 1)
- Produces: 없음. **`EmergencySectionProps` 는 바뀌지 않는다** — 이 태스크는 순수 내부 정리다

- [ ] **Step 1: 픽스처를 공유로 바꾼다 (동작 불변 리팩토링)**

`src/features/emergency/emergency-section.test.ts` 에서 파일 안의 `function facility(...)`
정의를 **지우고** import 로 바꾼다. 픽스처 기본값이 Task 1 의 것과 같은 값이라 기존
assertion 은 전부 그대로 통과해야 한다 — **그것이 이 단계의 검증이다.**

```ts
import { facility } from '@/test/fixtures/emergency'
```

기존 테스트가 `facilityResult` 로 응답을 만들고 있지 않다면 그대로 둔다. 이 태스크는
테스트 내용을 바꾸지 않는다.

- [ ] **Step 2: 픽스처 교체만으로 테스트가 통과하는 것을 확인한다**

Run: `pnpm vitest run src/features/emergency/emergency-section.test.ts`
Expected: PASS — 통과하지 않으면 Task 1 의 픽스처 기본값이 원래 것과 다르다는 뜻이다.
그때는 **픽스처를 원래 값에 맞추고** (테스트를 고치지 않는다) 다시 돌린다.

- [ ] **Step 3: `withCount` 를 `labelWithCount` 로 갈아탄다**

`src/features/emergency/emergency-section.tsx`:

1. 파일 끝의 로컬 함수를 지운다.

```ts
/** 개수를 붙일 수 있을 때만 붙인다 */
function withCount(label: string, count: number, show: boolean): string {
  return show ? `${label} ${count}` : label
}
```

2. import 에 더한다 (같은 파일이 이미 `facility-filters` 에서 여러 개를 가져온다).

```ts
import {
  applyFilters,
  countsAreComplete,
  facilityCounts,
  type FilterRelief,
  labelWithCount,
  reliefs,
} from '@/features/emergency/facility-filters'
```

3. 본문의 `withCount(` 호출 **5곳**을 `labelWithCount(` 로 바꾼다 (전체 · 병원 · 약국 ·
24시간 · 지금 진료중). 인자는 그대로다.

**주의:** 지운 로컬 함수는 `${count}` 를, `labelWithCount` 는 `${String(count)}` 를 쓴다.
템플릿 문자열 결과는 같다 — `labelWithCount` 쪽이 `@typescript-eslint` 의
`restrict-template-expressions` 를 만족하는 형태다.

- [ ] **Step 4: 검증**

Run: `pnpm vitest run src/features/emergency/ && pnpm typecheck && pnpm lint`
Expected: PASS. 렌더 결과가 바뀌지 않았으므로 기존 assertion 이 전부 통과해야 한다

- [ ] **Step 5: 커밋**

```bash
git add src/features/emergency/emergency-section.tsx src/features/emergency/emergency-section.test.ts
git commit -m "[FE] refactor: 시설 칩 개수 라벨 헬퍼를 한 곳으로 모은다"
```

---

## Task 8: `use-emergency-board` · `EmergencyMapView` — `?view=map` 으로 도달

**기본 보기는 아직 목록이다.** 새 화면을 `?view=map` 으로 실제로 볼 수 있게 만들고, 기본 화면은 건드리지 않는다 — 이 태스크가 반쯤 잘못돼도 급할 때 여는 화면이 살아 있다.

**Files:**
- Create: `src/features/emergency/use-emergency-board.ts`
- Create: `src/features/emergency/emergency-map-view.tsx`
- Create: `src/features/emergency/emergency-list-view.tsx`
- Modify: `app/(main)/emergency/page.tsx`

**Interfaces:**
- Consumes: `EmergencyMapPanel`(T5) · `EmergencyFilterBar`(T6) · `EmergencySection`(T7) · `MapCanvas` 의 `camera`(T2) · `SELECTED_FACILITY_MAP_LEVEL`(T3)
- Produces:
  - `useEmergencyBoard(): { position, fallback, radius, setRadius, widen, canWiden, filters, setFilters, query, locate, inJeju }`
  - `EmergencyMapView({ listHref, mapHref })`
  - `EmergencyListView()` — **props 없음.** 필요한 상태를 스스로 `useEmergencyBoard()` 로 만든다

- [ ] **Step 1: 상태 훅을 만든다**

`src/features/emergency/use-emergency-board.ts`:

```ts
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useNearbyFacilities } from '@/features/emergency/use-nearby-facilities'
import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { getCurrentPosition, type PositionFailure, type PositionResult } from '@/lib/geo/current-position'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

/** 넓히기 한 번에 두 배. 10km → 20km → 40km → 50km(상한) */
export function widen(radius: number): number {
  return Math.min(MAX_RADIUS_METERS, radius * 2)
}

/**
 * 긴급 시설 화면의 상태 — 위치 · 반경 · 필터 · 조회.
 *
 * **두 갈래(목록 · 지도)가 같은 모델을 쓴다.** 각자 갖고 있으면 보기를 전환할 때
 * 조건이 풀리고, 위치 권한 프롬프트가 화면마다 다른 순간에 뜬다.
 *
 * **좌표를 먼저 구하고 그다음 조회한다.** `lat`/`lng` 가 필수라 순서가 뒤집히면 400 이다.
 * 좌표 요청은 **실패해도 좌표를 돌려준다**(제주 중심) — 이 화면은 급할 때 여는 화면이라
 * 위치 하나 때문에 비어 버리면 안 된다.
 *
 * **서버 프리페치를 하지 않는다.** 좌표가 브라우저에만 있어 서버가 무엇을 조회할지
 * 모른다 (`architecture-guide.md` §9 결정 트리 1번).
 */
export function useEmergencyBoard() {
  const [position, setPosition] = useState<PositionResult | null>(null)
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS)
  const [filters, setFilters] = useState<FacilityFilters>(DEFAULT_FACILITY_FILTERS)

  /*
    **누를 때마다 다시 묻는다.** 마운트 때 받은 좌표를 재사용하면 사용자가 이동한 뒤
    누른 "내 위치" 가 옛 자리를 가리킨다.

    **`/places` 와 달리 조회도 다시 돈다** — `position` 이 query key 라서다. 이 화면은
    거리를 표시하고 정렬 근거로 쓰므로 기준점이 바뀌면 목록도 바뀌어야 한다.
  */
  const locate = useCallback(() => {
    void getCurrentPosition().then(setPosition)
  }, [])

  useEffect(() => {
    locate()
  }, [locate])

  const query = useNearbyFacilities(position, radius)

  const fallback: PositionFailure | null =
    position !== null && position.kind === 'fallback' ? position.reason : null

  /*
    지도 카메라. **`useMemo` 가 필수다** — 렌더 중에 새 객체를 만들면 `MapCanvas` 의
    카메라 effect 가 매 렌더 돌아 **필터 칩을 누를 때마다 지도가 되돌아간다.**
    이전 구현이 `center` 를 인라인 객체로 넘겨 실제로 그랬다.

    `spanMeters` 가 지름이다 — 반경 10km 를 담으려면 20km 폭이 필요하다.
  */
  const camera = useMemo(
    () =>
      position === null
        ? null
        : { anchor: { lat: position.lat, lng: position.lng }, spanMeters: radius * 2 },
    [position, radius],
  )

  return {
    position,
    camera,
    /** null 이면 내 위치를 쓰고 있다. 값이 있으면 제주 중심 폴백이다 */
    fallback,
    /** 폴백이면 거리를 감춘다 — 제주 중심에서 480m 인 것을 "480m" 로 쓸 수 없다 */
    showDistance: fallback === null,
    /** 제주 안에서만 "내 위치" 버튼을 그린다 — 밖에서는 눌러도 갈 곳이 없다 */
    inJeju: position !== null && position.kind === 'granted',
    radius,
    setRadius,
    widenRadius: () => setRadius(widen),
    canWiden: radius < MAX_RADIUS_METERS,
    filters,
    setFilters,
    query,
    locate,
  }
}
```

- [ ] **Step 2: 목록 갈래를 꺼낸다**

`src/features/emergency/emergency-list-view.tsx`:

```tsx
'use client'

import { EmergencySection } from '@/features/emergency/emergency-section'
import { useEmergencyBoard } from '@/features/emergency/use-emergency-board'
import { toErrorStatus } from '@/lib/api/error'

/**
 * 목록 갈래 — `?view=list` 와 **지도 SDK 실패 폴백이 같은 것을 쓴다.**
 *
 * 응급 화면에서 지도 없이 전화까지 도달하는 경로가 여기다. 지도가 기본 보기가 된 뒤에도
 * 이 갈래는 그대로 남는다.
 *
 * **개수는 반경 전량 기준이다** — 이 갈래에는 지도 영역이 없다 (설계 §5-3).
 * 지도 갈래는 `EmergencySection` 을 쓰지 않고 자기 패널 본문을 갖는다.
 */
export function EmergencyListView() {
  const board = useEmergencyBoard()

  return (
    <EmergencySection
      result={board.query.data ?? null}
      // 좌표를 기다리는 동안에도 로딩이다 — 조회는 아직 시작도 못 했다
      loading={board.position === null || board.query.isPending}
      errorStatus={toErrorStatus(board.query.error)}
      onRetry={() => void board.query.refetch()}
      filters={board.filters}
      onFiltersChange={board.setFilters}
      positionFallback={board.fallback}
      onRetryPosition={board.locate}
      onWidenRadius={board.widenRadius}
      canWiden={board.canWiden}
    />
  )
}
```

- [ ] **Step 3: 지도 갈래를 만든다**

`src/features/emergency/emergency-map-view.tsx`:

```tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { MapSheet, type SheetStop } from '@/components/map-sheet'
import { ViewToggle } from '@/components/view-toggle'
import { EmergencyFilterBar } from '@/features/emergency/emergency-filter-bar'
import { EmergencyMapPanel } from '@/features/emergency/emergency-map-panel'
import { EmergencySkeleton } from '@/features/emergency/emergency-skeleton'
import {
  applyFilters,
  countsAreComplete,
  type FilterRelief,
  reliefs,
} from '@/features/emergency/facility-filters'
import { useEmergencyBoard } from '@/features/emergency/use-emergency-board'
import { EmergencyListView } from '@/features/emergency/emergency-list-view'
import type { MapPin } from '@/features/map/map-canvas'
import { MapLocateButton } from '@/features/map/map-locate-button'
import { formatDistance } from '@/lib/format/distance'
import { SELECTED_FACILITY_MAP_LEVEL, toLatLng } from '@/lib/geo/coord'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { isWithinBounds, type MapBounds } from '@/lib/map/viewport'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (docs/external-api-guide.md §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 병원 · 약국 — 지도 보기. **`/places` 지도 보기와 같은 구조다**
 * (`features/place/place-map-view.tsx`).
 *
 * **`useMediaQuery` 로 갈라 그리지 않는다.** 이전 구현은 감춰진 쪽도 mount 되면
 * `MapCanvas` 가 두 벌 만들어지는 것을 피하려고 브레이크포인트를 값으로 읽었다.
 * 여기는 **지도가 하나**고 패널·시트는 목록 껍데기일 뿐이라 CSS 로 감춰도 비용이 없다 —
 * `/places` 가 같은 이유로 `hidden lg:block` / `lg:hidden` 을 쓴다.
 *
 * **지도를 옮겨도 재조회하지 않는다.** 재조회하면 `distanceMeters` 가 지도 중심 기준이
 * 되어 "가까운 순 · 480m" 이 거짓이 된다. 이동은 이미 받은 배열을 **거를 뿐**이고,
 * 반경 밖으로 나가면 그 자리에서 반경을 넓히도록 한다.
 */
export function EmergencyMapView({
  listHref,
  mapHref,
}: {
  listHref: string
  mapHref: string
}) {
  const board = useEmergencyBoard()

  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetStop, setSheetStop] = useState<SheetStop>('mid')
  const [panelOpen, setPanelOpen] = useState(true)
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)

  const inRadius = board.query.data?.facilities ?? []

  /*
    ── 파이프라인 ───────────────────────────────────────────────────────────

    `inRadius` → `inBounds` → `visible`. **순서가 개수의 정확성을 정한다** —
    칩 개수는 `inBounds`(필터 적용 전)를 세고, 목록과 핀은 `visible` 을 쓴다.

    **좌표가 없는 시설은 영역 필터에서 살린다.** 지도가 판단할 수 없다는 이유로 병원을
    숨기면 안 된다 (`/places` 와 같은 규칙).
  */
  const inBounds = useMemo(() => {
    if (bounds === null) return inRadius

    return inRadius.filter((entry) => {
      const coord = toLatLng(entry)
      return coord === null || isWithinBounds(bounds, coord)
    })
  }, [inRadius, bounds])

  const visible = useMemo(() => applyFilters(inBounds, board.filters), [inBounds, board.filters])

  const pins: MapPin[] = useMemo(
    () =>
      visible.map((entry) => ({
        id: entry.facilityId,
        title: entry.name,
        lat: entry.lat,
        lng: entry.lng,
        caption: board.showDistance ? formatDistance(entry.distanceMeters) : null,
        // 약국은 글자 톤을 낮춘다 — 등급 색을 마커에 쓰지 않는다
        muted: entry.facilityType.code === 'ANIMAL_PHARMACY',
      })),
    [visible, board.showDistance],
  )

  const handleBounds = useCallback((next: MapBounds) => {
    // **`userMoved` 를 쓰지 않는다.** 재조회가 없으니 첫 `idle` 과 사용자 이동을
    // 가를 이유가 없다 — 어느 쪽이든 "지금 보이는 영역" 이 답이다
    setBounds(next)
  }, [])

  /*
    핀·행·제목 세 경로가 모두 이것을 부른다.

    **시트가 최소 단계면 올린다.** 안 올리면 고른 행이 화면 밖이라 "눌렀는데 아무
    일도 안 일어난다" 로 보인다. 이미 중간·최대면 사용자가 맞춰 둔 것을 건드리지 않는다.
  */
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setSheetStop((stop) => (stop === 'min' ? 'mid' : stop))
  }, [])

  // ── SDK 실패 → 목록으로 되돌리고 안내 한 줄 ──────────────────────────────
  if (failure !== null) {
    return (
      <div>
        {/* 안내 한 줄 — 배너(링크형)가 아니다. 갈 곳이 없고 알릴 사실만 있다 */}
        <p
          role="status"
          className="text-caption text-fg-muted bg-bg-sunken border-border border-b px-4 py-3 font-medium md:px-10"
        >
          {failureMessage(failure)}
        </p>
        <EmergencyListView />
      </div>
    )
  }

  const countLine = `${messages.map.visibleCount.replace('{n}', String(visible.length))} · ${messages.emergency.radiusLabel.replace('{radius}', formatDistance(board.radius))}`
  const basisLine = board.showDistance
    ? messages.emergency.basisCurrent
    : messages.emergency.basisJeju

  const body = (
    <PanelBody
      board={board}
      inBounds={inBounds}
      visible={visible}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  )

  const toolbar = (
    <EmergencyFilterBar
      facilities={inBounds}
      filters={board.filters}
      onFiltersChange={board.setFilters}
      radius={board.radius}
      onRadiusChange={board.setRadius}
      showCounts={board.query.data === undefined ? false : countsAreComplete(board.query.data)}
    />
  )

  const caption = (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-caption text-fg-muted font-medium tabular-nums">{countLine}</p>
      <p className="text-caption text-fg-muted shrink-0 font-medium">{basisLine}</p>
    </div>
  )

  return (
    <div className="relative">
      {/* 지도가 바탕이다. 데스크톱은 좌측 패널이 그 위에 얹힌다 */}
      <MapCanvas
        pins={pins}
        selectedId={selectedId}
        onSelect={handleSelect}
        onBoundsChange={handleBounds}
        camera={board.camera}
        /* 고르면 도로가 읽히는 단계까지 확대한다 — `/places` 보다 한 단계 깊다 */
        selectedLevel={SELECTED_FACILITY_MAP_LEVEL}
        onFailure={setFailure}
        className="map-canvas-height w-full"
      />

      {/* 여백이 `/places` 지도 보기와 정확히 같다 — 같은 컨트롤이면 같은 자리에 있어야 한다 */}
      <div className="absolute top-5 right-4 z-30 flex flex-col items-end gap-2 md:right-10 lg:top-6">
        <ViewToggle
          current="map"
          listHref={listHref}
          mapHref={mapHref}
          variant="icon"
          className="shadow-md"
        />

        {/* 제주 밖이면 렌더하지 않는다 — 눌러도 갈 곳이 없다 */}
        {board.inJeju && <MapLocateButton onLocate={board.locate} />}
      </div>

      {/* ── 데스크톱: 좌측 400 고정 패널 ─────────────────────────────────── */}
      <div
        className={cn(
          // 상단은 보기 전환 토글과 같은 높이(lg 헤더의 pt-6). 하단 32 는 카카오
          // 축척·로고 막대(바닥 0~19px)를 피한 값이다 — 줄이면 축척이 눌려 보인다
          'absolute top-6 bottom-8 left-4 z-30 hidden lg:block',
          panelOpen ? 'map-panel-width' : 'w-auto',
        )}
      >
        {panelOpen ? (
          // 접기 탭이 패널 밖으로 튀어나오므로 여기서 자르지 않는다
          <div className="relative h-full">
            <div className="bg-bg border-border flex h-full w-full flex-col overflow-hidden rounded-xl rounded-tr-none border shadow-lg">
              <div className="border-border border-b px-3 py-2">{toolbar}</div>

              {board.fallback !== null && (
                <div className="border-border border-b px-4 py-3">
                  <PositionNotice reason={board.fallback} onRetry={board.locate} />
                </div>
              )}

              <div className="border-border bg-bg-sunken border-b px-4 py-2">{caption}</div>

              <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
            </div>

            {/* 책갈피처럼 오른쪽 모서리에 물린다 — 안쪽 머리에 두면 목록의 컨트롤로 읽힌다.
                높이는 닫혔을 때 펼치기 버튼이 서는 자리와 같다 (top-0 · 44) */}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-expanded
              aria-label={messages.map.collapsePanel}
              title={messages.map.collapsePanel}
              className="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 absolute top-0 -right-6 flex h-11 w-6 items-center justify-center rounded-r-lg border border-l-0 shadow-md focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <ChevronLeftIcon size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            aria-expanded={false}
            aria-label={messages.map.expandPanel}
            className="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 flex size-11 items-center justify-center rounded-xl border shadow-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRightIcon size={20} />
          </button>
        )}
      </div>

      {/* ── 모바일: 하단 시트 3단 ────────────────────────────────────────── */}
      {/*
        **시트에서는 위치 안내가 캡션 줄 아래에 온다** — 패널과 순서가 다르다.
        `MapSheet` 에 `header` 위 슬롯이 없고, 그것을 위해 prop 을 더하면 `/places` 도
        같이 바뀐다. 한 번 읽고 마는 설명이라 스크롤 영역 맨 위가 맞는 자리다.
      */}
      <MapSheet
        label={messages.emergency.sheetLabel}
        stop={sheetStop}
        onStopChange={setSheetStop}
        toolbar={toolbar}
        header={caption}
      >
        {board.fallback !== null && (
          <div className="border-border border-b px-4 py-3">
            <PositionNotice reason={board.fallback} onRetry={board.locate} />
          </div>
        )}
        {body}
      </MapSheet>
    </div>
  )
}

/**
 * 패널·시트 안의 본문 — 로딩 / 오류 / 0건 두 갈래 / 목록.
 *
 * **패널과 시트가 같은 함수를 쓴다.** 두 곳에 같은 분기를 쓰면 한쪽만 고쳐진다.
 */
function PanelBody({
  board,
  inBounds,
  visible,
  selectedId,
  onSelect,
}: {
  board: ReturnType<typeof useEmergencyBoard>
  inBounds: NearbyFacilityItem[]
  visible: NearbyFacilityItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  // 좌표를 기다리는 동안에도 로딩이다 — 조회는 아직 시작도 못 했다
  if (board.position === null || board.query.isPending) return <EmergencySkeleton />

  if (board.query.error !== null || board.query.data === undefined) {
    return (
      <ErrorState
        title={messages.emergency.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={() => void board.query.refetch()}
      />
    )
  }

  /*
    **0건을 두 갈래로 가른다.**
     - 영역 안이 비었다 → 지도를 조회 범위 밖으로 옮긴 것이다. 반경이 답이다
     - 영역 안은 있는데 필터로 0 이 됐다 → 무엇을 끄면 몇 개인지 세어 준다
  */
  if (inBounds.length === 0) {
    return (
      <EmptyState
        title={messages.map.emptyInView}
        description={messages.emergency.emptyInViewDescription}
        action={
          board.canWiden ? (
            <Button variant="secondary" onClick={board.widenRadius}>
              {messages.emergency.widenRadius}
            </Button>
          ) : undefined
        }
      />
    )
  }

  if (visible.length === 0) {
    const options = reliefs(inBounds, board.filters)

    return (
      <div className="flex flex-col items-start gap-2 px-4 py-6">
        <h3 className="text-title-2 text-fg font-semibold">{messages.emergency.narrowedTitle}</h3>
        <div className="mt-1 flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.kind}
              variant="secondary"
              onClick={() => board.setFilters(option.next)}
            >
              {reliefLabel(option)}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <EmergencyMapPanel
      facilities={visible}
      selectedId={selectedId}
      onSelect={onSelect}
      showDistance={board.showDistance}
    />
  )
}

/** 위치를 못 얻었을 때. **목록을 지우지 않고 그 위에 얹는다** */
function PositionNotice({
  reason,
  onRetry,
}: {
  reason: NonNullable<ReturnType<typeof useEmergencyBoard>['fallback']>
  onRetry: () => void
}) {
  const text =
    reason === 'denied'
      ? messages.emergency.positionDenied
      : reason === 'unsupported'
        ? messages.emergency.positionUnsupported
        : reason === 'outside'
          ? messages.emergency.positionOutside
          : messages.emergency.positionTimeout

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-body-2 text-fg break-keep">{text}</p>
      {/*
        **다시 시도할 것이 없는 두 갈래에는 버튼을 두지 않는다.** 미지원 브라우저는
        눌러도 같은 답이고, 제주 밖은 좌표를 이미 정확히 받은 상태다.
      */}
      {reason !== 'unsupported' && reason !== 'outside' && (
        <Button variant="secondary" onClick={onRetry}>
          {messages.emergency.retryPosition}
        </Button>
      )}
    </div>
  )
}

function reliefLabel(option: FilterRelief): string {
  const template =
    option.kind === 'openNowOnly'
      ? messages.emergency.reliefOpenNow
      : option.kind === 'open24Only'
        ? messages.emergency.reliefOpen24
        : messages.emergency.reliefType

  return template.replace('{n}', String(option.count))
}

function failureMessage(reason: MapSdkFailure): string {
  if (reason === 'no-key') return messages.map.errorNoKey
  if (reason === 'unsupported') return messages.map.errorUnsupported
  return messages.map.errorScript
}
```

- [ ] **Step 4: 라우트를 두 갈래로 가른다**

`app/(main)/emergency/page.tsx` 를 아래로 바꾼다. **`parseViewMode` 의 기본값은 아직 건드리지 않는다** — 기본 보기는 목록이고 새 화면은 `?view=map` 으로만 온다.

```tsx
import { ViewToggle } from '@/components/view-toggle'
import { EmergencyListView } from '@/features/emergency/emergency-list-view'
import { EmergencyMapView } from '@/features/emergency/emergency-map-view'
import { messages } from '@/lib/messages'
import { parseViewMode, viewModeHref } from '@/lib/url/view-mode'

export const metadata = {
  title: `${messages.emergency.pageTitle} · 혼디가개`,
  description: messages.emergency.pageDescription,
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * 주변 병원 · 약국.
 *
 * **서버 프리페치가 없다.** 조회에 `lat`/`lng` 가 필수인데 좌표는 브라우저에만 있어
 * 서버가 무엇을 조회할지 모른다 (`architecture-guide.md` §9 확정표에 이 화면 행이 있다).
 *
 * **지도 갈래는 폭 제한과 헤더가 없다.** 지도가 바탕이고 목록이 그 위에 얹히므로
 * 제목이 들어갈 자리가 없다 — `/places` 지도 보기와 같은 구조다.
 */
export default async function EmergencyPage({ searchParams }: { searchParams: SearchParams }) {
  const view = parseViewMode(await searchParams)
  const listHref = viewModeHref('/emergency', '', 'list')
  const mapHref = viewModeHref('/emergency', '', 'map')

  if (view === 'map') {
    return (
      <main id="main-content">
        <h1 className="sr-only">{messages.emergency.pageTitle}</h1>
        <EmergencyMapView listHref={listHref} mapHref={mapHref} />
      </main>
    )
  }

  return (
    <main id="main-content" className="mx-auto w-full max-w-screen-md">
      <header className="flex items-start justify-between gap-3 px-4 pt-5 pb-1 md:px-10 lg:pt-6">
        <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
          {messages.emergency.pageTitle}
        </h1>

        {/* 세 화면이 같은 세그먼트 컨트롤을 쓴다 */}
        <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
      </header>

      <EmergencyListView />
    </main>
  )
}
```

- [ ] **Step 5: 검증**

Run: `pnpm verify`
Expected: PASS

**실패하면 확인할 것:** `MapSheet` 의 `toolbar` prop 이 optional 인지, `EmptyState` 가 `action` prop 을 받는지, `ErrorState` 가 `onRetry` 를 받는지 — 세 컴포넌트 시그니처를 `grep -n "export function EmptyState" -A 12 src/components/empty-state.tsx` 로 확인한다.

- [ ] **Step 6: 브라우저에서 새 화면을 확인한다**

```bash
pnpm dev:alt
```

`http://localhost:5174/emergency?view=map` 을 열고 확인한다.

- 지도가 **좌표를 기다리지 않고 바로** 뜨는가 (제주 전경 → 좌표 도착 후 내 위치로 한 번 이동)
- 행을 누르면 핀이 검게 차고 지도가 도로 단위로 확대되는가
- 행을 누르면 그 행에 길찾기가 나오는가
- **필터 칩을 눌러도 지도가 되돌아가지 않는가** (이전 결함의 회귀 확인)
- `?view=list` 가 이전 화면과 같은가

- [ ] **Step 7: 커밋**

```bash
git add src/features/emergency/use-emergency-board.ts src/features/emergency/emergency-map-view.tsx src/features/emergency/emergency-list-view.tsx "app/(main)/emergency/page.tsx"
git commit -m "[FE] feat: 긴급 시설 지도 보기를 전면 지도 + 패널·시트 구조로 다시 만든다"
```

---

## Task 9: 기본 보기 전환 · 구 파일 삭제

**Files:**
- Modify: `src/lib/url/view-mode.ts`
- Modify: `src/lib/url/view-mode.test.ts`
- Modify: `app/(main)/emergency/page.tsx`
- Modify: `app/globals.css`
- Delete: `src/features/emergency/emergency-view.tsx`
- Delete: `src/features/emergency/emergency-map.tsx`
- Delete: `src/features/emergency/facility-selected-card.tsx`
- Delete: `src/features/emergency/facility-selected-card.test.ts`

**Interfaces:**
- Produces: `EMERGENCY_DEFAULT_VIEW: ViewMode` (`@/lib/url/view-mode`)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/url/view-mode.test.ts` 끝에 붙인다.

```ts
describe('EMERGENCY_DEFAULT_VIEW', () => {
  it('긴급 시설의 기본 보기는 지도다', () => {
    expect(EMERGENCY_DEFAULT_VIEW).toBe('map')
  })

  it('빈 쿼리는 지도로 떨어진다', () => {
    expect(parseViewMode({}, EMERGENCY_DEFAULT_VIEW)).toBe('map')
  })

  it('기본값인 지도는 URL 에서 생략되고 목록이 붙는다', () => {
    expect(viewModeHref('/emergency', '', 'map', EMERGENCY_DEFAULT_VIEW)).toBe('/emergency')
    expect(viewModeHref('/emergency', '', 'list', EMERGENCY_DEFAULT_VIEW)).toBe(
      '/emergency?view=list',
    )
  })

  it('장소 찾기와 같은 값이다 — 두 지도 화면의 URL 모양이 같아야 한다', () => {
    expect(EMERGENCY_DEFAULT_VIEW).toBe(PLACES_DEFAULT_VIEW)
  })
})
```

import 에 `EMERGENCY_DEFAULT_VIEW` 와 `PLACES_DEFAULT_VIEW` 를 더한다.

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm vitest run src/lib/url/view-mode.test.ts`
Expected: FAIL — `EMERGENCY_DEFAULT_VIEW` 를 export 하지 않는다

- [ ] **Step 3: 상수를 더하고 주석을 뒤집는다**

`src/lib/url/view-mode.ts` 의 `PLACES_DEFAULT_VIEW` 블록을 아래로 바꾼다.

```ts
/**
 * 장소 찾기(`/places`)와 긴급 시설(`/emergency`)의 기본 보기는 **지도**다.
 *
 * 두 화면에 오는 이유가 "제주 어디에 무엇이 있나" 이고, 그 질문에 먼저 답하는 것은
 * 목록이 아니라 지도다. 목록으로 열면 사용자가 매번 전환을 한 번 더 눌러야 했다.
 *
 * **긴급 시설도 지도가 됐다** (#353). 예전에는 *"급할 때 필요한 것은 위치가 아니라
 * 전화번호이고, 지도 SDK 를 기다릴 여유가 없다"* 를 근거로 이 화면만 목록이었다.
 * 그 근거는 두 장치로 지킨다:
 *  - 모바일 시트가 **중간 단계로 열려** 첫 화면에 행과 52px 전화 버튼이 이미 보인다
 *  - SDK 가 실패하면 **목록 갈래로 되돌린다** (`EmergencyMapView` 의 `failure` 분기)
 *
 * 두 상수를 하나로 합치지 않는다 — 화면이 자기 기본값을 갖는다는 규약이 남아 있어야
 * 다음 지도 화면이 다른 값을 고를 수 있다.
 */
export const PLACES_DEFAULT_VIEW: ViewMode = 'map'
export const EMERGENCY_DEFAULT_VIEW: ViewMode = 'map'
```

- [ ] **Step 4: 라우트가 새 기본값을 쓰게 한다**

`app/(main)/emergency/page.tsx` 에서 세 줄을 바꾼다.

```tsx
import { EMERGENCY_DEFAULT_VIEW, parseViewMode, viewModeHref } from '@/lib/url/view-mode'
```

```tsx
  const view = parseViewMode(await searchParams, EMERGENCY_DEFAULT_VIEW)
  const listHref = viewModeHref('/emergency', '', 'list', EMERGENCY_DEFAULT_VIEW)
  const mapHref = viewModeHref('/emergency', '', 'map', EMERGENCY_DEFAULT_VIEW)
```

**`parseViewMode` 와 `viewModeHref` 에 같은 기본값을 넘겨야 한다.** 어긋나면 토글이 가리키는 보기와 페이지가 그리는 보기가 달라져 전환이 먹지 않는다.

- [ ] **Step 5: 구 파일을 지운다**

```bash
git rm src/features/emergency/emergency-view.tsx \
       src/features/emergency/emergency-map.tsx \
       src/features/emergency/facility-selected-card.tsx \
       src/features/emergency/facility-selected-card.test.ts
```

- [ ] **Step 6: 낡은 CSS 를 지운다**

`app/globals.css` 에서 아래를 **정확히 이 다섯 덩어리** 그대로 지운다 (파일 끝 근처, `.map-panel-width` 아래).

```css
/* 긴급 시설 지도 — 목록과 나란히 서는 높이.
   모바일 토글에서는 화면을 채우고, 1024+ 2단에서는 목록 옆에서 고정 높이를 갖는다. */
.emergency-map-height {
  height: calc(100dvh - var(--header-h) - var(--tabbar-h));
}

@media (width >= 64rem) {
  .emergency-map-height {
    height: calc(100dvh - var(--header-h) - 3rem);
  }
}
```

**`.map-canvas-height` 와 `.map-panel-width` 는 남긴다** — 새 화면이 그 둘을 쓴다.

- [ ] **Step 7: 남은 참조가 없는지 확인한다**

```bash
grep -rn "emergency-map-height\|EmergencyView\|FacilitySelectedCard\|features/emergency/emergency-map'" src app
```

Expected: 결과 없음

- [ ] **Step 8: 검증**

Run: `pnpm verify && pnpm format:check`
Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add src/lib/url/view-mode.ts src/lib/url/view-mode.test.ts "app/(main)/emergency/page.tsx" app/globals.css
git commit -m "[FE] refactor: 긴급 시설의 기본 보기를 지도로 바꾸고 2단 시절 코드를 걷는다"
```

---

## Task 10: 문서 갱신 · 실측 · PR

**Files:**
- Modify: `frontend/docs/features/emergency/공통명세.md`
- Modify: `frontend/docs/screen-inventory.md`
- Modify: `frontend/docs/architecture-guide.md`

- [ ] **Step 1: 브라우저 실측 (375)**

```bash
pnpm dev:alt
```

`http://localhost:5174/emergency` 를 375 폭에서 확인한다.

- 시트가 **중간 단계**로 열려 행 2~3개와 52px 전화 버튼이 보이는가
- 시트를 최소로 내리면 탭바가 보이고, 올리면 시트가 그 자리를 쓰는가
- 핀을 누르면 시트가 중간으로 올라오고 그 행으로 스크롤되는가
- 반경 칩 → 시트 → 40km 적용 후 지도 구도가 그만큼 넓어지는가

- [ ] **Step 2: 브라우저 실측 (768 · 1280)**

- 768: 시트 유지, 탭바 없음 (`map-sheet-above-tabbar` 가 `bottom: 0`)
- 1280: 패널 400, 하단 여백이 카카오 축척 막대를 누르지 않는가, 접기 탭이 접고 펼 때 제자리인가
- 1280 에서 패널을 접었다 펴면 지도가 잘리지 않는가 (`relayout`)

- [ ] **Step 3: 실패 경로 실측**

- 브라우저 위치 권한을 **거부**하고 새로고침 → 거리가 사라지고 "제주 중심 기준" 이 뜨는가, 카메라가 `/places` 첫 화면과 같은가
- `?view=list` 가 이전 화면과 같은가
- 지도를 반경 밖(예: 서귀포 남쪽 바다)으로 끌면 "반경 넓히기" 가 그 자리에 나오는가

- [ ] **Step 4: 문서를 고친다**

**`frontend/docs/features/emergency/공통명세.md`** — E0 의 두 문단을 바꾼다.

- `**범위**: 목록만. **지도는 #14**...` → 목록 갈래(`?view=list`)와 지도 갈래(기본)를 둘 다 적고, 지도 갈래의 설계 정본이 `docs/superpowers/specs/2026-09-09-emergency-map-unification-design.md` 임을 링크한다
- `**데스크톱도 한 컬럼이다.**` 문단 전체를 지우고, 대신 "데스크톱은 지도 위 400 부동 패널이다. 아트보드 04 의 좌 480 / 우 지도 2단은 채택하지 않았다 — 이유는 설계 문서 §9" 를 적는다

**`frontend/docs/screen-inventory.md`** — 두 곳.

지금 이렇게 적힌 문단을 찾는다.

```markdown
- **기본 보기는 화면마다 다르다.** 장소 찾기는 **지도**(`PLACES_DEFAULT_VIEW`)라 `/places` 가
  지도이고 목록이 `?view=list` 로 붙는다. 긴급 시설은 그대로 목록이다 — 급할 때 필요한 것은
  위치가 아니라 전화번호이고 지도 SDK 를 기다릴 여유가 없다. `parseViewMode` 와
```

이렇게 바꾼다.

```markdown
- **장소 찾기와 긴급 시설 모두 지도가 기본이다** (`PLACES_DEFAULT_VIEW` ·
  `EMERGENCY_DEFAULT_VIEW`). `/places` 와 `/emergency` 가 지도이고 목록이 `?view=list` 로
  붙는다. 긴급 시설은 한때 목록이 기본이었다 — *"급할 때 필요한 것은 위치가 아니라
  전화번호이고 지도 SDK 를 기다릴 여유가 없다"*. 그 근거는 [#353](https://github.com/8llow8llowMe/hondigagae/issues/353)
  에서 **두 장치로 옮겨 지켰다**: 모바일 시트가 중간 단계로 열려 첫 화면에 행과 52px 전화
  버튼이 이미 보이고, SDK 가 실패하면 목록 갈래로 되돌린다. `parseViewMode` 와
```

(이어지는 `viewModeHref 에 **같은 기본값**을...` 부터는 그대로 둔다.)

§5-2 표의 `상태` 칸을 바꾼다.

```markdown
| 주변 긴급 시설 | `/emergency` | `GET /emergencies/facilities` | **구현** (#13) · **지도 구현** (#14) · **지도 기본** (#353) |
```

**`frontend/docs/architecture-guide.md`** — 두 곳.

§9 표의 긴급 시설 행 비고를 바꾼다.

```markdown
| 긴급 시설        | **없음**                     | client                    | 좌표가 브라우저에만 있어 서버가 무엇을 조회할지 모른다. **지도 이동으로 재조회하지 않는다** — `distanceMeters` 가 지도 중심 기준이 되어 "가까운 순 · 480m" 이 거짓이 된다 (#353) |
```

§10 에서 `view` 기본값을 설명하며 긴급 시설이 예외라고 적은 대목을 찾아, screen-inventory 와 **같은 취지**로 고친다 (두 화면이 같은 기본값을 쓰고, 안전 근거는 시트 단계와 폴백이 맡는다). 두 문서가 갈리면 다음 사람이 어느 쪽을 믿을지 알 수 없다.

- [ ] **Step 5: 검증**

Run: `pnpm verify && pnpm format:check`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add docs/features/emergency/공통명세.md docs/screen-inventory.md docs/architecture-guide.md
git commit -m "[DOCS] docs: 긴급 시설 지도 기본 보기와 재조회 없음 규칙을 문서에 반영한다"
```

- [ ] **Step 7: PR 을 만든다**

본문은 `/pr` 스킬로 `.github/PULL_REQUEST_TEMPLATE.md` 를 채우고, 스크래치패드에 쓴 뒤 넘긴다
(저장소에 커밋하지 않는다). **`Issue Number: #353` 을 반드시 채운다** — 비면 이슈가 자동으로
닫히지 않는다.

```bash
git push
gh pr create --base develop \
  --title "[FE] refactor: 긴급 시설 화면을 장소 찾기 지도 문법으로 통일" \
  --body-file /tmp/pr-353.md \
  --assignee @me \
  --label frontend-web
```

라벨 `frontend-web` 이 필수다 — Jenkins 가 PR 라벨로 배포 스코프를 정하고 라벨이 없으면
배포하지 않는다 (fail-closed · `docs/git-workflow.md`).

- [ ] **Step 8: CI 를 확인하고 `Rebase and merge` 로 머지한다**

`Squash` 나 `Create a merge commit` 을 쓰지 않는다 (`docs/git-workflow.md`). 머지 후 브랜치를 삭제하고 워크트리를 정리한다.

```bash
git worktree remove /Users/seonghoho/Documents/projects/hondigagae-353
```

---

## 참고 — 실행 중 막히면

| 증상 | 먼저 볼 곳 |
| --- | --- |
| 지도가 안 뜨고 "지도를 준비 중이에요" 만 보인다 | 포트 3000 으로 띄웠는지. 카카오 키 도메인이 5174 에만 등록돼 있다 |
| 지도가 필터 누를 때마다 되돌아간다 | `camera` 를 `useMemo` 로 만들었는지 (Task 8 Step 1) |
| 핀을 눌러도 확대가 안 된다 | `MapCanvas` 에 `selectedLevel` 을 넘겼는지 (Task 8 Step 3) |
| 패널을 접었는데 지도가 잘려 보인다 | `MapCanvas` 의 `ResizeObserver → relayout` 이 도는지. 컨테이너 크기 변화가 없으면 안 돈다 |
| 칩 개수와 캡션 개수가 어긋난다 | `EmergencyFilterBar` 에 `inBounds`(필터 전)를 넘겼는지. `visible` 을 넘기면 안 된다 |
| 시트가 "장소 목록" 으로 읽힌다 | `label` 인자를 빠뜨렸다 (Task 8 Step 3) |
| lint 가 import 순서를 문제 삼는다 | 이 계획의 코드 블록은 순서를 보장하지 않는다. `pnpm lint:fix` 로 정렬한다 |
| `messages.place.*` 문구가 없다 | `EmergencyFilterBar` 가 빌려 쓰는 5개다 (Task 6 Step 4 의 확인 절차). 없으면 `messages/emergency.ts` 에 더한다 — **`/places` 문구를 고치지 않는다** |
