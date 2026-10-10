import { describe, expect, it } from 'vitest'

import { bindPathVariable, decodeIntegral } from '@/lib/api/mock/path-variable'

/**
 * 경로변수 바인딩 문법 — `NumberUtils.parseNumber` (#809 · #813).
 *
 * **여기 한 번만 잠근다.** 서버가 도메인마다 같은 한 자리에서 이 응답을 만들므로
 * (`ValidationErrorSupport.toResponse(MethodArgumentTypeMismatchException, …)`),
 * 도메인 목 테스트는 **코드와 필드명이 제대로 얹히는지**만 보면 된다.
 *
 * 아래 경계는 dev 게이트웨이 실측(2026-09-21 · 인증 없는 호출)을 그대로 옮긴 것이다.
 */
describe('경로변수 바인딩 문법 — decodeIntegral', () => {
  /**
   * **8진수가 아니라는 것이 문법을 확정한 증거다.** `Long.decode` 였다면 `08`·`09` 가
   * 무효여야 하는데 dev 는 둘 다 통과시킨다 — 16진수 접두사가 없어 `Long.valueOf` 로
   * 가기 때문이다. 이 줄이 깨지면 8진수로 샌 것이다.
   */
  it.each([
    ['1', '1'],
    ['-1', '-1'],
    ['+1', '1'],
    ['0', '0'],
    ['-0', '0'],
    ['007', '7'],
    ['08', '8'],
    ['09', '9'],
    ['010', '10'],
  ])('10진수 `%s` → `%s` (8진수가 아니다)', (raw, want) => {
    expect(decodeIntegral(raw)).toBe(want)
  })

  /** 16진수 접두사는 `Long.decode` 로 간다. `isHexNumber` 는 `-` 만 보고 `+` 는 안 본다 */
  it.each([
    ['0x10', '16'],
    ['0X1F', '31'],
    ['#10', '16'],
    ['-0x10', '-16'],
    ['-#10', '-16'],
  ])('16진수 `%s` → `%s`', (raw, want) => {
    expect(decodeIntegral(raw)).toBe(want)
  })

  /** `trimAllWhitespace` 는 앞뒤가 아니라 **전부** 지운다 — `'1 2'` 는 `12` 다 */
  it.each([
    [' 1', '1'],
    ['1 ', '1'],
    ['\t 1 ', '1'],
    ['1 2', '12'],
  ])('공백을 전부 지운다: `%s` → `%s`', (raw, want) => {
    expect(decodeIntegral(raw)).toBe(want)
  })

  it.each(['1.5', '1e3', '0b101', '1,000', '+0x10', '#-10', '--1', '++1', '-+1', 'abc', ' ', ''])(
    '`%s` 는 바인딩에 실패한다',
    (raw) => {
      expect(decodeIntegral(raw)).toBeNull()
    },
  )

  it('long 경계 — MAX/MIN 은 통과하고 한 칸 밖은 실패다', () => {
    expect(decodeIntegral('9223372036854775807')).toBe('9223372036854775807')
    expect(decodeIntegral('9223372036854775808')).toBeNull()
    expect(decodeIntegral('-9223372036854775808')).toBe('-9223372036854775808')
    expect(decodeIntegral('-9223372036854775809')).toBeNull()
  })

  /** **`int` 는 경계가 다르다** — 일정의 `day` 가 이 타입이다 */
  it('int 경계 — long 이 받는 값을 거부한다', () => {
    expect(decodeIntegral('2147483647', 'int')).toBe('2147483647')
    expect(decodeIntegral('2147483648', 'int')).toBeNull()
    expect(decodeIntegral('-2147483648', 'int')).toBe('-2147483648')
    expect(decodeIntegral('-2147483649', 'int')).toBeNull()

    // 같은 값이 long 에서는 통과한다
    expect(decodeIntegral('2147483648', 'long')).toBe('2147483648')
  })
})

describe('경로변수 바인딩 오류 — bindPathVariable', () => {
  /** 문구가 **필드명을 끼워** 다시 만들어진다. 코드만 바꾸면 여전히 어긋난다 */
  it.each([
    ['PLAN_124', 'planId'],
    ['PLACE_113', 'placeId'],
    ['INSIGHT_113', 'placeId'],
    ['WALKCOURSE_113', 'walkCourseId'],
    ['FAVORITE_113', 'placeId'],
    ['PET_113', 'petId'],
  ])('%s / %s 의 400 모양', (code, field) => {
    const result = bindPathVariable(code, field, 'abc')
    if (typeof result === 'string') throw new Error('바인딩이 통과하면 안 된다')

    const message = `${field} 파라미터 형식이 올바르지 않습니다.`
    expect(result.status).toBe(400)
    expect(result.payload.dataHeader).toEqual({
      success: false,
      resultCode: code,
      resultMessage: message,
      fieldErrors: [{ code, field, message }],
    })
    expect(result.payload.dataBody).toBeNull()
  })

  it('통과하면 정규화된 값을 돌려준다 — 조회는 이 값으로 해야 한다', () => {
    expect(bindPathVariable('PLACE_113', 'placeId', ' 007 ')).toBe('7')
  })
})
