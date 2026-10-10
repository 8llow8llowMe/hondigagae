import { describe, expect, it } from 'vitest'

import { petCreateHref, petCreateReturnTo } from '@/lib/pet/return-to'

describe('petCreateHref — 돌아갈 곳을 실은 등록 경로 (#1153)', () => {
  it('돌아갈 경로를 인코딩해 싣는다', () => {
    expect(petCreateHref('/ai-plans/new')).toBe('/pets/new?returnTo=%2Fai-plans%2Fnew')
  })

  it('쿼리가 있는 경로도 한 값으로 실린다', () => {
    expect(petCreateHref('/places/1?tab=a')).toBe('/pets/new?returnTo=%2Fplaces%2F1%3Ftab%3Da')
  })
})

describe('petCreateReturnTo — 등록 뒤 돌아갈 곳 (#1153)', () => {
  it('안전한 내부 경로는 그대로 돌려준다', () => {
    expect(petCreateReturnTo('/ai-plans/new')).toBe('/ai-plans/new')
    expect(petCreateReturnTo('/places/212481712381923328')).toBe('/places/212481712381923328')
  })

  it('없으면 null 이다 — 호출부가 기본(반려견 목록)으로 간다', () => {
    expect(petCreateReturnTo(undefined)).toBeNull()
    expect(petCreateReturnTo('')).toBeNull()
  })

  it('여러 값이 오면 쓰지 않는다 — 어느 쪽인지 고를 근거가 없다', () => {
    expect(petCreateReturnTo(['/a', '/b'])).toBeNull()
  })

  /* 오픈 리다이렉트 — 로그인의 `safeReturnTo` 판정을 그대로 쓴다 */
  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    '/a\nb',
    // 점 세그먼트 — 앞머리 검사는 통과하지만 정규화하면 `//evil.com` 이 된다
    '/.//evil.com',
    '/a/..//evil.com',
    '/%2e//evil.com',
  ])('외부·스킴·제어문자(%s)는 null 이다 — 홈으로 접지 않는다', (raw) => {
    expect(petCreateReturnTo(raw)).toBeNull()
  })

  it('홈 자체는 돌아갈 곳이다', () => {
    expect(petCreateReturnTo('/')).toBe('/')
  })

  it('인증 화면으로는 돌아가지 않는다', () => {
    expect(petCreateReturnTo('/login')).toBeNull()
  })

  it('등록 화면 자신으로는 돌아가지 않는다 — 같은 폼이 다시 뜬다', () => {
    expect(petCreateReturnTo('/pets/new')).toBeNull()
    expect(petCreateReturnTo('/pets/new?returnTo=%2Fai-plans%2Fnew')).toBeNull()
  })

  it('모양만 바꾼 등록 화면도 막는다 — 끝 슬래시 · 해시 · 점 세그먼트', () => {
    expect(petCreateReturnTo('/pets/new/')).toBeNull()
    expect(petCreateReturnTo('/pets/new#x')).toBeNull()
    expect(petCreateReturnTo('/pets/./new')).toBeNull()
  })

  it('쿼리 · 해시는 지킨다', () => {
    expect(petCreateReturnTo('/olle/12?activity=LOW#top')).toBe('/olle/12?activity=LOW#top')
  })
})
