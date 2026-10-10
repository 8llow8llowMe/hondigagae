import { describe, expect, it } from 'vitest'

import { isActiveNav } from '@/lib/nav/active'

describe('isActiveNav — 루트 판정 (명세 D7 #12)', () => {
  it('/ 는 정확히 일치할 때만 활성이다', () => {
    expect(isActiveNav('/', '/')).toBe(true)
  })

  it('다른 화면에서 홈이 활성이 되지 않는다 — startsWith 로 하면 전부 걸린다', () => {
    expect(isActiveNav('/places', '/')).toBe(false)
    expect(isActiveNav('/pets/123', '/')).toBe(false)
    expect(isActiveNav('/plans', '/')).toBe(false)
  })
})

describe('isActiveNav — 하위 경로 (명세 D7 #11)', () => {
  it('상세 화면에서도 목록 메뉴가 활성이다', () => {
    expect(isActiveNav('/places/123', '/places')).toBe(true)
    expect(isActiveNav('/places', '/places')).toBe(true)
  })

  it('다른 메뉴는 활성이 아니다', () => {
    expect(isActiveNav('/places/123', '/pets')).toBe(false)
  })

  it('경로 경계를 지킨다 — /pets 가 /petsomething 에 걸리지 않는다', () => {
    expect(isActiveNav('/petsomething', '/pets')).toBe(false)
    expect(isActiveNav('/pets/new', '/pets')).toBe(true)
  })
})
