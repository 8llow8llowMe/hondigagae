import { describe, expect, it } from 'vitest'

import { safeReturnTo } from '@/lib/http/redirect'

describe('safeReturnTo — 허용', () => {
  it('같은 오리진 경로를 통과시킨다', () => {
    expect(safeReturnTo('/places')).toBe('/places')
  })

  it('쿼리스트링을 유지한다', () => {
    expect(safeReturnTo('/places?contentType=12')).toBe('/places?contentType=12')
  })

  it('중첩 경로를 통과시킨다', () => {
    expect(safeReturnTo('/pets/212481712381923328')).toBe('/pets/212481712381923328')
  })
})

describe('safeReturnTo — 거부', () => {
  it('프로토콜 상대 URL 을 거부한다', () => {
    expect(safeReturnTo('//evil.com')).toBe('/')
  })

  it('역슬래시 우회를 거부한다 — 브라우저가 //evil.com 으로 해석한다', () => {
    expect(safeReturnTo('/\\evil.com')).toBe('/')
  })

  it('절대 URL 을 거부한다', () => {
    expect(safeReturnTo('http://evil.com')).toBe('/')
    expect(safeReturnTo('https://evil.com')).toBe('/')
  })

  it('javascript 스킴을 거부한다', () => {
    expect(safeReturnTo('javascript:alert(1)')).toBe('/')
  })

  it('제어문자가 섞이면 거부한다', () => {
    expect(safeReturnTo('/places\n/evil')).toBe('/')
  })

  it('인증 화면 자신을 거부한다 — 리다이렉트 루프가 된다', () => {
    expect(safeReturnTo('/login')).toBe('/')
    expect(safeReturnTo('/login?returnTo=/pets')).toBe('/')
    expect(safeReturnTo('/signup')).toBe('/')
  })

  it('null / undefined / 빈 문자열은 홈으로 보낸다', () => {
    expect(safeReturnTo(null)).toBe('/')
    expect(safeReturnTo(undefined)).toBe('/')
    expect(safeReturnTo('   ')).toBe('/')
  })
})
