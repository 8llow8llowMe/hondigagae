import { describe, expect, it } from 'vitest'

import {
  codeTimerSeconds,
  cooldownAnnounceSeconds,
  coolDownFor,
  expiryAnnounceSeconds,
  NO_CODE_TIMERS,
  RESEND_COOLDOWN_FALLBACK_SECONDS,
  secondsUntil,
  startCodeTimers,
} from '@/lib/form/code-timers'

const SEND_INFO = { codeExpiresInSeconds: 300, resendAvailableInSeconds: 60 }
const T0 = 1_700_000_000_000

describe('secondsUntil — 마감 시각까지 남은 초', () => {
  it('마감 시각이 없으면 0 이다', () => {
    expect(secondsUntil(null, T0)).toBe(0)
  })

  it('남은 시간을 초 단위로 올림한다 — 0.2초 남았어도 1초다', () => {
    expect(secondsUntil(T0 + 60_000, T0)).toBe(60)
    expect(secondsUntil(T0 + 60_000, T0 + 30_000)).toBe(30)
    expect(secondsUntil(T0 + 60_000, T0 + 59_800)).toBe(1)
  })

  it('마감이 지나면 음수가 아니라 0 이다', () => {
    expect(secondsUntil(T0 + 60_000, T0 + 60_000)).toBe(0)
    expect(secondsUntil(T0 + 60_000, T0 + 90_000)).toBe(0)
  })
})

describe('startCodeTimers · codeTimerSeconds', () => {
  it('코드가 없으면 쿨다운 0 · 만료 null 이다', () => {
    expect(codeTimerSeconds(NO_CODE_TIMERS, T0)).toEqual({
      cooldownSeconds: 0,
      expiresInSeconds: null,
    })
  })

  it('발송 직후에는 응답 값을 그대로 보인다', () => {
    const timers = startCodeTimers(SEND_INFO, T0)

    expect(codeTimerSeconds(timers, T0)).toEqual({ cooldownSeconds: 60, expiresInSeconds: 300 })
  })

  it('시각으로 다시 계산한다 — 렌더가 몇 번 건너뛰어도(백그라운드 탭) 어긋나지 않는다', () => {
    const timers = startCodeTimers(SEND_INFO, T0)

    expect(codeTimerSeconds(timers, T0 + 45_000)).toEqual({
      cooldownSeconds: 15,
      expiresInSeconds: 255,
    })
  })

  it('만료가 지나면 만료는 null 이 아니라 0 이다 — "만료됐어요" 를 보일 자리다', () => {
    const timers = startCodeTimers(SEND_INFO, T0)

    expect(codeTimerSeconds(timers, T0 + 301_000)).toEqual({
      cooldownSeconds: 0,
      expiresInSeconds: 0,
    })
  })

  it('응답 값이 바뀌면 그 값을 따른다 — FE 가 60 · 300 을 박지 않는다', () => {
    const timers = startCodeTimers({ codeExpiresInSeconds: 600, resendAvailableInSeconds: 30 }, T0)

    expect(codeTimerSeconds(timers, T0)).toEqual({ cooldownSeconds: 30, expiresInSeconds: 600 })
  })
})

describe('coolDownFor — 429 로 다시 보내지 못했을 때', () => {
  it('쿨다운만 새로 걸고 만료 시각은 그대로 둔다 — 새 코드가 오지 않았다', () => {
    const started = startCodeTimers(SEND_INFO, T0)
    const cooled = coolDownFor(started, 3540, T0 + 100_000)

    expect(codeTimerSeconds(cooled, T0 + 100_000)).toEqual({
      cooldownSeconds: 3540,
      expiresInSeconds: 200,
    })
  })

  it('헤더가 없을 때의 대체값은 60초다', () => {
    expect(RESEND_COOLDOWN_FALLBACK_SECONDS).toBe(60)
  })
})

describe('cooldownAnnounceSeconds — 스크린리더에 알릴 쿨다운 초', () => {
  it('1분 미만은 10초 단위로만 알린다', () => {
    expect(cooldownAnnounceSeconds(30)).toBe(30)
    expect(cooldownAnnounceSeconds(37)).toBeNull()
  })

  it('1분 이상은 분 경계에서만 알린다 — "59분" 을 10초마다 되풀이하지 않는다', () => {
    expect(cooldownAnnounceSeconds(3540)).toBe(3540)
    expect(cooldownAnnounceSeconds(3530)).toBeNull()
    expect(cooldownAnnounceSeconds(60)).toBe(60)
    expect(cooldownAnnounceSeconds(70)).toBeNull()
  })

  it('쿨다운이 아니면 알리지 않는다', () => {
    expect(cooldownAnnounceSeconds(0)).toBeNull()
  })
})

describe('expiryAnnounceSeconds — 스크린리더에 알릴 만료 초', () => {
  it('분 경계와 만료 순간에만 알린다', () => {
    expect(expiryAnnounceSeconds(240)).toBe(240)
    expect(expiryAnnounceSeconds(0)).toBe(0)
    expect(expiryAnnounceSeconds(299)).toBeNull()
    expect(expiryAnnounceSeconds(30)).toBeNull()
  })

  it('코드가 없으면 알리지 않는다', () => {
    expect(expiryAnnounceSeconds(null)).toBeNull()
  })
})
