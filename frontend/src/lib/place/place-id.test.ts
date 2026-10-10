import { describe, expect, it } from 'vitest'

import { isPlaceId } from '@/lib/place/place-id'

/**
 * `placeId` 형식 판정 — 이슈 #496.
 *
 * 백엔드 상세 컨트롤러가 `@PathVariable long` 이라 숫자가 아니면 **무조건 400**
 * (`PLACE_113`)이다. 여기서 거르는 것이 맞는 이유와 **거르지 않는 것**을 함께 잠근다.
 */
describe('isPlaceId — 물어보기 전에 답이 정해진 주소를 가른다', () => {
  it('숫자 문자열이면 통과한다', () => {
    for (const value of ['1', '126436', '123456789012345678']) {
      expect(isPlaceId(value)).toBe(true)
    }
  })

  /*
    **Snowflake 라 19자리까지 간다.** `Number()` 로 바꿔 판정하면 `MAX_SAFE_INTEGER`(16자리)
    를 넘겨 정밀도를 잃는다 — 문자열 패턴으로 보는 이유다.
  */
  it('19자리도 그대로 통과한다 — Number 로 바꿔 보지 않는다', () => {
    const snowflake = '9223372036854775807'

    expect(isPlaceId(snowflake)).toBe(true)
    // 숫자로 바꾸면 값이 달라진다는 사실 자체를 적어 둔다
    expect(String(Number(snowflake))).not.toBe(snowflake)
  })

  it('숫자가 아니면 막는다 — 이 주소들이 400 을 3건 냈다', () => {
    for (const value of ['abc', '12a', 'a12', '1.5', '1e3', '-1', '+1', '', ' ', ' 12', '12 ']) {
      expect(isPlaceId(value)).toBe(false)
    }
  })

  /*
    **앞자리 0 은 막지 않는다.** `Long.parseLong("007")` 은 7 로 읽히므로 서버가 답할 수
    있는 주소다 — 여기서 거르면 화면이 서버보다 먼저 거절하는 것이 된다.
  */
  it('앞자리 0 은 통과시킨다 — 서버가 답할 수 있는 주소다', () => {
    expect(isPlaceId('007')).toBe(true)
  })

  /*
    **길이 상한을 두지 않는다.** 20자리 이상은 서버가 `Long` 범위로 400 을 내는데, 그
    경계를 화면이 베껴 두면 둘이 갈린다 — 모양만 보고 범위는 서버에 맡긴다.
  */
  it('Long 범위를 넘는 자릿수는 여기서 판정하지 않는다 — 범위는 서버의 것이다', () => {
    expect(isPlaceId('99999999999999999999999')).toBe(true)
  })
})
