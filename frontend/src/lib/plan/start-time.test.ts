import { describe, expect, it } from 'vitest'

import { formatStartTime, toInputStartTime } from '@/lib/plan/start-time'

/**
 * 시각 정규화 — 명세 D14-3 · D14-7 · D14-8 미결 1.
 *
 * 서버 `LocalTime` 직렬화가 `HH:mm` 인지 `HH:mm:ss` 인지 실호출로 확정하지 못했다
 * (스키마 `example` 은 `HH:mm:ss` 지만 `format` 이 비어 있다). 그래서 이 함수는 앞 두
 * 자리 시:분만 정규식으로 읽고 나머지는 버린다 — **두 모양을 모두 받아들이는 비용이
 * 정규식 하나다.** 실호출로 확정되면 #67 대조 이슈에서 이 정규식을 좁힌다.
 */
describe('formatStartTime', () => {
  it('HH:mm:ss 를 HH:mm 으로 자른다', () => {
    expect(formatStartTime('10:30:00')).toBe('10:30')
  })

  it('HH:mm 은 그대로 받는다 — 초가 없는 모양도 받아들인다', () => {
    expect(formatStartTime('10:30')).toBe('10:30')
  })

  it('초가 0이 아니어도 시:분만 남긴다', () => {
    expect(formatStartTime('09:05:30')).toBe('09:05')
  })

  it('null 은 null 이다 — 시각이 없는 항목이 대다수다', () => {
    expect(formatStartTime(null)).toBe(null)
  })

  it('빈 문자열은 null 이다', () => {
    expect(formatStartTime('')).toBe(null)
  })

  it('모양이 다른 값은 null 이다 — 없는 시각을 지어내지 않는다', () => {
    expect(formatStartTime('오전 10시')).toBe(null)
  })

  it('한 자리 시는 null 이다 — 서버 원문은 항상 두 자리다', () => {
    expect(formatStartTime('1:30')).toBe(null)
  })

  it('범위 밖 시각은 통과시키지 않는다', () => {
    expect(formatStartTime('24:00:00')).toBe(null)
  })
})

/**
 * 편집 입력 초기값 — `<input type="time">` 은 빈 문자열로 "값 없음" 을 표현한다
 * (일자편집-세부명세 G3).
 */
describe('toInputStartTime', () => {
  it('저장된 시각을 HH:mm 입력값으로 바꾼다', () => {
    expect(toInputStartTime('10:30:00')).toBe('10:30')
  })

  it('null 은 빈 문자열이다', () => {
    expect(toInputStartTime(null)).toBe('')
  })

  it('형식이 어긋난 값도 빈 문자열이다 — 지어내지 않는다', () => {
    expect(toInputStartTime('오전 10시')).toBe('')
  })
})
