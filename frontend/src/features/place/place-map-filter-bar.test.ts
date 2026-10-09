import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `PlaceMapFilterBar` 는 라우터 · React Query 훅 · 시트를 쓰는 클라이언트 컴포넌트라 node 환경에서 렌더할 수 없다.
 * **반려견 칩의 자리 · 켜는 조건은 소스에서 읽히므로** 여기서 잠근다 (장소-반려견칩-세부명세 D7-4, #1301).
 * 칩 자체의 모양 · 메뉴는 `pet-switcher.test.ts` · `pet-switcher-menu.test.ts` 가 렌더로 잰다.
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

  it('칩은 유형 스크롤러(.scroll-rail) 앞이고 그 밖이다 — 스크롤러 안이면 메뉴가 잘린다', () => {
    const chip = code.indexOf('<PetSwitcherSlot variant="chip" />')
    const rail = code.indexOf("'scroll-rail'")
    const scroller = code.indexOf('overflow-x-auto')

    expect(chip).toBeGreaterThan(-1)
    expect(rail).toBeGreaterThan(chip)
    expect(scroller).toBeGreaterThan(rail)
  })

  it('칩이 서면 유형 스크롤러가 남은 폭을 갖는다', () => {
    expect(code).toContain("cn('scroll-rail', showPetSwitch && 'min-w-0 flex-1')")
  })
})
