import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `PlaceMapFilterBar` 는 라우터 · React Query 훅 · 시트를 쓰는 클라이언트 컴포넌트라 node 환경에서 렌더할 수 없다.
 * **배치 · 켜는 조건은 소스에서 읽히므로** 여기서 잠근다 (장소-반려견칩-세부명세 D7-4 · 장소-지도필터-한줄-세부명세 D7-4).
 * `필터` 버튼 · 시트 본문의 모양은 `place-map-filter-sheet.test.ts`, 반려견 칩 자체는 `pet-switcher*.test.ts` 가 렌더로 잰다.
 */
const source = readFileSync(
  fileURLToPath(new URL('./place-map-filter-bar.tsx', import.meta.url)),
  'utf8',
)
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('PlaceMapFilterBar — 반려견 칩 (#1301)', () => {
  it('petSwitch 는 기본 끔이다 — 켜는 쪽은 PlaceMapView(아일랜드)뿐이다', () => {
    expect(code).toContain('petSwitch = false,')
  })

  it('미로그인이면 칩이 없다 — authed 와 함께 켠다', () => {
    expect(code).toContain('const showPetSwitch = petSwitch && authed')
    expect(code).toContain('{showPetSwitch && <PetSwitcherSlot variant="chip" />}')
  })

  it('칩은 스크롤러(.scroll-rail) 앞이고 그 밖이다 — 스크롤러 안이면 메뉴가 잘린다', () => {
    const chip = code.indexOf('<PetSwitcherSlot variant="chip" />')
    const rail = code.indexOf('"scroll-rail ')
    const scroller = code.indexOf('overflow-x-auto')

    expect(chip).toBeGreaterThan(-1)
    expect(rail).toBeGreaterThan(chip)
    expect(scroller).toBeGreaterThan(rail)
  })

  it('스크롤러가 고정 칸 뒤 남은 폭을 갖는다', () => {
    expect(code).toContain('className="scroll-rail min-w-0 flex-1"')
  })
})

describe('PlaceMapFilterBar — 한 줄 + 필터 시트 (#1314)', () => {
  it('순서: 필터 버튼 → 반려견 칩 → 스크롤러(동반 → 유형 → 초기화)', () => {
    const order = [
      '<PlaceMapFilterButton',
      '<PetSwitcherSlot',
      '"scroll-rail ',
      'overflow-x-auto',
      'messages.place.filterAllowedOnlyShort',
      '<ChipGroup',
      'messages.place.resetFilters',
    ].map((needle) => code.indexOf(needle))

    expect(order.every((index) => index > -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('줄은 하나다 — 바깥이 flex-col 이 아니고 가로 flex 다', () => {
    expect(code).not.toContain('flex-col')
    expect(code).toContain("cn('flex min-w-0 items-center gap-1.5', className)")
  })

  it('구분선은 필터 버튼 바로 뒤 · aria-hidden', () => {
    const button = code.indexOf('<PlaceMapFilterButton')
    const divider = code.indexOf('<span aria-hidden className="bg-border h-5 w-px shrink-0" />')

    expect(divider).toBeGreaterThan(button)
    expect(divider).toBeLessThan(code.indexOf('<PetSwitcherSlot'))
  })

  it('시트는 하나다 — 지역 · 더보기 시트가 따로 없다', () => {
    expect(code.match(/<BottomSheet\b/g)).toHaveLength(1)
    expect(code).not.toContain('filterMore')
    expect(code).not.toContain("openSheet('region')")
    expect(code).toContain('title={messages.place.filterTitle}')
    expect(code).toContain('<PlaceMapFilterSheetFields filters={draft}')
  })

  it('줄의 칩은 전부 sm 이다 (DESIGN.md §7 지도 화면 칩)', () => {
    const chips = code.match(/<Chip\b[^>]*>/g) ?? []

    expect(chips.length).toBeGreaterThanOrEqual(4)
    for (const chip of chips) expect(chip).toContain('size="sm"')
  })

  it('동반 칩의 접근 이름은 sr-only 앞말로 `반려견 동반 가능만` 그대로다', () => {
    expect(code).toContain(
      '<span className="sr-only">{`${messages.place.filterAllowedOnlyPrefix} `}</span>',
    )
  })

  it('시트 확정은 바뀐 것이 있을 때만 URL 을 건드린다 — 같으면 닫기만', () => {
    expect(code).toContain(
      'if (toPlaceFilterQuery(draft) !== toPlaceFilterQuery(filters)) apply(draft)',
    )
  })

  it('숫자는 시트 안 축만 센다 — mapSheetFilterCount', () => {
    expect(code).toContain('const sheetCount = mapSheetFilterCount(filters)')
    expect(code).toContain('count={sheetCount}')
  })
})
