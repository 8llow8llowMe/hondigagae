import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `PlaceFilterPetSync` 는 Zustand · React Query · 라우터 훅을 함께 쓰는 렌더 없는 컴포넌트라 node 환경에서
 * 돌릴 수 없다. **판정(A → B · 새 체구 값)은 순수 함수**(`lib/place/pet-size-filter.ts`)가 테스트를 갖고, 여기서는
 * 그 함수를 어떤 문 뒤에서 부르는지를 소스로 잠근다 (장소-반려견칩-세부명세 D7-4, #1301).
 */
function codeOf(relative: string): string {
  const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const code = codeOf('./place-filter-pet-sync.tsx')

describe('PlaceFilterPetSync — 첫 로드에 URL 을 고치지 않는다', () => {
  it('스토어 복원 전에는 직전값을 잡지 않는다 — 복원 여부가 문이다', () => {
    expect(code).toContain('state.selectedPetId !== undefined')
    // 문이 직전값 기록보다 먼저다
    const gate = code.indexOf('if (!restored) return')
    const record = code.indexOf('previousPetId.current = ')
    expect(gate).toBeGreaterThan(-1)
    expect(record).toBeGreaterThan(gate)
  })

  it('직전 · 다음이 둘 다 있고 다를 때만 맞춘다 (`changedPet`)', () => {
    expect(code).toContain('changedPet(previousPetId.current, pet)')
    expect(code).toContain('if (next === null) return')
  })

  it('이동은 usePlaceFilterNav 경유다 · 열린 미리보기를 닫지 않는다 — router.replace 를 직접 부르지 않는다', () => {
    expect(code).toContain('usePlaceFilterNav()')
    expect(code).toContain('apply(nextFilters, { keepPreview: true })')
    expect(code).not.toContain('useRouter')
    expect(code).not.toContain('router.replace')
  })
})

/**
 * 보기 하나에 한 번 (D7-7) — 둘이면 같은 `replace` 가 두 번 나간다. 체구 필터가 있는 네 보기 각각에 하나씩.
 */
describe('PlaceFilterPetSync — 마운트 자리', () => {
  function count(relative: string): number {
    return codeOf(relative).match(/<PlaceFilterPetSync\b/g)?.length ?? 0
  }

  it('PlaceMapView(/places 지도 · 담기 지도) 한 번', () => {
    expect(count('./place-map-view.tsx')).toBe(1)
  })

  it('/places 목록 보기 갈래 한 번', () => {
    expect(count('../../../app/(main)/places/(list)/page.tsx')).toBe(1)
  })

  it('담기 목록 보기 갈래 한 번', () => {
    expect(count('../plan/plan-add-place-view.tsx')).toBe(1)
  })

  it('필터 바 · 레일 · 칩 줄은 직접 마운트하지 않는다 — 두 곳에 동시에 서는 컴포넌트다', () => {
    expect(count('./place-map-filter-bar.tsx')).toBe(0)
    expect(count('./place-filter-rail.tsx')).toBe(0)
    expect(count('./place-filter-chips.tsx')).toBe(0)
  })
})
