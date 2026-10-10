import { describe, expect, it } from 'vitest'

import {
  ABOUT_SEEN_COOKIE,
  aboutSeenCookie,
  hasSeenAbout,
  hasSeenAboutIn,
} from '@/lib/about/seen-cookie'

/** 홈 소개 카드의 기억 (#950) — 쓰는 곳(브라우저)과 읽는 곳(홈 서버)이 같은 규칙을 쓴다 */
describe('서비스 소개를 본 적이 있는가 — 쿠키', () => {
  const parts = aboutSeenCookie().split('; ')

  it('이름과 값', () => {
    expect(parts[0]).toBe(`${ABOUT_SEEN_COOKIE}=1`)
  })

  /* 없으면 `/about` 에서 쓴 쿠키가 `/about` 경로에만 붙어 홈 요청에 실리지 않는다 */
  it('Path=/ 다 — /about 에서 쓴 값이 홈에 닿는다', () => {
    expect(parts).toContain('Path=/')
  })

  /* 세션 쿠키면 브라우저를 닫을 때마다 카드가 다시 선다 */
  it('1년 남는다', () => {
    expect(parts).toContain(`Max-Age=${60 * 60 * 24 * 365}`)
  })

  it('SameSite=Lax 다', () => {
    expect(parts).toContain('SameSite=Lax')
  })

  /* 브라우저가 `document.cookie` 로 쓰는 값이다 — HttpOnly 면 쓸 수 없다 */
  it('HttpOnly 가 아니다', () => {
    expect(aboutSeenCookie()).not.toMatch(/HttpOnly/i)
  })

  it("'1' 만 본 것으로 친다", () => {
    expect(hasSeenAbout('1')).toBe(true)
    expect(hasSeenAbout(undefined)).toBe(false)
    expect(hasSeenAbout('')).toBe(false)
    expect(hasSeenAbout('0')).toBe(false)
  })

  /* 뒤로 가기에서 카드가 되살아나지 않도록 브라우저가 `document.cookie` 를 읽는다 */
  it('document.cookie 문자열에서 찾는다 — 자리 · 공백과 무관하게', () => {
    expect(hasSeenAboutIn(`${ABOUT_SEEN_COOKIE}=1`)).toBe(true)
    expect(hasSeenAboutIn(`a=2; ${ABOUT_SEEN_COOKIE}=1; b=3`)).toBe(true)
    expect(hasSeenAboutIn('')).toBe(false)
    expect(hasSeenAboutIn(`${ABOUT_SEEN_COOKIE}=0`)).toBe(false)
    // 이름이 이 쿠키로 끝나거나 시작하는 다른 쿠키를 잘못 집지 않는다
    expect(hasSeenAboutIn(`x${ABOUT_SEEN_COOKIE}=1`)).toBe(false)
    expect(hasSeenAboutIn(`${ABOUT_SEEN_COOKIE}=10`)).toBe(false)
  })

  /* 브라우저가 쓴 한 줄을 브라우저가 읽는 규칙이 알아본다 — 쓰는 쪽과 읽는 쪽이 어긋나지 않는다 */
  it('쓴 쿠키의 이름=값을 읽는 쪽이 알아본다', () => {
    expect(hasSeenAboutIn(aboutSeenCookie().split('; ')[0] ?? '')).toBe(true)
  })
})
