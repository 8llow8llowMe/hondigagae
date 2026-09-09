# 장소 담기 화면 지도 보기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일정 담기 화면(`/plans/[planId]/days/[day]/add`)을 `/places` 와 같은 **지도 우선 + 목록 전환**으로 바꾼다.

**Architecture:** `PlaceMapView` 를 두 벌로 만들지 않고 **slot props 로 재사용**한다. 두 화면의 실제 차이는 행 액션 · 핀 톤 · 높이 소유권 · 토글 목적지 넷뿐이고, 지도 상태 8개 · 목록↔주변 조회 전환 · 뷰포트 필터 · SDK 실패 폴백은 완전히 같다. `PlaceListSection.renderRow` 가 같은 상황(#82)에 남긴 선례를 따른다. 보기 상태는 URL `?view=` 가 갖는다.

**Tech Stack:** Next.js App Router (RSC) · TanStack Query v5 · Tailwind v4 · 카카오 지도 SDK · vitest (node 환경 + `renderToStaticMarkup` 문자열 assertion)

**Spec:** `frontend/docs/features/plan/담기지도-세부명세.md` (커밋 `05bdb27`, D2 는 계획 작성 중 한 번 개정)

**Issue:** [#370](https://github.com/8llow8llowMe/hondigagae/issues/370) · **Branch:** `feature/fe/370-plan-add-place-map`

---

## Global Constraints

이 절의 규칙은 **모든 태스크의 요구사항에 암묵적으로 포함된다.**

- **작업 디렉터리는 `frontend/` 다.** 아래 모든 경로와 명령은 거기 기준이다.
- **파일은 UTF-8 (no BOM).** 한국어 주석·문구가 전부라 인코딩이 깨지면 즉시 티가 난다.
- **`git add -A` / `git add .` / `git stash` 금지.** 이 작업 트리를 다른 세션과 공유한다 — 경로를 하나씩 적어 스테이징한다 (`docs/git-workflow.md` §4-1).
- **`develop` 에 직접 커밋하지 않는다.** 브랜치는 `feature/fe/370-plan-add-place-map`.
- **커밋 prefix 는 `[FE]`** (문서만 바꾸는 태스크 8 은 `[DOCS]`). 타입은 `feat` / `fix` / `refactor` / `docs` / `test`.
- **테스트는 node 환경 + `renderToStaticMarkup` 문자열 assertion 이다.** jsdom·testing-library 를 도입하지 않는다 (`docs/testing-guide.md` §1).
- **컴포넌트 `className` 으로 외형(색·radius·shadow·padding)을 덮지 않는다.** 레이아웃 유틸리티만 (`docs/component-guide.md` §3).
- **문구는 `src/lib/messages/*` 에만 둔다.** JSX 에 한국어 리터럴을 넣지 않는다.
- **`exactOptionalPropertyTypes` 가 켜져 있다.** 감싸는 컴포넌트가 자기 optional prop 을 그대로 넘겨야 하는 자리는 `?:` 가 아니라 `prop?: T | undefined` 로 쓴다 (`BackLink.className` 이 선례다).
- **`aria-label` 에 장소 제목을 넣는다.** 한 화면에 같은 낱말의 컨트롤이 여러 개다.
- 각 태스크 끝의 검증 명령은 **그 태스크의 테스트 파일만** 돌린다. 전체 `pnpm verify` 는 태스크 7 과 9 에서 돈다.

### 새로 추가하는 문구 (태스크 3 에서 한 번에 넣는다)

`src/lib/messages/map.ts` 의 `mapMessages` 에 두 개만 추가한다. 나머지는 **전부 기존 키를 쓴다.**

| 키 | 값 |
| --- | --- |
| `rowDetail` | `'상세'` |
| `rowDetailLabel` | `'{title} 상세 보기'` |

---

## File Structure

| 파일 | 책임 | 태스크 |
| --- | --- | --- |
| `src/lib/url/view-mode.ts` | 보기 모드 URL 직렬화. `PLAN_ADD_DEFAULT_VIEW` 추가 | 1 |
| `src/lib/url/view-mode.test.ts` | 위 순수 로직 | 1 |
| `src/features/plan/plan-add-place-view.tsx` | 담기 화면의 두 보기 분기 · 담기 액션 · 상태 분기 | 2, 6 |
| `src/lib/messages/map.ts` | 지도 문구 | 3 |
| `src/features/place/place-map-panel.tsx` | 지도 패널·시트의 행. 선택 버튼 / 액션 열 / 알림 줄 | 3 |
| `src/features/place/place-map-panel.test.ts` | 위 렌더 분기 | 3 |
| `src/features/place/place-map-view.tsx` | 지도 상태의 유일한 주인. `fill` + slot props | 4 |
| `app/(main)/places/(list)/page.tsx` | `/places` 호출부 갱신 | 4 |
| `src/features/plan/plan-add-place-header.tsx` | **신규.** 담기 화면 헤더 (뒤로 · h1 · 부제 · 토글) | 5 |
| `app/(main)/plans/[planId]/days/[day]/add/page.tsx` | `view` 파싱 + 지도/목록 갈래 | 6 |
| `src/features/plan/plan-add-place-map.test.ts` | **신규.** 담기 액션·알림·폴백 렌더 분기 | 6 |
| `src/features/plan/plan-add-place.test.ts` | 담기 후 이동 안 함 회귀 고정 | 2 |
| `docs/features/plan/일자편집-세부명세.md` | F5 표 396행 개정 | 8 |
| `docs/features/_index.md`, `docs/screen-inventory.md` | 상태 갱신 | 8 |

**의존 순서:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. 1·2·3 은 서로 독립이라 순서를 바꿔도 되지만 4 는 3 을, 6 은 1·4·5 를 필요로 한다.

---

## Task 1: `PLAN_ADD_DEFAULT_VIEW` 상수

담기 화면의 기본 보기를 지도로 정한다. **값은 `PLACES_DEFAULT_VIEW` 와 같지만 상수를 따로 둔다** — `view-mode.ts` 가 이미 *"화면이 자기 기본값을 갖는다"* 를 규약으로 적어 뒀고, 긴급 시설이 목록으로 남은 것이 그 규약의 존재 이유다.

**Files:**
- Modify: `src/lib/url/view-mode.ts` (`PLACES_DEFAULT_VIEW` 선언 바로 아래)
- Test: `src/lib/url/view-mode.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `export const PLAN_ADD_DEFAULT_VIEW: ViewMode` — 태스크 6 의 `add/page.tsx` 가 `parseViewMode` · `viewModeHref` 양쪽에 넘긴다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/url/view-mode.test.ts` 끝에 추가한다. import 줄에 `PLAN_ADD_DEFAULT_VIEW` 를 더한다.

```ts
describe('PLAN_ADD_DEFAULT_VIEW — 담기 화면의 기본 보기', () => {
  it('지도다 — /places 와 같은 이유로 "어디쯤인지" 에 먼저 답한다', () => {
    expect(PLAN_ADD_DEFAULT_VIEW).toBe('map')
  })

  it('값이 없으면 지도로 떨어진다', () => {
    expect(parseViewMode({}, PLAN_ADD_DEFAULT_VIEW)).toBe('map')
  })

  it('잘못된 값도 지도로 떨어진다 — 예외를 던지지 않는다', () => {
    expect(parseViewMode({ view: 'grid' }, PLAN_ADD_DEFAULT_VIEW)).toBe('map')
  })

  it('기본값이 지도라 목록 링크에만 ?view=list 가 붙는다', () => {
    const path = '/plans/1/days/2/add'

    expect(viewModeHref(path, '', 'map', PLAN_ADD_DEFAULT_VIEW)).toBe(path)
    expect(viewModeHref(path, '', 'list', PLAN_ADD_DEFAULT_VIEW)).toBe(`${path}?view=list`)
  })

  it('보기를 바꿔도 필터 쿼리가 남는다', () => {
    const href = viewModeHref('/plans/1/days/2/add', 'indoor=true', 'list', PLAN_ADD_DEFAULT_VIEW)

    expect(href).toContain('indoor=true')
    expect(href).toContain('view=list')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run src/lib/url/view-mode.test.ts
```

Expected: FAIL — `PLAN_ADD_DEFAULT_VIEW` 를 `@/lib/url/view-mode` 에서 export 하지 않는다는 타입/런타임 오류.

- [ ] **Step 3: 상수를 추가한다**

`src/lib/url/view-mode.ts` 의 `PLACES_DEFAULT_VIEW` 선언 아래에 붙인다.

```ts
/**
 * 장소 담기(`/plans/[planId]/days/[day]/add`)의 기본 보기도 **지도**다 (#370).
 *
 * 장소를 고르는 행위가 `/places` 와 같은데 한쪽만 목록이면, 담기 화면에서만 위치 감각을
 * 잃는다 — 그날 담은 다른 곳과 얼마나 떨어져 있는지가 하루 동선의 전부다.
 *
 * **`PLACES_DEFAULT_VIEW` 를 그대로 쓰지 않는다.** 값은 지금 같지만 이 파일의 규약이
 * "화면이 자기 기본값을 갖는다" 이고, 긴급 시설이 목록으로 남은 것이 그 규약의 존재
 * 이유다. 한 상수를 두 화면이 나눠 쓰면 한쪽 기본값을 바꿀 때 다른 쪽이 따라 움직인다.
 */
export const PLAN_ADD_DEFAULT_VIEW: ViewMode = 'map'
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm vitest run src/lib/url/view-mode.test.ts
```

Expected: PASS (기존 케이스 포함 전부).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/url/view-mode.ts src/lib/url/view-mode.test.ts
git commit -m "[FE] feat: 담기 화면의 기본 보기를 지도로 정하는 상수를 둔다"
```

---

## Task 2: 담기에 성공해도 화면에 남는다

**일자편집 명세 F5(396행)를 뒤집는 태스크다.** 지도에서 하루 동선을 짜려면 여러 곳을 연달아 담아야 하는데, 담자마자 그 일자로 이동하면 어느 보기에서도 불가능하다. 목록 보기도 함께 바꾼다 — 두 보기가 다르게 행동하면 이 이슈가 고치려는 바로 그 불일치를 새로 만든다.

**`usePlanAddPlace` 훅 내부는 손대지 않는다.** 토스트 · `planKeys.detail` 교체 · 판정 무효화가 이미 전부 있고, `onAdded` 는 optional 이라 넘기지 않으면 그만이다.

**Files:**
- Modify: `src/features/plan/plan-add-place-view.tsx` (`usePlanAddPlace` 호출부와 `useRouter` 사용처)
- Test: `src/features/plan/plan-add-place.test.ts`

**Interfaces:**
- Consumes: `usePlanAddPlace({ planId, onAdded? })` — `onAdded` 를 넘기지 않는다
- Produces: 없음 (동작 변경)

- [ ] **Step 1: 회귀를 고정하는 테스트를 쓴다**

`src/features/plan/plan-add-place.test.ts` 끝에 추가한다. `usePlanAddPlace` 는 훅이라 node 렌더로 부를 수 없으므로 **호출부 소스를 읽어 계약을 고정한다** — 이 저장소가 라우팅 부작용을 확인하는 유일한 방법이다.

```ts
import { readFileSync } from 'node:fs'

describe('담기 성공 후 화면에 남는다 (#370)', () => {
  const source = readFileSync('src/features/plan/plan-add-place-view.tsx', 'utf8')

  /*
    일자편집 명세 F5(396행)는 원래 "그 일자로 replace 이동" 이었다. #370 이 뒤집었다 —
    지도에서 여러 곳을 연달아 담으려면 화면에 남아야 한다. 피드백은 토스트와
    "이미 담았어요" 이고, 돌아가기는 헤더의 BackLink 다.
  */
  it('onAdded 콜백을 넘기지 않는다 — 담자마자 나가면 연달아 담을 수 없다', () => {
    expect(source).not.toContain('onAdded')
  })

  it('담기 경로에서 일정 상세로 replace 하지 않는다', () => {
    expect(source).not.toContain('router.replace(`/plans/${planId}#')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run src/features/plan/plan-add-place.test.ts
```

Expected: FAIL — 두 케이스 모두. 현재 소스에 `onAdded:` 와 `router.replace(\`/plans/${planId}#...\`)` 가 있다.

- [ ] **Step 3: 호출부에서 `onAdded` 를 걷어낸다**

`plan-add-place-view.tsx` 의 `usePlanAddPlace` 호출을 이렇게 바꾼다. 주석이 왜 바뀌었는지를 남긴다.

```tsx
  /*
    **담기에 성공해도 화면에 남는다** (#370). 원래는 그 일자로 `replace` 이동했는데
    (일자편집 명세 F5), 지도 보기에서 하루 동선을 짜려면 여러 곳을 연달아 담아야 해서
    담자마자 나가면 지도로 바꾼 의미가 없다.

    **피드백이 사라지지는 않는다.** `usePlanAddPlace` 가 토스트를 띄우고, 응답이
    `planKeys.detail` 을 갈아끼우므로 그 행이 곧바로 `이미 담았어요` 로 바뀐다.
    돌아가기는 헤더의 `일정으로 돌아가기` 가 맡는다.
  */
  const addPlace = usePlanAddPlace({ planId })
```

`router` 는 `onResetFilters` 가 계속 쓰므로 **`useRouter` 는 남긴다.**

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm vitest run src/features/plan/plan-add-place.test.ts
pnpm typecheck
```

Expected: 테스트 PASS, 타입 오류 없음 (`onAdded` 가 optional 이라 인자 하나만 넘겨도 된다).

- [ ] **Step 5: 커밋**

```bash
git add src/features/plan/plan-add-place-view.tsx src/features/plan/plan-add-place.test.ts
git commit -m "[FE] fix: 장소를 담아도 담기 화면에 남아 연달아 담을 수 있게 한다"
```

---

## Task 3: 지도 패널 행을 선택 버튼 / 액션 열 / 알림 줄로 가른다

**기존 결함을 고치는 태스크다.** 지금 행은 `<button>` 인데 그 안에서 `PlaceRowContent` 가 `titleHref` 로 `<a>` 를 렌더한다 — button 의 content model 은 대화형 요소를 허용하지 않는다. 여기에 담기 버튼까지 더하면 button 안에 a + button 이 된다.

**`/places` 지도 패널도 함께 바뀐다.** 제목이 더 이상 링크가 아니고 액션 열에 `상세` 링크가 생긴다.

**Files:**
- Modify: `src/lib/messages/map.ts` (`rowDetail` · `rowDetailLabel` 추가)
- Modify: `src/features/place/place-map-panel.tsx` (전면 재작성)
- Test: `src/features/place/place-map-panel.test.ts`

**Interfaces:**
- Consumes: `PlaceRowContent({ place, titleHref? })` · `PlaceSummary`
- Produces: `PlaceMapPanel` 이 두 prop 을 더 받는다 — 태스크 4 가 `PlaceMapView` 에서 그대로 통과시킨다

```ts
renderRowAction?: ((place: PlaceSummary) => ReactNode) | undefined
renderRowNotice?: ((place: PlaceSummary) => ReactNode) | undefined
```

- [ ] **Step 1: 문구 두 개를 넣는다**

`src/lib/messages/map.ts` 의 `// ── 액션 ──` 절에 추가한다.

```ts
  /**
   * 지도 패널 행에서 장소 상세로. **선택 버튼 밖**에 둔다 — `<button>` 안에 링크를
   * 넣을 수 없다. 행을 누르는 것은 "이동" 이 아니라 "이 핀 고르기" 라 행 전체를 링크로
   * 만들 수도 없어서, 상세로 가는 길만 액션 열로 내보냈다.
   */
  rowDetail: '상세',
  /** 한 화면에 여러 개라 보이는 글자만으로는 전부 "상세" 로 읽힌다 */
  rowDetailLabel: '{title} 상세 보기',
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/features/place/place-map-panel.test.ts` — 기존 `render()` 헬퍼는 그대로 두고, **"제목은 링크로 남긴다" 케이스의 이름과 뜻을 고치고** 아래 케이스를 더한다.

```ts
  it('상세로 가는 길이 사라지지 않는다 — 제목 대신 액션 열 링크다', () => {
    expect(render()).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('선택 버튼 안에 대화형 요소가 없다 — button 안의 a 는 명세 위반이다', () => {
    const markup = render()
    const selectButton = markup.slice(markup.indexOf('<button'), markup.indexOf('</button>'))

    expect(selectButton).not.toContain('<a ')
    expect(selectButton).not.toContain('href=')
  })

  it('상세 링크가 어느 장소인지 말한다', () => {
    expect(render()).toContain(
      `aria-label="${messages.map.rowDetailLabel.replace('{title}', placeSummary.title)}"`,
    )
  })

  it('renderRowAction 을 액션 열에 그린다 — 담기 버튼이 여기 온다', () => {
    const markup = render({
      renderRowAction: () => createElement('button', { type: 'button' }, '담기'),
    })

    expect(markup).toContain('담기')
    expect(markup).toContain('w-24')
  })

  it('액션이 없어도 열 자체는 있다 — /places 는 상세 링크만 든다', () => {
    expect(render()).toContain('w-24')
  })

  it('renderRowNotice 는 행 아래 전폭이다 — 액션 열은 w-24 라 알림이 못 들어간다', () => {
    const markup = render({
      renderRowNotice: () => createElement('p', { role: 'alert' }, '담지 못했어요'),
    })

    expect(markup).toContain('role="alert"')
    // 알림은 액션 열(w-24) 안이 아니라 그 뒤에 온다
    expect(markup.indexOf('role="alert"')).toBeGreaterThan(markup.indexOf('w-24'))
  })
```

- [ ] **Step 3: 실패를 확인한다**

```bash
pnpm vitest run src/features/place/place-map-panel.test.ts
```

Expected: FAIL — `w-24` 없음, `renderRowAction` 이 prop 이 아님, 선택 버튼 안에 `href=` 가 있음.

- [ ] **Step 4: `PlaceMapPanel` 을 다시 쓴다**

`src/features/place/place-map-panel.tsx` 전체를 아래로 바꾼다.

```tsx
'use client'

import Link from 'next/link'

import type { ReactNode } from 'react'

import { PlaceRowContent } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { PlaceSummary } from '@/types/place'

/**
 * 지도 옆(데스크톱) · 시트 안(모바일)의 목록.
 *
 * 아트보드 05: **행 마크업은 모바일과 동일하다.** 그래서 행 내용을 다시 만들지 않고
 * `PlaceRowContent` 를 가져온다.
 *
 * **행을 누르는 것은 "이동" 이 아니라 "이 핀 고르기" 다** — 링크로 두면 지도를 잃는다.
 *
 * **상세로 가는 길은 액션 열의 링크다** (#370). 예전에는 제목을 링크로 만들었는데
 * 그 제목이 선택 `<button>` **안**에 있었다 — `<button>` 의 content model 은 대화형
 * 요소를 허용하지 않는다. 담기 버튼까지 얹으면 button 안에 a + button 이 된다.
 * 그래서 선택 버튼은 내용만 감싸고, 링크와 액션은 그 **형제**인 열로 내보냈다.
 */
export function PlaceMapPanel({
  places,
  selectedId,
  onSelect,
  renderRowAction,
  renderRowNotice,
  className,
}: {
  places: PlaceSummary[]
  selectedId: string | null
  onSelect: (placeId: string) => void
  /**
   * 액션 열에 얹을 것. 담기 화면이 `담기` 버튼 / `이미 담았어요` 를 준다.
   *
   * `?:` 가 아니라 `| undefined` 인 이유는 `exactOptionalPropertyTypes` 다 —
   * `PlaceMapView` 가 자기 optional prop 을 그대로 넘겨야 한다.
   */
  renderRowAction?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 행 **아래** 전폭 줄. 담기 실패 알림이 여기 온다 — 액션 열은 w-24 라 안 들어간다 */
  renderRowNotice?: ((place: PlaceSummary) => ReactNode) | undefined
  className?: string
}) {
  return (
    <ul className={cn('divide-border divide-y', className)}>
      {places.map((place) => {
        const selected = place.placeId === selectedId

        return (
          <li
            key={place.placeId}
            className={cn(
              // 선택 배경은 --row-selected 다. 판정 색(metric-*)을 쓰지 않는다 —
              // 지도 마커의 검정 채움과 짝을 이뤄 "같은 것" 을 가리킨다 (아트보드 05)
              //
              // **행 전체(li)에 칠한다.** 선택 버튼에만 칠하면 액션 열이 빠져
              // 한 행이 두 조각으로 보인다
              selected ? 'bg-row-selected' : 'hover:bg-bg-sunken',
            )}
          >
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => onSelect(place.placeId)}
                aria-pressed={selected}
                className="focus-visible:ring-brand-500 @container flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                {/* `titleHref` 를 주지 않는다 — 이 버튼 안에 링크를 넣을 수 없다 */}
                <PlaceRowContent place={place} />
              </button>

              {/*
                **w-24 고정이고 세로로 쌓는다.** 96px 에 `상세`(44)와 `담기`(44)를 나란히
                두면 둘 다 최소 터치 영역을 못 지킨다. 세로면 88px 이라 들어간다.
                폭은 목록 화면의 `PlanAddPlaceRow` 와 같아야 두 보기의 행이 같은 축에서
                끝난다.
              */}
              <div className="flex w-24 shrink-0 flex-col items-end justify-center gap-1 py-3 pr-4">
                <Link
                  href={`/places/${place.placeId}`}
                  aria-label={messages.map.rowDetailLabel.replace('{title}', place.title)}
                  className="text-caption text-link hover:text-link-hover focus-visible:ring-brand-500 flex h-11 items-center rounded-md px-1 font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {messages.map.rowDetail}
                </Link>

                {renderRowAction?.(place)}
              </div>
            </div>

            {place.lat === null || place.lng === null ? (
              <p className="text-caption text-fg-subtle px-4 pb-3 font-medium">
                {messages.map.noCoordinate}
              </p>
            ) : null}

            {renderRowNotice?.(place)}
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 5: 통과를 확인한다**

```bash
pnpm vitest run src/features/place/place-map-panel.test.ts
pnpm typecheck
```

Expected: PASS — 새 6개 + 기존 4개(`aria-pressed` 2종 · 선택 배경 · 좌표 없음 2종).

- [ ] **Step 6: 커밋**

```bash
git add src/lib/messages/map.ts src/features/place/place-map-panel.tsx src/features/place/place-map-panel.test.ts
git commit -m "[FE] fix: 지도 패널 행의 button 안 링크 중첩을 풀고 액션 열을 낸다"
```

---

## Task 4: `PlaceMapView` 에 `fill` 과 slot props 를 뚫는다

지도 상태의 유일한 주인은 그대로 두고, 두 화면이 다른 부분만 밖에서 받는다. **전부 place 어휘다** — plan 을 모른다.

**Files:**
- Modify: `src/features/place/place-map-view.tsx`
- Modify: `app/(main)/places/(list)/page.tsx` (호출부)

**Interfaces:**
- Consumes: 태스크 3 의 `PlaceMapPanel({ renderRowAction?, renderRowNotice? })`
- Produces: 태스크 6 이 쓰는 `PlaceMapView` 의 새 인터페이스

```ts
type PlaceMapViewProps = {
  filters: PlaceFilters
  authed: boolean
  fill?: boolean
  listHref?: string
  mapHref?: string
  renderRowAction?: ((place: PlaceSummary) => ReactNode) | undefined
  renderRowNotice?: ((place: PlaceSummary) => ReactNode) | undefined
  mutedPlaceIds?: ReadonlySet<string> | undefined
  renderListRow?: PlaceListSectionProps['renderRow'] | undefined
}
```

- [ ] **Step 1: props 를 바꾸고 `filterQuery` 를 걷어낸다**

`place-map-view.tsx` 의 시그니처를 아래로 바꾼다. `filterQuery` prop 을 **삭제**한다 — 오직 `viewModeHref('/places', …)` 를 만들려고 있었다.

```tsx
export function PlaceMapView({
  filters,
  authed,
  fill = false,
  listHref,
  mapHref,
  renderRowAction,
  renderRowNotice,
  mutedPlaceIds,
  renderListRow,
}: {
  filters: PlaceFilters
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 필터의 크기 축이 빠진다 (#200) */
  authed: boolean
  /**
   * `true` 면 **부모가 높이를 정한다.** 위에 헤더가 붙는 화면(담기, #370)이 쓴다.
   * `false`(기본)면 스스로 `map-canvas-height` 로 뷰포트를 채운다.
   */
  fill?: boolean
  /**
   * 지도 우상단에 떠 있는 보기 전환의 목적지. **둘 다 있어야 토글을 그린다.**
   * 헤더가 토글을 갖는 화면은 주지 않는다 — 같은 컨트롤이 두 개 뜨면 안 된다.
   *
   * 예전에는 이 컴포넌트가 `'/places'` 를 하드코딩해 링크를 만들었다. 그래서 다른
   * 화면이 이 지도를 쓰면 토글이 남의 화면으로 보냈다 (#370).
   */
  listHref?: string
  mapHref?: string
  /** 패널·시트 행의 액션 열. 담기 버튼이 여기 온다 */
  renderRowAction?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 행 아래 전폭 줄. 담기 실패 알림이 여기 온다 */
  renderRowNotice?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 핀 톤을 낮출 장소들. 담기 화면은 "이미 담은 곳" 을 넘긴다 */
  mutedPlaceIds?: ReadonlySet<string> | undefined
  /** SDK 실패 폴백의 행. 주지 않으면 상세로 가는 기본 행이다 */
  renderListRow?: PlaceListSectionProps['renderRow'] | undefined
}) {
```

`PlaceListSectionProps` 를 타입 import 에 더한다.

```tsx
import { PlaceListSection, type PlaceListSectionProps } from '@/features/place/place-list-section'
```

`viewModeHref` · `PLACES_DEFAULT_VIEW` import 와 함수 안의 `listHref`/`mapHref` 계산 두 줄을 **삭제**한다.

- [ ] **Step 2: 핀에 `muted` 를 얹는다**

`pins` 계산을 바꾼다.

```tsx
  const pins: MapPin[] = useMemo(
    () =>
      visible.map((place) => ({
        id: place.placeId,
        title: place.title,
        lat: place.lat,
        lng: place.lng,
        /*
          **이미 담은 곳은 톤을 낮춘다** (#370). 훑어볼 때 항상 보이는 채널이 이것뿐이다 —
          `caption` 은 선택됐을 때만 라벨에 붙고, `MapCanvas` 는 마커에 판정 색을 쓰지
          않는다는 규약이 있다. 긴급 시설의 약국이 쓰던 표현을 그대로 재사용한다.
        */
        muted: mutedPlaceIds?.has(place.placeId) ?? false,
      })),
    [visible, mutedPlaceIds],
  )
```

- [ ] **Step 3: SDK 실패 폴백에 행을 통과시킨다**

`if (failure !== null)` 블록의 `PlaceListSection` 에 한 줄을 더한다.

```tsx
        <PlaceListSection
          places={listPlaces}
          loading={listQuery.isPending}
          errorStatus={toErrorStatus(listQuery.error)}
          errorMessage={
            listQuery.error instanceof ApiError ? listQuery.error.rawMessage : undefined
          }
          hasNext={listQuery.data?.pages.at(-1)?.hasNext ?? false}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onRetry={() => void listQuery.refetch()}
          onResetFilters={() => undefined}
          {...(renderListRow === undefined ? {} : { renderRow: renderListRow })}
        />
```

> 전개 형태인 이유는 `exactOptionalPropertyTypes` 다. `renderRow={renderListRow}` 로 쓰면 `undefined` 를 명시적으로 넘기는 것이 되어 기본값이 안 먹는다.

**이 한 줄이 없으면 지도가 안 뜨는 사용자에게 담기 화면이 열람 전용이 된다.**

- [ ] **Step 4: 루트를 flex 컬럼으로 바꾸고 토글을 조건부로 만든다**

성공 갈래의 `return` 을 바꾼다.

```tsx
  const countLine = messages.map.visibleCount.replace('{n}', String(visible.length))
  /** 둘 다 있을 때만 그린다 — 헤더가 토글을 갖는 화면은 주지 않는다 */
  const showToggle = listHref !== undefined && mapHref !== undefined

  return (
    /*
      **높이를 여기서 잡는다.** `map-canvas-height` 는 뷰포트를 정확히 다 쓰므로
      (`calc(100dvh - --header-h - --tabbar-h)`), 캔버스에 걸어 둔 채 위에 헤더를 얹으면
      그 높이만큼 넘쳐 지도 화면에 세로 스크롤이 난다. `fill` 이면 부모가 정한 높이를
      채우고, 아니면 예전처럼 스스로 뷰포트를 채운다 — `/places` 는 픽셀이 같다.
    */
    <div className={cn('relative', fill ? 'h-full' : 'map-canvas-height')}>
      <MapCanvas
        pins={pins}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onBoundsChange={handleBounds}
        center={center}
        selectedLevel={SELECTED_PLACE_MAP_LEVEL}
        onFailure={setFailure}
        className="h-full w-full"
      />

      <div className="absolute top-5 right-4 z-30 flex flex-col items-end gap-2 md:right-10 lg:top-6">
        {showToggle && (
          <ViewToggle
            current="map"
            listHref={listHref}
            mapHref={mapHref}
            variant="icon"
            className="shadow-md"
          />
        )}

        {inJeju && <MapLocateButton onLocate={locate} />}
      </div>

      {/* …좌측 패널 · MapSheet 는 그대로… */}
    </div>
  )
```

> 우상단 스택은 토글이 없어도 남긴다 — `MapLocateButton` 이 같은 자리를 쓴다.

- [ ] **Step 5: 패널과 시트의 `PlaceMapPanel` 두 곳에 slot 을 통과시킨다**

데스크톱 패널과 `MapSheet` 안, **두 군데 모두** 같은 두 줄을 더한다.

```tsx
                  <PlaceMapPanel
                    places={visible}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    renderRowAction={renderRowAction}
                    renderRowNotice={renderRowNotice}
                  />
```

- [ ] **Step 6: `/places` 호출부를 고친다**

`app/(main)/places/(list)/page.tsx` 의 지도 갈래를 바꾼다. `listHref`·`mapHref` 는 **이미 위에서 계산돼 있다** — 목록 갈래의 `ViewToggle` 이 쓰던 것을 그대로 넘긴다.

```tsx
  if (view === 'map') {
    return (
      <main id="main-content">
        <h1 className="sr-only">{messages.place.pageTitle}</h1>
        <HydrationBoundary state={dehydrate(queryClient)}>
          {/* 보기 전환 링크를 페이지가 만든다 — 지도 컴포넌트가 '/places' 를 알 이유가 없다 */}
          <PlaceMapView
            filters={filters}
            authed={authed}
            listHref={listHref}
            mapHref={mapHref}
          />
        </HydrationBoundary>
      </main>
    )
  }
```

- [ ] **Step 7: 타입과 기존 테스트를 확인한다**

```bash
pnpm typecheck
pnpm vitest run src/features/place
```

Expected: 타입 오류 없음. `filterQuery` 를 지웠으므로 다른 호출부가 있으면 여기서 잡힌다 — 있으면 그 호출부도 `listHref`/`mapHref` 로 고친다.

- [ ] **Step 8: 커밋**

```bash
git add src/features/place/place-map-view.tsx "app/(main)/places/(list)/page.tsx"
git commit -m "[FE] refactor: 지도 뷰가 높이·보기전환·행 액션을 밖에서 받게 한다"
```

---

## Task 5: `PlanAddPlaceHeader` 를 뽑는다

동작을 바꾸지 않는 순수 추출이다. 두 보기가 같은 헤더를 써야 하는데 지금은 `PlanAddPlaceShell` 안에 박혀 있다.

**Files:**
- Create: `src/features/plan/plan-add-place-header.tsx`
- Modify: `src/features/plan/plan-add-place-view.tsx` (`PlanAddPlaceShell` 이 새 컴포넌트를 쓰게)

**Interfaces:**
- Consumes: `BackLink({ href, label, className? })` · `ViewToggle({ current, listHref, mapHref, variant?, className? })`
- Produces: 태스크 6 이 지도 갈래에서 직접 쓴다

```ts
function PlanAddPlaceHeader(props: {
  day: number
  backHref: string
  planTitle?: string | undefined
  listHref: string
  mapHref: string
  view: ViewMode
}): ReactElement
```

- [ ] **Step 1: 파일을 만든다**

`src/features/plan/plan-add-place-header.tsx`:

```tsx
import { BackLink } from '@/components/back-link'
import { ViewToggle } from '@/components/view-toggle'
import { messages } from '@/lib/messages'
import type { ViewMode } from '@/lib/url/view-mode'

/**
 * 담기 화면의 머리 — 뒤로가기 · `h1` · 부제 · 보기 전환.
 *
 * **두 보기가 같은 것을 쓴다** (#370). 목록에서는 본문 위에, 지도에서는 지도 위에 선다.
 *
 * **지도 보기에서도 `sr-only` 로 숨기지 않는다.** `/places` 지도는 전역 nav 로 나갈 수
 * 있지만 이 화면의 퇴로는 `일정으로 돌아가기` 뿐이다 — 접히는 패널이나 시트 안에
 * 숨으면 돌아갈 길이 사라진다.
 *
 * **오류·빈 상태에도 `h1` 이 있어야 한다.** 없으면 문서의 최상위 제목이 필터의
 * `h2 "필터"` 가 되어 스크린리더 사용자가 무슨 화면인지 알 수 없다 (실측으로 잡았다).
 */
export function PlanAddPlaceHeader({
  day,
  backHref,
  planTitle,
  listHref,
  mapHref,
  view,
}: {
  day: number
  backHref: string
  /** 아직 못 받았으면 생략한다 — 제목은 `day` 만으로 쓸 수 있다 */
  planTitle?: string | undefined
  listHref: string
  mapHref: string
  view: ViewMode
}) {
  const subtitle = messages.plan.addPlaceSubtitle.replace('{day}', String(day))

  return (
    <header className="px-4 pt-5 pb-3 md:px-10 lg:pt-6">
      <BackLink href={backHref} label={messages.plan.addPlaceBack} className="-ml-1" />

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-title-1 text-fg lg:text-display mt-1 font-bold lg:font-extrabold">
          {messages.plan.addPlaceTitle.replace('{day}', String(day))}
        </h1>
        {/* 네 화면이 같은 세그먼트 컨트롤을 쓴다 — 아트보드 05 마지막 단락 */}
        <ViewToggle current={view} listHref={listHref} mapHref={mapHref} variant="icon" />
      </div>

      <p className="text-caption text-fg-muted mt-1 font-medium">
        {planTitle === undefined ? subtitle : `${planTitle} · ${subtitle}`}
      </p>
    </header>
  )
}
```

- [ ] **Step 2: `PlanAddPlaceShell` 이 그것을 쓰게 한다**

`plan-add-place-view.tsx` 하단의 `PlanAddPlaceShell` 에서 `<header>…</header>` 블록을 지우고 `PlanAddPlaceHeader` 호출로 바꾼다. shell 은 `listHref`·`mapHref`·`view` 를 받아 그대로 넘긴다.

```tsx
function PlanAddPlaceShell({
  day,
  backHref,
  planTitle,
  listHref,
  mapHref,
  view,
  children,
}: {
  day: number
  backHref: string
  planTitle?: string | undefined
  listHref: string
  mapHref: string
  view: ViewMode
  children: ReactNode
}) {
  return (
    <>
      <PlanAddPlaceHeader
        day={day}
        backHref={backHref}
        planTitle={planTitle}
        listHref={listHref}
        mapHref={mapHref}
        view={view}
      />
      {children}
    </>
  )
}
```

`PlanAddPlaceView` 의 모든 `<PlanAddPlaceShell …>` 호출 **5곳**(pending · 400 · 5xx · 기간 밖 · 성공)에 `listHref`·`mapHref`·`view` 를 더한다. 이 값들은 태스크 6 에서 props 로 들어오므로 지금은 컴포넌트 시그니처에 세 개를 추가해 그대로 통과시킨다.

- [ ] **Step 3: 타입과 테스트를 확인한다**

```bash
pnpm typecheck
pnpm vitest run src/features/plan
```

Expected: 타입 오류 없음, 기존 테스트 전부 PASS. **동작은 아직 바뀌지 않는다** — 목록 보기에 토글이 하나 생길 뿐이고 지도 갈래는 태스크 6 이 붙인다.

- [ ] **Step 4: 커밋**

```bash
git add src/features/plan/plan-add-place-header.tsx src/features/plan/plan-add-place-view.tsx
git commit -m "[FE] refactor: 담기 화면 헤더를 뽑아 두 보기가 나눠 쓰게 한다"
```

---

## Task 6: 담기 화면에 지도 갈래를 붙인다

**Files:**
- Modify: `app/(main)/plans/[planId]/days/[day]/add/page.tsx`
- Modify: `src/features/plan/plan-add-place-view.tsx`
- Test: `src/features/plan/plan-add-place-map.test.ts` (신규)

**Interfaces:**
- Consumes: 태스크 1 의 `PLAN_ADD_DEFAULT_VIEW` · 태스크 4 의 `PlaceMapView` · 태스크 5 의 `PlanAddPlaceHeader`
- Produces: 없음 (화면 완성)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/plan/plan-add-place-map.test.ts` 를 만든다. `PlanAddPlaceView` 는 훅을 쓰므로 node 렌더로 못 부른다 — **담기 액션을 만드는 순수 함수를 따로 두고 그것을 테스트한다.** 이 저장소가 훅이 낀 화면을 덮는 방식이다.

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'

/** 명세: docs/features/plan/담기지도-세부명세.md (이슈 #370) */

function renderPanel(overrides: Partial<Parameters<typeof PlaceMapPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlaceMapPanel, {
      places: [placeSummary],
      selectedId: null,
      onSelect: () => undefined,
      ...overrides,
    }),
  )
}

const BASE = {
  addedPlaceIds: new Set<string>(),
  pendingPlaceId: null,
  disabled: false,
  failure: null,
  onAdd: () => undefined,
}

describe('지도 패널의 담기 액션', () => {
  it('아직 안 담은 곳에는 담기 버튼이 붙는다', () => {
    const markup = renderPanel({ renderRowAction: (place) => planAddPlaceAction(place, BASE) })

    expect(markup).toContain(messages.plan.addPlaceShort)
    expect(markup).toContain(
      `aria-label="${messages.plan.addPlaceLabel.replace('{title}', placeSummary.title)}"`,
    )
  })

  it('이미 담긴 곳은 버튼 대신 이유가 남는다 — 서버는 중복을 막지 않는다', () => {
    const markup = renderPanel({
      renderRowAction: (place) =>
        planAddPlaceAction(place, { ...BASE, addedPlaceIds: new Set([placeSummary.placeId]) }),
    })

    expect(markup).toContain(messages.plan.addPlaceAlready)
    expect(markup).not.toContain(messages.plan.addPlaceShort)
  })

  it('담는 중인 행만 진행 표시를 낸다', () => {
    const pending = renderPanel({
      renderRowAction: (place) =>
        planAddPlaceAction(place, { ...BASE, pendingPlaceId: placeSummary.placeId }),
    })

    expect(pending).toContain('aria-busy="true"')
  })

  it('다른 담기가 진행 중이면 잠긴다 — 일괄 교체는 동시에 두 개를 못 보낸다', () => {
    const markup = renderPanel({
      renderRowAction: (place) =>
        planAddPlaceAction(place, { ...BASE, disabled: true, pendingPlaceId: 'other' }),
    })

    expect(markup).toContain('disabled')
  })

  it('좌표가 없어도 담기 버튼은 붙는다 — 좌표는 담는 것과 무관하다', () => {
    const markup = renderPanel({
      renderRowAction: (place) => planAddPlaceAction(place, BASE),
    })

    expect(markup).toContain(messages.plan.addPlaceShort)
  })
})

describe('지도 패널의 담기 실패 알림', () => {
  it('실패는 그 행 아래에 남는다 — 헤더에 모으면 스크롤 아래에서 안 보인다', () => {
    const markup = renderPanel({
      renderRowNotice: (place) =>
        planAddPlaceNotice(place, {
          failure: {
            target: { day: 1, placeId: placeSummary.placeId },
            error: { message: messages.plan.addPlaceErrorDescription, retriable: true },
          },
        }),
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.addPlaceErrorTitle)
  })

  it('다른 행의 실패는 이 행에 붙지 않는다', () => {
    const markup = renderPanel({
      renderRowNotice: (place) =>
        planAddPlaceNotice(place, {
          failure: {
            target: { day: 1, placeId: 'other' },
            error: { message: messages.plan.addPlaceErrorDescription, retriable: true },
          },
        }),
    })

    expect(markup).not.toContain('role="alert"')
  })

  it('PLAN_004 는 재시도 제목을 붙이지 않는다 — 같은 본문이 같은 400 을 받는다', () => {
    const markup = renderPanel({
      renderRowNotice: (place) =>
        planAddPlaceNotice(place, {
          failure: {
            target: { day: 1, placeId: placeSummary.placeId },
            error: { message: messages.plan.addPlaceMissingPlaceError, retriable: false },
          },
        }),
    })

    expect(markup).toContain(messages.plan.addPlaceMissingPlaceError)
    expect(markup).not.toContain(messages.plan.addPlaceErrorTitle)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run src/features/plan/plan-add-place-map.test.ts
```

Expected: FAIL — `@/features/plan/plan-add-place-action` 모듈이 없다.

- [ ] **Step 3: 액션 슬롯 두 개를 순수 함수로 만든다**

`src/features/plan/plan-add-place-action.tsx` 를 만든다. **props 로만 받는 순수 함수라 node 환경에서 테스트할 수 있다** (`docs/testing-guide.md` §1).

```tsx
import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import type { PlanAddTarget } from '@/features/plan/use-plan-add-place'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import type { PlaceSummary } from '@/types/place'

/**
 * 지도 패널 행의 담기 액션과 실패 알림.
 *
 * **목록의 `PlanAddPlaceRow` 와 같은 동작·문구다.** 두 보기에서 같은 일을 하는데 글자가
 * 갈리면 안 된다. 행 마크업 자체는 `PlaceMapPanel` 이 갖고 있어 재사용할 수 없으므로,
 * 겹치는 것은 **액션 조각**뿐이라 그것만 여기로 모았다.
 *
 * **컴포넌트가 아니라 함수다.** `PlaceMapPanel` 의 `renderRowAction` 이 `ReactNode` 를
 * 받으므로 훅 없이 props 로만 도는 함수면 충분하고, 그래야 node 환경에서 문자열
 * assertion 으로 테스트할 수 있다.
 */
export function planAddPlaceAction(
  place: PlaceSummary,
  {
    addedPlaceIds,
    pendingPlaceId,
    disabled,
    onAdd,
  }: {
    /** **그 일자에** 이미 담긴 장소들. 서버가 중복을 막지 않아 화면이 막는다 (F5-4) */
    addedPlaceIds: ReadonlySet<string>
    pendingPlaceId: string | null
    /** 다른 담기가 진행 중 — 일괄 교체라 동시에 두 개를 보내면 하나가 진다 */
    disabled: boolean
    onAdd: (place: PlaceSummary) => void
  },
) {
  if (addedPlaceIds.has(place.placeId)) {
    return (
      <span className="text-caption text-fg-muted font-medium">
        {messages.plan.addPlaceAlready}
      </span>
    )
  }

  const pending = pendingPlaceId === place.placeId

  return (
    <Button
      variant="secondary"
      // 이 화면의 주 행동이라 44px 를 준다 — sm(32px)은 최소 터치 영역 미만이다
      size="md"
      loading={pending}
      disabled={disabled && !pending}
      aria-label={messages.plan.addPlaceLabel.replace('{title}', place.title)}
      onClick={() => onAdd(place)}
    >
      {messages.plan.addPlaceShort}
    </Button>
  )
}

/**
 * 실패는 **누른 그 자리**에 남는다 (F4). 화면 위쪽에 모아 두면 무한 스크롤 아래에서
 * 담다 실패했을 때 알림이 화면 밖이라 아무 일도 안 일어난 것처럼 보인다.
 */
export function planAddPlaceNotice(
  place: PlaceSummary,
  { failure }: { failure: { target: PlanAddTarget; error: PlanDaySaveError } | null },
) {
  if (failure === null || failure.target.placeId !== place.placeId) return null

  return (
    <FormAlert
      className="mx-4 mb-3"
      message={
        failure.error.retriable
          ? `${messages.plan.addPlaceErrorTitle} ${failure.error.message}`
          : failure.error.message
      }
    />
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm vitest run src/features/plan/plan-add-place-map.test.ts
```

Expected: PASS (8케이스).

- [ ] **Step 5: 페이지에서 `view` 를 파싱하고 갈래를 나눈다**

`app/(main)/plans/[planId]/days/[day]/add/page.tsx` — `filters` 계산 다음에 보기와 링크를 만들고, `return` 을 둘로 나눈다.

```tsx
  const resolved = await searchParams
  const filters = parsePlaceFilters(resolved)

  /*
    **이 화면의 기본 보기도 지도다** (`PLAN_ADD_DEFAULT_VIEW`, #370). 링크를 만드는 쪽과
    파싱하는 쪽에 **같은 기본값**을 넘겨야 한다 — 어긋나면 토글이 가리키는 보기와
    페이지가 그리는 보기가 달라진다.
  */
  const view = parseViewMode(resolved, PLAN_ADD_DEFAULT_VIEW)
  const basePath = `/plans/${planId}/days/${rawDay}/add`
  const filterQuery = toPlaceFilterQuery(filters)
  const listHref = viewModeHref(basePath, filterQuery, 'list', PLAN_ADD_DEFAULT_VIEW)
  const mapHref = viewModeHref(basePath, filterQuery, 'map', PLAN_ADD_DEFAULT_VIEW)
```

import 를 더한다.

```tsx
import { parsePlaceFilters, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { parseViewMode, PLAN_ADD_DEFAULT_VIEW, viewModeHref } from '@/lib/url/view-mode'
```

프리페치 두 개는 **그대로 둔다** — 지도 첫 화면도 목록 캐시를 재사용한다 (`architecture-guide.md` §9).

`return` 을 이렇게 나눈다.

```tsx
  /*
    **지도 보기는 레일 2단을 쓰지 않는다.** 280 레일을 함께 두면 지도가 세 번 접힌다
    (`places/(list)/page.tsx` 와 같은 판단). 필터는 패널·시트 머리가 맡고 URL 에 남아
    있으므로 목록으로 돌아가면 레일에 다시 보인다.
  */
  if (view === 'map') {
    return (
      <main id="main-content">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PlanAddPlaceView
            planId={planId}
            day={day}
            filters={filters}
            view="map"
            listHref={listHref}
            mapHref={mapHref}
          />
        </HydrationBoundary>
      </main>
    )
  }

  return (
    <main id="main-content" className="rail-layout rail-layout-filter">
      {/* 목록 화면과 같은 2단이다. 태블릿은 한 컬럼 — 280 레일을 더하면 768 을 넘는다 */}
      <div className="rail-sticky hidden lg:block">
        <PlaceFilterRail filters={filters} authed />
      </div>

      <div className="lg:border-border lg:border-l">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PlanAddPlaceView
            planId={planId}
            day={day}
            filters={filters}
            view="list"
            listHref={listHref}
            mapHref={mapHref}
          />
        </HydrationBoundary>
      </div>
    </main>
  )
```

- [ ] **Step 6: `PlanAddPlaceView` 에 지도 갈래를 붙인다**

시그니처에 세 개를 더한다.

```tsx
export function PlanAddPlaceView({
  planId,
  day,
  filters,
  view,
  listHref,
  mapHref,
}: {
  planId: string
  day: number
  filters: PlaceFilters
  view: ViewMode
  listHref: string
  mapHref: string
}) {
```

`onResetFilters` 를 고친다 — **지금 코드는 `?view=` 를 잃어 지도에서 목록으로 튄다.**

```tsx
  /** 필터만 비운다. **보기는 유지한다** — 지도에서 조건을 풀었는데 목록으로 튀면 안 된다 */
  const resetHref = viewModeHref(
    `/plans/${planId}/days/${String(day)}/add`,
    '',
    view,
    PLAN_ADD_DEFAULT_VIEW,
  )
```

`PlaceListSection` 의 `onResetFilters` 를 `() => router.replace(resetHref, { scroll: false })` 로 바꾼다.

성공 갈래(`addedPlaceIds` 계산 뒤)에 지도 분기를 넣는다. **`detail` 이 준비된 뒤에만 온다** — 앞의 pending·error·기간 밖 갈래가 이미 목록 껍데기로 처리했다.

```tsx
  const addedPlaceIds = placeIdsOf(group.items)

  const onAdd = (selected: PlaceSummary) =>
    addPlace.add({
      day,
      // **그 일자의 현재 항목 전부**를 되싣는다 — 일괄 교체다 (E1)
      dayItems: group.items,
      place: { placeId: selected.placeId, title: selected.title },
    })

  if (view === 'map') {
    return (
      /*
        **높이를 여기서 잡는다.** 헤더가 정상 흐름으로 서고 남는 높이를 지도가 채운다 —
        `PlaceMapView` 에 `map-canvas-height` 를 맡기면 헤더 높이만큼 넘쳐 지도 화면에
        세로 스크롤이 난다.
      */
      <div className="map-canvas-height flex flex-col">
        <PlanAddPlaceHeader
          day={day}
          backHref={backHref}
          planTitle={detail.data.title}
          listHref={listHref}
          mapHref={mapHref}
          view="map"
        />

        <div className="min-h-0 flex-1">
          <PlaceMapView
            filters={filters}
            authed
            fill
            /* 헤더가 토글을 가지므로 `listHref`/`mapHref` 를 주지 않는다 */
            mutedPlaceIds={addedPlaceIds}
            renderRowAction={(place) =>
              planAddPlaceAction(place, {
                addedPlaceIds,
                pendingPlaceId: addPlace.pending?.placeId ?? null,
                disabled: addPlace.adding,
                onAdd,
              })
            }
            renderRowNotice={(place) => planAddPlaceNotice(place, { failure: addPlace.failure })}
            /* **SDK 가 실패해도 담을 수 있어야 한다.** 없으면 열람 전용 화면이 된다 */
            renderListRow={(place, last) => (
              <PlanAddPlaceRow
                key={place.placeId}
                place={place}
                last={last}
                added={addedPlaceIds.has(place.placeId)}
                pending={addPlace.pending?.placeId === place.placeId}
                disabled={addPlace.adding}
                error={
                  addPlace.failure?.target.placeId === place.placeId
                    ? addPlace.failure.error
                    : null
                }
                onAdd={onAdd}
              />
            )}
          />
        </div>
      </div>
    )
  }
```

기존 목록 갈래의 `renderRow` 는 `onAdd` 를 쓰도록 정리한다 (중복 제거).

import 를 더한다.

```tsx
import { PlaceMapView } from '@/features/place/place-map-view'
import { PlanAddPlaceHeader } from '@/features/plan/plan-add-place-header'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
import { PLAN_ADD_DEFAULT_VIEW, type ViewMode, viewModeHref } from '@/lib/url/view-mode'
import type { PlaceSummary } from '@/types/place'
```

- [ ] **Step 7: 타입과 테스트를 확인한다**

```bash
pnpm typecheck
pnpm vitest run src/features/plan
```

Expected: 전부 PASS.

- [ ] **Step 8: 커밋**

```bash
git add "app/(main)/plans/[planId]/days/[day]/add/page.tsx" src/features/plan/plan-add-place-view.tsx src/features/plan/plan-add-place-action.tsx src/features/plan/plan-add-place-map.test.ts
git commit -m "[FE] feat: 담기 화면을 지도 우선 + 목록 전환으로 바꾼다"
```

---

## Task 7: 전체 검증

- [ ] **Step 1: `pnpm verify` 를 돌린다**

```bash
pnpm verify
```

Expected: lint · typecheck · 전체 테스트 PASS. **실패하면 여기서 멈추고 고친다** — 태스크 8 은 문서라 코드가 초록이 아닌 상태로 넘어가면 안 된다.

- [ ] **Step 2: 포맷을 확인한다**

```bash
pnpm format:check
```

Expected: PASS. 실패하면 `pnpm format` 후 변경된 파일만 골라 스테이징한다.

- [ ] **Step 3: 필요하면 커밋**

```bash
git commit -m "[FE] style: 포맷을 맞춘다"
```

(고칠 것이 없었으면 이 스텝은 건너뛴다.)

---

## Task 8: 문서를 코드에 맞춘다

**코드 변경과 문서 변경은 같이 움직인다** (`frontend/CLAUDE.md` 운영 원칙).

**Files:**
- Modify: `docs/features/plan/일자편집-세부명세.md`
- Modify: `docs/features/_index.md`
- Modify: `docs/screen-inventory.md`

- [ ] **Step 1: F5 표 396행을 뒤집는다**

`docs/features/plan/일자편집-세부명세.md` 의 `| 담기 성공 후 |` 행을 바꾼다.

```markdown
| 담기 성공 후                   | **화면에 남는다** ([#370](https://github.com/8llow8llowMe/hondigagae/issues/370)). 원래는 그 일자로 `replace` 이동이었으나, 지도 보기에서 하루 동선을 짜려면 여러 곳을 연달아 담아야 해서 담자마자 나가면 지도로 바꾼 의미가 없다. 피드백은 **토스트 + 그 행이 `이미 담았어요` 로 바뀌는 것**이고, 돌아가기는 헤더의 `일정으로 돌아가기` 다 |
```

같은 파일 F2 절 끝에 한 줄을 더한다.

```markdown
> **지도 보기가 붙었다** (#370). 같은 라우트이고 보기는 `?view=` 가 갖는다 — 기본은
> 지도다. 세부는 `docs/features/plan/담기지도-세부명세.md`.
```

- [ ] **Step 2: 인덱스의 plan 행을 갱신한다**

`docs/features/_index.md` 상태 표의 `plan` 행에서 문서 목록에 `담기지도-세부명세.md` 를 더하고, 비고에 `담기 지도 보기(#370)` 를 더한다.

- [ ] **Step 3: `screen-inventory.md` 의 담기 화면 항목을 갱신한다**

담기 화면(`/plans/[planId]/days/[day]/add`) 항목에 **지도 보기 추가(#370)** 와 기본 보기가 지도임을 적는다. 새 API 가 없으므로 착수 가능 여부는 바뀌지 않는다.

- [ ] **Step 4: 커밋**

```bash
git add docs/features/plan/일자편집-세부명세.md docs/features/_index.md docs/screen-inventory.md
git commit -m "[DOCS] docs: 담기 후 화면에 남는 결정과 지도 보기를 명세에 반영한다"
```

---

## Task 9: 브라우저 실화면 검증과 미결 확정

**명세 D8 의 미결 1·2 는 여기서 확정한다.** 코드가 생기기 전에는 판단 근거가 없다고 명세에 적어 뒀다.

- [ ] **Step 1: dev 서버를 띄운다**

**포트 5174 고정이다.** 3000 은 카카오 지도 키에 도메인이 등록돼 있지 않아 지도가 항상 폴백으로 떨어진다 — 이 이슈에서는 치명적이다. `preview_start` 는 샌드박스에 막히므로 Bash 로 띄운다.

```bash
pnpm dev:alt
```

- [ ] **Step 2: 세 폭에서 지도 보기를 본다**

`/plans/{실제 planId}/days/1/add` 를 390 · 768 · 1280 에서 연다.

확인 항목:
- 지도 화면에 **세로 스크롤이 없다** (헤더 + 지도가 뷰포트에 정확히 든다)
- 데스크톱 좌측 패널이 헤더와 겹치지 않는다
- 모바일 시트를 `min`/`mid`/`max` 로 옮겨도 헤더가 가려지지 않는다
- 우상단에 토글이 **두 개 뜨지 않는다** (헤더에 하나뿐)

- [ ] **Step 3: 담기를 연달아 두 번 한다**

- 첫 번째 담기 → 토스트가 뜨고 **화면에 남는다**
- 그 행이 `이미 담았어요` 로 바뀐다
- **그 핀의 톤이 낮아진다**
- 두 번째 장소를 이어서 담을 수 있다
- `일정으로 돌아가기` 로 나가면 두 장소가 다 들어 있다

- [ ] **Step 4: URL 왕복을 확인한다**

- 지도에서 필터를 걸고 목록으로 전환 → 필터가 남는다
- 브라우저 뒤로가기 → 지도로 돌아온다
- 새로고침 → 보기와 필터가 살아남는다
- 지도에서 필터 초기화(`EmptyState` 버튼) → **목록으로 튀지 않는다**
- 액션 열 `상세` 링크로 나갔다 뒤로가기 → 지도로 돌아온다

- [ ] **Step 5: 미결 1·2 를 확정한다**

- **미결 1** — 액션 열의 `상세` 가 낱말로 읽히는지, `담기` 와 세로로 겹쳐 답답하지 않은지. 폭이 모자라면 아이콘 + `aria-label` 로 바꾼다
- **미결 2** — 컨텍스트 바의 부제(`{일정 제목} · N일차`)가 지도를 너무 눌러 답답하지 않은지. 답답하면 지도 보기에서만 뺀다

고친 것이 있으면 `pnpm verify` 를 다시 돌리고 커밋한다. 명세 D8 표의 추천 칸을 **확정된 값**으로 갱신한다.

- [ ] **Step 6: 지도 SDK 폴백을 확인한다**

`.env.local` 의 카카오 키를 잠시 비우고 새로고침한다.

- 안내 한 줄 + 목록이 뜬다
- **그 목록에 담기 버튼이 살아 있다** (`renderListRow` 가 먹었다)
- 확인 후 **`.env.local` 을 반드시 되돌린다**

- [ ] **Step 7: `/places` 회귀를 확인한다**

같은 컴포넌트를 고쳤으므로 원래 화면도 본다.

- `/places` 지도가 오늘과 같은 높이다 (세로 스크롤 없음)
- 우상단 토글이 그대로 있고 목록으로 전환된다
- 패널 행에 `상세` 링크가 생겼고 제목은 더 이상 링크가 아니다
- 마커에 muted 가 **하나도 없다** (`mutedPlaceIds` 를 안 넘겼다)

- [ ] **Step 8: PR 을 올린다**

`pr` 스킬로 본문을 쓴다. `Issue Number` 에 **370** 을 반드시 채운다. 머지는 `Rebase and merge` 만 쓴다.

```bash
git push -u origin feature/fe/370-plan-add-place-map
```

---

## Self-Review 결과

**1. 명세 커버리지**

| 명세 절 | 태스크 |
| --- | --- |
| D0 기본 보기 · 이탈 경로 | 1, 5, 6 |
| D1 레이아웃 · 높이 | 4(Step 4), 6(Step 6) |
| D2 컴포넌트 · 인터페이스 | 3, 4, 5, 6 |
| D3 데이터 흐름 · 프리페치 유지 | 6(Step 5) |
| D4 상호작용 · `onResetFilters` 보존 | 6(Step 6) |
| D4 담기 후 화면 유지 | 2 |
| D5 상태별 화면 · SDK 폴백 | 4(Step 3), 6(Step 6) |
| D6 접근성 · 중첩 해소 | 3 |
| D7 테스트 | 1, 2, 3, 6 |
| D8 미결 1·2 | 9(Step 5) |
| 앞선 결정 개정(F5 396행) | 2, 8 |

빠진 절 없음.

**2. 플레이스홀더 스캔** — 코드 스텝은 전부 실제 코드다. 태스크 8 Step 2·3 은 대상 파일의 표 구조를 실행 시점에 읽어야 해서 정확한 셀 값 대신 무엇을 더할지를 적었다 — 표 형식이 파일마다 달라 미리 못 박으면 틀린다.

**3. 타입 일관성** — `renderRowAction`/`renderRowNotice` 는 태스크 3(정의) → 4(통과) → 6(사용)에서 같은 시그니처다. `mutedPlaceIds: ReadonlySet<string>` 는 4(소비) → 6(`placeIdsOf` 가 반환하는 `Set<string>`)로 대입 가능하다. `PLAN_ADD_DEFAULT_VIEW` 는 1(정의) → 6(사용) 이름이 같다. `planAddPlaceAction`/`planAddPlaceNotice` 는 6 Step 1(테스트) → Step 3(구현)에서 인자 모양이 같다.
