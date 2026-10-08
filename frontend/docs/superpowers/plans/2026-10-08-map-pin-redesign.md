# 지도 핀 카테고리 아이콘 원 — 구현 계획

> 착수 시점의 계획 스냅숏이다. 진행 상황의 정본은 이슈 [#1280](https://github.com/8llow8llowMe/hondigagae/issues/1280) 과 PR 이다 (루트 `CLAUDE.md` #860 — 체크박스를 쓰지 않는다).

**Goal:** `/places` · 담기 지도의 장소 핀을 브랜드 초록 원 + 카테고리 아이콘으로 바꾸고, 이름은 level ≤ 6 · 선택 · 호버 · 포커스에서만 원 옆 알약으로 보인다. 묶음 원은 브랜드 테두리로 바꾼다.

**Architecture:** 판단은 순수 함수(`pinContent`)에, 아이콘 고르기는 장소 도메인(`lib/place/pin-icon.ts`)에, 아이콘 마크업은 지도 층의 고정 SVG 문자열(`lib/map/pin-icons.ts`)에 둔다. `markerElement` 는 서술자를 바르기만 한다 — 새 필드 `icon` 이 있으면 고정 SVG 를 앞에 붙인다. 아이콘이 없는 핀(긴급 시설 · 동선 · 정적)은 예전 이름표 그대로다.

**Tech Stack:** Next.js App Router · TypeScript · Tailwind v4 + `app/globals.css` · 카카오 지도 JS SDK `CustomOverlay` · vitest(node 환경, DOM 없음) · Playwright(실측 스크립트)

**Spec:** `frontend/docs/features/place/지도핀-세부명세.md`

## Global Constraints

- 모든 파일 UTF-8 (no BOM). 커밋 prefix `[FE]` / `[DOCS]`, 경로를 하나씩 `git add` (`git add -A` 금지)
- 이름이 서는 줌: **카카오 level ≤ 6** (`PIN_NAME_MAX_LEVEL = 6`)
- 원 지름: 기본 **26** · 선택 **34** · 묶음 **32**(그대로). 누르는 자리 **44**
- 원 채움 `--brand-600` · 테두리 흰(`--bg`) 2 · 아이콘 `--fg-inverse` 14(선택 18)
- 이름 알약: 원 오른쪽 **4** · `--bg` · `--border` · 12px/600 · 최대 160 · 말줄임. 선택은 `--fg` 채움 · `--fg-inverse` · 13px · 최대 220
- 흐림: 원 `--fg-subtle` · 이름 글자 `--fg-muted`
- 묶음: `--bg` 채움 · `--brand-600` 테두리 2 · 숫자 `--brand-700` (겹친 원 `::after` 도 같은 테두리)
- 아이콘은 `contentType.code` 로 고른다 — 한국어 `name` 금지. 카페 = `RESTAURANT` + 원천 분류 `카페`
- 등급 색(metric-*)을 마커에 쓰지 않는다 (`DESIGN.md`)
- 새 색 토큰을 만들지 않는다 — 팔레트 값만
- 검증 명령: `pnpm verify` (= eslint · tsc · vitest), `pnpm format:check`

## Review Focus

- **이름이 숨은 핀의 접근 이름** — 이름 `span` 을 `display: none` 으로 숨기면 버튼 이름이 사라진다. 시각적으로만 숨겨야 한다(클리핑). Task 3 테스트가 갈래와 무관하게 `label` 이 늘 장소명인지 잠그고, Task 5 CSS 가 `display: none` 을 쓰지 않는지 소스에서 본다.
- **`.map-pin-selected` · `.map-pin-muted` 의 누수** — 이 클래스들은 단독 선택자라 원 핀에 붙이면 `padding 8px 12px` 이 원을 알약으로 만든다. 원 핀은 `map-pin-dot-*` 전용 수식어만 쓴다(Task 3 · Task 5).
- **원 핀의 앵커** — 이름 알약이 원 상자 안에 들어가면 이름이 설 때마다 원이 옆으로 밀린다. 알약은 `position: absolute` 로 상자 밖에 매달고 `yAnchor 0.5`(Task 4 · Task 5).
- **카페 판정이 두 곳에서 갈리는 것** — 목록 행(`placeTypeLabel`)과 핀이 다른 조건을 쓰면 같은 곳이 `카페` 와 수저로 말한다. 조건을 `isCafePlace` 하나로 뽑아 둘이 쓴다(Task 2).
- **긴급 시설 핀의 회귀** — `/emergency` 는 `icon` 을 넘기지 않으므로 예전 이름표여야 한다. 묶음만 함께 바뀐다(Task 3 테스트 · Task 7 실측).

---

### Task 1: 지도 핀 아이콘 SVG (`lib/map/pin-icons.ts`)

**Files:**

- Create: `frontend/src/lib/map/pin-icons.ts`
- Test: `frontend/src/lib/map/pin-icons.test.ts`

**Interfaces:**

- Produces: `export type MapPinIcon = 'landscape' | 'utensils' | 'coffee' | 'bed' | 'museum' | 'flag' | 'footprints' | 'bike' | 'bag' | 'pin'`
- Produces: `export const MAP_PIN_ICONS: readonly MapPinIcon[]`
- Produces: `export function pinIconSvg(icon: MapPinIcon): string` — 크기 속성 없는 `<svg viewBox="0 0 24 24" …>` 문자열(크기는 CSS 가 준다)

키 이름이 **모양**이지 장소 분류가 아닌 이유: 지도 층은 장소 도메인을 모른다(`component-guide.md` §9). 무엇을 어느 모양으로 그릴지는 Task 2 가 정한다.

1. 실패하는 테스트를 쓴다.

```ts
import { describe, expect, it } from 'vitest'

import { MAP_PIN_ICONS, pinIconSvg } from '@/lib/map/pin-icons'

describe('pinIconSvg — 지도 핀 아이콘 (#1280)', () => {
  it('10종 모두 24 격자 · currentColor · 선 1.5 의 장식 svg 다', () => {
    expect(MAP_PIN_ICONS).toHaveLength(10)
    for (const icon of MAP_PIN_ICONS) {
      const svg = pinIconSvg(icon)

      expect(svg.startsWith('<svg ')).toBe(true)
      expect(svg).toContain('viewBox="0 0 24 24"')
      expect(svg).toContain('stroke="currentColor"')
      expect(svg).toContain('stroke-width="1.5"')
      expect(svg).toContain('aria-hidden="true"')
      expect(svg).toContain('focusable="false"')
    }
  })

  /* 크기는 상태(기본 14 · 선택 18)마다 CSS 가 준다 — 문자열에 박으면 두 벌이 필요하다 */
  it('width · height 를 박지 않는다', () => {
    for (const icon of MAP_PIN_ICONS) {
      expect(pinIconSvg(icon)).not.toMatch(/\s(width|height)=/)
    }
  })

  it('모양마다 그림이 다르다 — 같은 path 를 두 키가 쓰지 않는다', () => {
    const bodies = MAP_PIN_ICONS.map((icon) => pinIconSvg(icon))
    expect(new Set(bodies).size).toBe(MAP_PIN_ICONS.length)
  })
})
```

2. `cd frontend && npx vitest run src/lib/map/pin-icons.test.ts` — 모듈이 없어 FAIL.

3. 구현한다. path 는 `components/icons` 결(24 격자 · 선 1.5 · 둥근 끝)로 그린다. 아래 값으로 시작하고, Task 7 실측에서 14px 구별이 안 되는 것만 고친다.

```ts
/**
 * 지도 핀 안의 아이콘 — 이슈 #1280 (`docs/features/place/지도핀-세부명세.md` D2-1).
 *
 * **React 컴포넌트가 아니라 문자열이다.** 핀은 카카오 `CustomOverlay` 에 넘기는 DOM 이라 React 트리
 * 밖이다(`pin-content.ts` 머리주석). `markerElement` 가 이 **고정 문자열**만 붙인다 — 사용자 데이터가
 * 마크업에 섞이지 않는다(이름은 `textContent`).
 *
 * **키는 모양이다** — 지도 층은 장소 분류를 모른다. 어느 장소를 어느 모양으로 그릴지는
 * `lib/place/pin-icon.ts` 가 정한다. 결은 `components/icons` 와 같다(24 · 선 1.5 · `currentColor`).
 */
export type MapPinIcon =
  | 'landscape'
  | 'utensils'
  | 'coffee'
  | 'bed'
  | 'museum'
  | 'flag'
  | 'footprints'
  | 'bike'
  | 'bag'
  | 'pin'

const PATHS: Record<MapPinIcon, string> = {
  // 산 두 봉우리
  landscape: '<path d="M3 19l6-9 4 5 2-3 6 7z"/>',
  // 수저
  utensils: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.7 0-3 2-3 5s1.3 4 3 4v9"/>',
  // 커피잔
  coffee:
    '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
  // 침대
  bed: '<path d="M3 18v-8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>',
  // 기둥 건물
  museum: '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
  // 깃발
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  // 발자국 두 개
  footprints:
    '<path d="M8 13c-1.7 0-3-1.8-3-4.5S6.3 4 8 4s3 1.8 3 4.5S9.7 13 8 13zM6.5 16h3M16 20c-1.7 0-3-1.8-3-4.5S14.3 11 16 11s3 1.8 3 4.5S17.7 20 16 20z"/>',
  // 자전거
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3 7M9 6h3"/>',
  // 쇼핑백
  bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  // 범용 — `components/icons` 의 PinIcon 과 같은 그림
  pin: '<path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.5"/>',
}

export const MAP_PIN_ICONS = Object.keys(PATHS) as readonly MapPinIcon[]

export function pinIconSvg(icon: MapPinIcon): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[icon]}</svg>`
}
```

4. 같은 명령으로 PASS.

5. 커밋한다.

```bash
git add frontend/src/lib/map/pin-icons.ts frontend/src/lib/map/pin-icons.test.ts
git commit -m "[FE] feat: 지도 핀 아이콘 SVG 10종을 고정 문자열로 둔다 (#1280)"
```

---

### Task 2: 장소 → 아이콘 고르기 (`lib/place/pin-icon.ts`) · `isCafePlace`

**Files:**

- Modify: `frontend/src/features/place/filter-labels.ts:86-95` (`placeTypeLabel`)
- Create: `frontend/src/lib/place/pin-icon.ts`
- Test: `frontend/src/lib/place/pin-icon.test.ts`, `frontend/src/features/place/filter-labels.test.ts`(있으면 보강)

**Interfaces:**

- Consumes: `MapPinIcon` (Task 1)
- Produces: `export function isCafePlace(place: { contentType: { code: string }; sourceCategory: string | null }): boolean` · `export const CAFE_SOURCE_CATEGORY = '카페'` (`lib/place/cafe.ts`)
- Produces: `export function placePinIcon(place: { contentType: { code: string }; sourceCategory: string | null }): MapPinIcon` (`lib/place/pin-icon.ts`)

`lib/` 이 `features/` 를 가져오면 층이 뒤집힌다. 그래서 `isCafePlace` 를 `features/place/filter-labels.ts` 에 두면 `lib/place/pin-icon.ts` 가 쓸 수 없다 — 판정은 `lib/place/cafe.ts`(새 파일)에 두고 `filter-labels.ts` 가 그것을 가져온다. `CAFE_SOURCE_CATEGORY` 상수도 함께 옮긴다(이미 `filter-labels.ts` 밖에서 쓰는 곳이 있으면 그 import 를 새 경로로 바꾼다 — `grep -rn CAFE_SOURCE_CATEGORY src`).

- Create 추가: `frontend/src/lib/place/cafe.ts` — `export const CAFE_SOURCE_CATEGORY = '카페'`, `export function isCafePlace(...)`

1. 실패하는 테스트를 쓴다 (`src/lib/place/pin-icon.test.ts`).

```ts
import { describe, expect, it } from 'vitest'

import { isCafePlace } from '@/lib/place/cafe'
import { placePinIcon } from '@/lib/place/pin-icon'

const at = (code: string, sourceCategory: string | null = null) => ({
  contentType: { code },
  sourceCategory,
})

describe('placePinIcon — contentType.code 로 고른다 (#1280 D2-1)', () => {
  it.each([
    ['TOURIST_SPOT', 'landscape'],
    ['RESTAURANT', 'utensils'],
    ['LODGING', 'bed'],
    ['CULTURE', 'museum'],
    ['FESTIVAL', 'flag'],
    ['COURSE', 'footprints'],
    ['LEPORTS', 'bike'],
    ['SHOPPING', 'bag'],
  ] as const)('%s → %s', (code, icon) => {
    expect(placePinIcon(at(code))).toBe(icon)
  })

  it('카페 분류 음식점은 커피잔이다 — 목록 행의 `카페` 와 같은 판정', () => {
    expect(placePinIcon(at('RESTAURANT', '카페'))).toBe('coffee')
    expect(isCafePlace(at('RESTAURANT', '카페'))).toBe(true)
  })

  it('음식점이 아니면 원천 분류가 카페여도 바꾸지 않는다', () => {
    expect(placePinIcon(at('TOURIST_SPOT', '카페'))).toBe('landscape')
    expect(isCafePlace(at('TOURIST_SPOT', '카페'))).toBe(false)
  })

  it('모르는 코드는 범용 핀이다 — 분류를 지어내지 않는다', () => {
    expect(placePinIcon(at('UNKNOWN_NEW_TYPE'))).toBe('pin')
  })
})
```

2. `npx vitest run src/lib/place/pin-icon.test.ts` — FAIL.

3. 구현한다.

`src/lib/place/cafe.ts`:

```ts
/**
 * 카페 판정 — `RESTAURANT` + 원천 분류 `카페` (#1156 · #1181 · #1280).
 *
 * **한 곳에만 둔다.** 목록 행의 유형 낱말(`placeTypeLabel`)과 지도 핀 아이콘(`placePinIcon`)이 같은
 * 판정을 써야 같은 곳이 `카페` 와 수저로 갈리지 않는다.
 */
export const CAFE_SOURCE_CATEGORY = '카페'

export function isCafePlace(place: {
  contentType: { code: string }
  sourceCategory: string | null
}): boolean {
  return place.contentType.code === 'RESTAURANT' && place.sourceCategory === CAFE_SOURCE_CATEGORY
}
```

`src/lib/place/pin-icon.ts`:

```ts
import type { MapPinIcon } from '@/lib/map/pin-icons'
import { isCafePlace } from '@/lib/place/cafe'

/**
 * 장소 → 지도 핀 아이콘 (#1280, `docs/features/place/지도핀-세부명세.md` D2-1).
 *
 * **`contentType.code` 로 고른다 — 한국어 `name` 으로 고르지 않는다** (`illustration.ts` 와 같은 규칙).
 * 모르는 코드는 범용 핀이다 — 분류를 지어내지 않는다.
 */
const BY_CODE: Record<string, MapPinIcon> = {
  TOURIST_SPOT: 'landscape',
  RESTAURANT: 'utensils',
  LODGING: 'bed',
  CULTURE: 'museum',
  FESTIVAL: 'flag',
  COURSE: 'footprints',
  LEPORTS: 'bike',
  SHOPPING: 'bag',
}

export function placePinIcon(place: {
  contentType: { code: string }
  sourceCategory: string | null
}): MapPinIcon {
  if (isCafePlace(place)) return 'coffee'
  return BY_CODE[place.contentType.code] ?? 'pin'
}
```

`filter-labels.ts` 의 `placeTypeLabel` 은 조건을 `isCafePlace(place)` 로 바꾸고, 파일 안의 `CAFE_SOURCE_CATEGORY` 정의를 지우고 `@/lib/place/cafe` 에서 가져온다.

```ts
export function placeTypeLabel(place: {
  contentType: { code: string; name: string }
  sourceCategory: string | null
}): string {
  // 판정은 `isCafePlace` 하나 — 지도 핀 아이콘(#1280)과 갈리지 않게
  if (isCafePlace(place) && place.sourceCategory !== null) return place.sourceCategory
  return place.contentType.name
}
```

4. `npx vitest run src/lib/place src/features/place` — PASS (기존 `place-row.test.ts` 카페 절 포함).

5. 커밋한다.

```bash
git add frontend/src/lib/place/cafe.ts frontend/src/lib/place/pin-icon.ts frontend/src/lib/place/pin-icon.test.ts frontend/src/features/place/filter-labels.ts
git commit -m "[FE] feat: 장소의 지도 핀 아이콘을 고르고 카페 판정을 한 곳으로 모은다 (#1280)"
```

(`CAFE_SOURCE_CATEGORY` 를 쓰던 다른 파일을 고쳤으면 그 경로도 하나씩 `git add` 한다.)

---

### Task 3: 핀 서술자의 원 갈래 (`pinContent`)

**Files:**

- Modify: `frontend/src/lib/map/pin-content.ts`
- Test: `frontend/src/lib/map/pin-content.test.ts`

**Interfaces:**

- Consumes: `MapPinIcon` (Task 1)
- Produces: `PinContentInput` 에 `icon?: MapPinIcon` · `named?: boolean`
- Produces: `PinContent` 에 `icon: MapPinIcon | null` — **모든 갈래가 이 필드를 낸다**(원 갈래만 값, 나머지 `null`)
- Produces: `export const PIN_NAME_MAX_LEVEL = 6`

원 갈래 규칙:

- `className`: `'map-pin-dot'` + (`named || selected`) → `'map-pin-dot-named'` + `selected` → `'map-pin-dot-selected'` + `muted` → `'map-pin-dot-muted'` + (`!interactive`) → `'map-pin-static'`. **`map-pin` · `map-pin-selected` · `map-pin-muted` 를 쓰지 않는다**(Review Focus).
- `label`: 늘 이름(선택이면 캡션 붙음) — 이름이 숨어도 버튼 접근 이름이 그것이다.
- `ariaLabel`: 기존 규칙 그대로(버튼이면 `null`, 정적이면 이름).
- 순번 핀(`order`)이 있으면 원 갈래보다 순번 갈래가 먼저다(지금 순서 유지).

1. 실패하는 테스트를 `pin-content.test.ts` 끝에 더한다.

```ts
describe('pinContent — 카테고리 아이콘 원 (#1280)', () => {
  const dot = { title: '사라봉공원', icon: 'landscape' as const }
  const on = { selected: false, interactive: true }

  it('아이콘이 있으면 원 갈래다 — 예전 이름표 클래스를 쓰지 않는다', () => {
    const content = pinContent(dot, on)

    expect(content.icon).toBe('landscape')
    expect(content.className.split(' ')).toContain('map-pin-dot')
    expect(content.className.split(' ')).not.toContain('map-pin')
  })

  it('이름은 숨어 있어도 늘 장소명이다 — 버튼의 접근 이름이 된다', () => {
    const content = pinContent(dot, on)

    expect(content.label).toBe('사라봉공원')
    expect(content.ariaLabel).toBeNull()
    expect(content.className.split(' ')).not.toContain('map-pin-dot-named')
  })

  it('named 면 이름을 상시 연다', () => {
    expect(pinContent({ ...dot, named: true }, on).className.split(' ')).toContain(
      'map-pin-dot-named',
    )
  })

  it('선택되면 줌과 상관없이 이름을 열고 캡션을 붙인다', () => {
    const content = pinContent({ ...dot, caption: '480m' }, { selected: true, interactive: true })
    const classes = content.className.split(' ')

    expect(classes).toEqual(
      expect.arrayContaining(['map-pin-dot', 'map-pin-dot-named', 'map-pin-dot-selected']),
    )
    expect(classes).not.toContain('map-pin-selected')
    expect(content.label).toBe('사라봉공원 · 480m')
    expect(content.ariaPressed).toBe(true)
  })

  it('흐림은 원 전용 수식어다 — map-pin-muted 의 이름표 규칙이 새지 않는다', () => {
    const classes = pinContent({ ...dot, muted: true }, on).className.split(' ')

    expect(classes).toContain('map-pin-dot-muted')
    expect(classes).not.toContain('map-pin-muted')
  })

  it('아이콘이 없는 핀은 예전 이름표 그대로다 — 긴급 시설 핀이 바뀌지 않는다', () => {
    const content = pinContent({ title: '제주동물병원', caption: '1.2km' }, on)

    expect(content.icon).toBeNull()
    expect(content.className).toBe('map-pin')
  })

  it('순번이 있으면 아이콘보다 순번이 먼저다', () => {
    const content = pinContent({ ...dot, order: 2 }, on)

    expect(content.className.split(' ')).toContain('map-pin-order')
    expect(content.icon).toBeNull()
  })

  it('묶음 · 기준점 서술자도 icon 필드를 낸다(null)', () => {
    expect(clusterContent(3).icon).toBeNull()
    expect(focusMarkerContent('수월봉').icon).toBeNull()
  })

  it('이름이 서는 줌은 level 6 이하다', () => {
    expect(PIN_NAME_MAX_LEVEL).toBe(6)
  })
})
```

(파일 머리의 import 에 `PIN_NAME_MAX_LEVEL` · `clusterContent` · `focusMarkerContent` 가 없으면 더한다.)

2. `npx vitest run src/lib/map/pin-content.test.ts` — FAIL.

3. 구현한다.
   - `PinContentInput` 에 필드 둘을 더한다.

```ts
  /**
   * 카테고리 아이콘(#1280). 있으면 **원 갈래**다 — 이름표 대신 아이콘 원, 이름은 옆 알약. 고르는 일은
   * 장소 도메인(`lib/place/pin-icon.ts`)이 한다. 없으면 예전 이름표(긴급 시설 · 정적 핀)
   */
  icon?: MapPinIcon
  /** 이름 알약을 상시 연다 — `level ≤ PIN_NAME_MAX_LEVEL`. 선택 · 호버 · 포커스는 이것과 별개로 연다 */
  named?: boolean
```

- `PinContent` 에 `icon: MapPinIcon | null` 을 더하고 `clusterContent` · `focusMarkerContent` · 순번 갈래 · 이름표 갈래가 `icon: null` 을 낸다.
- 순번 갈래 다음, 이름표 갈래 앞에 원 갈래를 둔다.

```ts
if (pin.icon !== undefined) {
  return {
    ...base,
    className: classNames(
      [
        'map-pin-dot',
        (pin.named === true || selected) && 'map-pin-dot-named',
        selected && 'map-pin-dot-selected',
        pin.muted === true && 'map-pin-dot-muted',
      ],
      interactive,
    ),
    icon: pin.icon,
    text: null,
    // **이름이 숨어 있어도 이 글자가 버튼의 접근 이름이다** — CSS 는 시각적으로만 숨긴다
    label: name,
    ariaLabel: interactive ? null : name,
  }
}
```

(`caption` · `name` 계산을 원 갈래보다 위로 올린다.)

- 파일 위에 상수를 둔다.

```ts
/**
 * 원 핀의 이름 알약이 **상시** 서는 가장 먼 줌 — 카카오 level 6(500m 축척, #1280 D1).
 * 그보다 멀면 원만 서고, 이름은 선택 · 호버 · 포커스 때만 연다. 섬 전체(level 10 근처)에서 이름
 * 20개가 서로 덮던 것을 걷는다.
 */
export const PIN_NAME_MAX_LEVEL = 6
```

4. `npx vitest run src/lib/map` — PASS.

5. 커밋한다.

```bash
git add frontend/src/lib/map/pin-content.ts frontend/src/lib/map/pin-content.test.ts
git commit -m "[FE] feat: 핀 서술자에 카테고리 아이콘 원 갈래를 더한다 (#1280)"
```

---

### Task 4: 지도 배선 (`map-canvas.tsx`) · 장소 핀에 아이콘 넘기기

**Files:**

- Modify: `frontend/src/features/map/map-canvas.tsx` — `MapPin` 타입(`:171`), 핀 effect(`:570-680`), `pinElement`(`:969`), `markerElement`(`:990`)
- Modify: `frontend/src/features/place/place-map-view.tsx:484-498` (`pins`)
- Test: `frontend/src/features/map/map-canvas-marker-wiring.test.ts`

**Interfaces:**

- Consumes: `pinIconSvg` (Task 1) · `placePinIcon` (Task 2) · `PinContent.icon` · `PIN_NAME_MAX_LEVEL` (Task 3)
- Produces: `MapPin.icon?: MapPinIcon`

1. 실패하는 테스트를 `map-canvas-marker-wiring.test.ts` 에 더한다.

```ts
describe('원 핀 배선 (#1280)', () => {
  /* 아이콘 마크업은 고정 문자열뿐이다 — 사용자 데이터가 HTML 로 들어가는 길을 만들지 않는다 */
  it('HTML 을 붙이는 자리는 하나이고 pinIconSvg 의 결과만 붙인다', () => {
    expect(occurrences('insertAdjacentHTML(')).toBe(1)
    expect(SOURCE).toContain("insertAdjacentHTML('afterbegin', pinIconSvg(content.icon))")
    expect(SOURCE).not.toContain('innerHTML')
  })

  it('이름 상시 표시는 level 로 정한다', () => {
    expect(SOURCE).toContain('level <= PIN_NAME_MAX_LEVEL')
  })

  it('원 핀은 원 중심이 좌표다 — yAnchor 0.5', () => {
    expect(SOURCE).toMatch(/first\.icon !== undefined/)
  })
})

describe('장소 핀이 아이콘을 넘긴다 (#1280)', () => {
  it('place-map-view 가 placePinIcon 으로 고른다', () => {
    const view = readFileSync(
      fileURLToPath(new URL('../place/place-map-view.tsx', import.meta.url)),
      'utf8',
    )
    expect(view).toContain('icon: placePinIcon(place)')
  })
})
```

(`readFileSync` · `fileURLToPath` import 가 없으면 `node:fs` · `node:url` 에서 더한다. 기존 `document.createElement` 2곳 · `aria-label` 1곳 검사는 그대로 통과해야 한다.)

2. `npx vitest run src/features/map/map-canvas-marker-wiring.test.ts` — FAIL.

3. 구현한다.
   - `MapPin` 에 `icon?: MapPinIcon` (`import type { MapPinIcon } from '@/lib/map/pin-icons'`) — 주석: 고르는 일은 장소 도메인, 없으면 예전 이름표.
   - `pinElement` 가 `named` 를 받는다.

```ts
function pinElement(
  pin: MapPin,
  selected: boolean,
  named: boolean,
  onClick: (() => void) | null,
): HTMLElement {
  return markerElement(
    pinContent({ ...pin, named }, { selected, interactive: onClick !== null }),
    onClick,
  )
}
```

- 핀 effect 의 호출부: `pinElement(first, first.id === selectedId, level <= PIN_NAME_MAX_LEVEL, interactive ? … : null)`. `level` 은 이미 effect 의존값이다.
- `yAnchor`: `isCluster || first.icon !== undefined || (first.order !== undefined && first.id !== selectedId) ? 0.5 : 1` — 위 주석에 "원 핀(#1280)도 원의 중심이 좌표다. 이름 알약은 상자 밖에 매달려(CSS) 앵커를 옮기지 않는다" 를 더한다.
- `markerElement` 에서 `className` 다음에:

```ts
/*
    **원 핀의 아이콘은 고정 SVG 문자열이다** (#1280, `lib/map/pin-icons.ts`). 사용자 데이터(이름)는 아래
    `textContent` 로만 들어간다 — HTML 로 들어가는 것은 이 상수뿐이다(`map-canvas-marker-wiring.test.ts`).
  */
if (content.icon !== null) element.insertAdjacentHTML('afterbegin', pinIconSvg(content.icon))
```

- `place-map-view.tsx` 의 `pins` 에 `icon: placePinIcon(place),` 를 더한다(`import { placePinIcon } from '@/lib/place/pin-icon'`).

4. `npx vitest run src/features/map src/lib/map src/features/place` 와 `npx tsc --noEmit` — PASS.

5. 커밋한다.

```bash
git add frontend/src/features/map/map-canvas.tsx frontend/src/features/map/map-canvas-marker-wiring.test.ts frontend/src/features/place/place-map-view.tsx
git commit -m "[FE] feat: 장소 지도 핀에 카테고리 아이콘을 넘기고 원 중심을 좌표로 둔다 (#1280)"
```

---

### Task 5: 원 핀 · 묶음 CSS (`app/globals.css`) · 대비 잠금

**Files:**

- Modify: `frontend/app/globals.css` — `.map-pin` 블록 뒤(`:1600` 근처)에 원 핀 블록, `:focus-visible` 규칙(`:1626`)에 `.map-pin-dot`, 묶음 오버라이드(`.map-cluster::after` 뒤)
- Test: `frontend/src/styles/contrast.test.ts`, `frontend/src/styles/map-pin-dot.test.ts`(새)

1. 실패하는 테스트를 쓴다.

`src/styles/contrast.test.ts` 끝:

```ts
/**
 * 원 핀 · 묶음 테두리 (#1280). 카카오 땅 타일은 #F9F9F9 근처(2026-10-08 스크린샷 표본)라
 * **가장 불리한 흰색**으로 잰다.
 */
describe('토큰 대비 — 지도 원 핀 · 묶음 (#1280)', () => {
  it('흰 아이콘이 브랜드 원 위에서 3:1 이상이다', () => {
    expect(contrastRatio(WHITE, token('--brand-600'))).toBeGreaterThanOrEqual(3)
  })

  it('브랜드 원 · 묶음 테두리가 흰 타일 위에서 3:1 이상이다', () => {
    expect(contrastRatio(token('--brand-600'), WHITE)).toBeGreaterThanOrEqual(3)
  })

  it('묶음 숫자(--brand-700)가 흰 원 위에서 4.5:1 이상이다', () => {
    expect(contrastRatio(token('--brand-700'), token('--bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('묶음 규칙이 실제로 브랜드 테두리 · 숫자를 쓴다', () => {
    const css = readGlobalsCss()
    const rule = /\n\.map-cluster\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''

    expect(rule).toContain('border: 2px solid var(--brand-600)')
    expect(rule).toContain('color: var(--brand-700)')
  })
})
```

`src/styles/map-pin-dot.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

const css = readGlobalsCss()
const block = (selector: string) =>
  new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\}`).exec(
    css,
  )?.[1] ?? ''

describe('원 핀 CSS (#1280)', () => {
  it('기본 원은 26 · 브랜드 채움 · 흰 테두리 2 · 원형이다', () => {
    const rule = block('.map-pin-dot')

    expect(rule).toContain('width: 26px')
    expect(rule).toContain('height: 26px')
    expect(rule).toContain('background: var(--brand-600)')
    expect(rule).toContain('border: 2px solid var(--bg)')
    expect(rule).toContain('border-radius: var(--radius-full)')
  })

  /* 패딩 박스 22(26 − 테두리 2×2) + 11×2 = 44 — §0-4 의 계산 방식 */
  it('누르는 자리가 44 다', () => {
    expect(block('.map-pin-dot::before')).toContain('inset: -11px')
    expect(block('.map-pin-dot-selected::before')).toContain('inset: -7px')
  })

  it('선택은 34 · --fg 채움이다', () => {
    const rule = block('.map-pin-dot-selected')

    expect(rule).toContain('width: 34px')
    expect(rule).toContain('background: var(--fg)')
  })

  it('이름 알약은 원 상자 밖에 매달린다 — 이름이 서도 원이 움직이지 않는다', () => {
    expect(block('.map-pin-dot > span')).toContain('position: absolute')
  })

  /* `display: none` 이면 버튼의 접근 이름이 사라진다 (Review Focus) */
  it('숨은 이름은 시각적으로만 숨긴다 — display: none 을 쓰지 않는다', () => {
    const hidden =
      /\.map-pin-dot:not\(\.map-pin-dot-named\)[^{]*\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''

    expect(hidden).toContain('clip-path: inset(50%)')
    expect(hidden).not.toContain('display: none')
  })

  it('호버 · 키보드 포커스에서 이름을 연다', () => {
    expect(css).toMatch(
      /\.map-pin-dot:not\(\.map-pin-dot-named\):not\(:hover\):not\(:focus-visible\) > span/,
    )
  })

  it('포커스 링이 원 핀에도 선다', () => {
    expect(css).toMatch(/\.map-pin-dot:focus-visible/)
  })
})
```

2. `npx vitest run src/styles/contrast.test.ts src/styles/map-pin-dot.test.ts` — FAIL.

3. 구현한다. `.map-pin-muted.map-pin-selected` 블록 뒤에 둔다(머리주석에 스펙 D2 · Review Focus 의 이유를 적는다).

```css
/*
  장소 핀 — 카테고리 아이콘 원 (#1280, `docs/features/place/지도핀-세부명세.md` D2).

  **이름표(`.map-pin`)와 수식어를 나누지 않는다.** `.map-pin-selected` · `.map-pin-muted` 는 단독
  선택자라 원에 붙이면 패딩 8/12 가 원을 알약으로 만든다 — 원은 `map-pin-dot-*` 만 쓴다.

  **원의 중심이 좌표다**(`yAnchor 0.5`). 이름 알약은 상자 밖(`position: absolute`)이라 이름이 서고
  사라져도 원이 움직이지 않는다.
*/
.map-pin-dot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 2px solid var(--bg);
  border-radius: var(--radius-full);
  background: var(--brand-600);
  color: var(--fg-inverse);
  box-shadow: var(--shadow-md);
  cursor: pointer;
}

.map-pin-dot > svg {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

/* 패딩 박스 22 + 11 × 2 = 44 (§0-4 와 같은 계산) */
.map-pin-dot::before {
  position: absolute;
  inset: -11px;
  content: '';
}

.map-pin-dot > span {
  position: absolute;
  top: 50%;
  left: calc(100% + 6px);
  max-width: 160px;
  overflow: hidden;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--fg);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: var(--shadow-md);
  transform: translateY(-50%);
}

/*
  **이름이 안 설 때는 시각적으로만 숨긴다** — `display: none` 이면 버튼의 접근 이름(안쪽 글자)이
  사라진다. 호버 · 키보드 포커스는 JS 없이 연다.
*/
.map-pin-dot:not(.map-pin-dot-named):not(:hover):not(:focus-visible) > span {
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  clip-path: inset(50%);
  box-shadow: none;
}

.map-pin-dot-selected {
  width: 34px;
  height: 34px;
  background: var(--fg);
}

.map-pin-dot-selected > svg {
  width: 18px;
  height: 18px;
}

/* 패딩 박스 30 + 7 × 2 = 44 */
.map-pin-dot-selected::before {
  inset: -7px;
}

.map-pin-dot-selected > span {
  max-width: 220px;
  border-color: var(--fg);
  background: var(--fg);
  color: var(--fg-inverse);
  font-size: 13px;
}

.map-pin-dot-muted {
  background: var(--fg-subtle);
}

.map-pin-dot-muted > span {
  color: var(--fg-muted);
}

.map-pin-dot-muted.map-pin-dot-selected {
  background: var(--fg);
}

.map-pin-dot-muted.map-pin-dot-selected > span {
  color: var(--fg-inverse);
}
```

- 포커스 링 규칙의 선택자 목록에 `.map-pin-dot:focus-visible,` 를 더한다.
- 묶음 — 공유 블록(`.map-cluster,\n.map-pin-order`)은 **건드리지 않는다**(순번 원은 그대로). `.map-cluster::after` 블록 뒤에:

```css
/*
  **묶음만 브랜드 테두리 · 숫자다** (#1280). 회색 테두리 원이 도로 번호처럼 읽혔다. 공유 블록은 순번 원
  (`.map-pin-order`)이 그대로 쓰므로 묶음만 덮는다. 겹친 원도 같은 테두리라야 한 묶음으로 읽힌다.
*/
.map-cluster {
  border: 2px solid var(--brand-600);
  color: var(--brand-700);
}

.map-cluster::after {
  inset: -2px;
  border: 2px solid var(--brand-600);
}
```

(기존 `contrast.test.ts` 의 "마커 규칙이 실제로 --fg-subtle 을 테두리에 쓴다" 는 공유 블록을 보므로 그대로 통과한다 — 순번 원이 그 토큰을 쓴다. 테두리가 2px 이 되면 패딩 박스가 28 이라 `::before inset -7px` 은 42 다 — 묶음 전용으로 `.map-cluster::before { inset: -8px; }` 를 더해 `28 + 8 × 2 = 44` 를 지킨다. 테스트로 잠근다:)

```ts
it('묶음 테두리가 2 가 돼도 누르는 자리는 44 다 — 패딩 박스 28 + 8 × 2', () => {
  expect(block('.map-cluster::before')).toContain('inset: -8px')
})
```

(이 테스트는 `map-pin-dot.test.ts` 의 describe 안에 넣는다. `.map-cluster::before` 오버라이드는 공유 규칙 `.map-cluster::before,\n.map-pin-order::before` **뒤에** 둬야 이긴다 — 위 묶음 오버라이드 블록에 함께 둔다.)

4. `npx vitest run src/styles` — PASS.

5. 커밋한다.

```bash
git add frontend/app/globals.css frontend/src/styles/contrast.test.ts frontend/src/styles/map-pin-dot.test.ts
git commit -m "[FE] feat: 장소 핀을 카테고리 아이콘 원으로 그리고 묶음 원에 브랜드 테두리를 준다 (#1280)"
```

---

### Task 6: 전체 검증 · e2e grep

1. `cd frontend && pnpm verify` — 전부 통과. 실패하면 그 테스트가 지키던 결정을 읽고 고친다(테스트를 지우지 않는다).
2. `pnpm format:check` — 통과(실패하면 `npx prettier --write <파일>` 후 **다시 `git add`**).
3. e2e 가 바뀐 마크업에 기대는지 본다:

```bash
grep -rn "map-pin\|map-cluster\|이 지역 \|aria-pressed" e2e | grep -v "^e2e/.*://"
```

걸리는 스펙이 있으면 그 기대(클래스 · 이름)를 새 규칙에 맞춘다. 장소 핀의 접근 이름은 그대로 장소명이라 `getByRole('button', { name })` 기반은 바뀌지 않아야 한다. 4. 고친 것이 있으면 경로를 하나씩 `git add` 하고 커밋한다: `[FE] test: …`.

---

### Task 7: 실측 · 문서

**Files:**

- Modify: `frontend/DESIGN.md` §0-4 (원 핀 · 묶음 테두리 예외 추가)
- Modify: `frontend/docs/features/emergency/긴급시설-목록우선-세부명세.md` D10 표(`:288` 근처) — 묶음 테두리 · zIndex 를 코드와 맞춘다(`--brand-600` 2px · cluster 11 · selected 10 · pin 2)
- Modify: `frontend/docs/features/place/지도핀-세부명세.md` 머리 상태 줄

1. 워크트리 dev 서버(메모리: `.env.local` 복사 · `next dev -p 5174 --webpack`)에서 headless chromium 스크립트로 캡처한다 — 1440×900 · 390×844(iPhone 13) × `/places`(섬 전체) · `/places?place=126451`(250m · level 5) · 한 번 축소한 level 6(지도 휠 한 칸). 확인할 것:
   - 섬 전체: 원만 서고 이름 알약이 없다 · 묶음 원이 초록 테두리
   - level 6 · 5: 주변 원 옆에 이름 알약
   - 선택 핀: 34 검은 원 + 검은 알약
   - 데스크톱 호버: 이름이 열린다 · Tab 포커스: 이름 + 포커스 링
   - `/emergency?view=map`: 시설 핀은 예전 이름표, 묶음만 초록 테두리
   - 아이콘 9종이 14px 에서 서로 구별되는가 — 안 되면 Task 1 의 path 를 고치고 다시 잰다
2. `DESIGN.md` §0-4 끝에 원 핀 단락을 더한다: 26/34 원 · 흰 테두리 2 · `--brand-600` · 아이콘 흰 · 히트 44(`inset -11`/`-7`) · 이름 알약은 상자 밖 · 등급 색 아님(브랜드 단일색 · 아이콘으로 가른다) · 묶음 테두리 `--brand-600` 2(+ `::before inset -8`).
3. 긴급 D10 표를 코드와 맞춘다.
4. 스펙 상태 줄을 `> 상태: **구현 완료** (#1280 · PR #…, 2026-10-…)` 로 바꾼다(PR 번호는 PR 을 연 뒤 채운다).
5. 커밋한다(문서는 `[DOCS]`).

```bash
git add frontend/DESIGN.md frontend/docs/features/emergency/긴급시설-목록우선-세부명세.md frontend/docs/features/place/지도핀-세부명세.md
git commit -m "[DOCS] docs: 지도 원 핀 · 묶음 테두리 규칙을 DESIGN.md 와 긴급 D10 에 적는다 (#1280)"
```

6. 푸시 · PR — 본문 `Issue Number: #1280`, 검증 내역에 실측 결과를 적는다.
