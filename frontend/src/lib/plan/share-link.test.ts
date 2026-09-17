import { describe, expect, it } from 'vitest'

import { isShareablePlan, shareExpiryLabel, shareUrlOf } from '@/lib/plan/share-link'

/**
 * 공유 링크의 순수 규칙을 잠근다 (#628).
 *
 * **세 함수 다 렌더 테스트로는 못 잡는다.** 주소 조립은 origin 이 환경마다 달라
 * 문자열 assertion 이 무의미하고, 공유 가능 판정은 "모르는 코드는 false" 라는 닫힌
 * 쪽 기본값이 핵심인데 그 경로는 화면에 그려지지 않는다.
 */
describe('공유 주소 조립 (shareUrlOf)', () => {
  it('열람 경로에 토큰을 붙인다', () => {
    expect(shareUrlOf('abc123', 'https://hondigagae.com')).toBe(
      'https://hondigagae.com/shared-plans/abc123',
    )
  })

  it('origin 끝의 슬래시를 먹는다 — 안 그러면 //shared-plans 가 된다', () => {
    expect(shareUrlOf('abc123', 'https://hondigagae.com/')).toBe(
      'https://hondigagae.com/shared-plans/abc123',
    )
  })

  it('포트가 붙은 로컬 origin 도 그대로 쓴다', () => {
    expect(shareUrlOf('abc123', 'http://localhost:5174')).toBe(
      'http://localhost:5174/shared-plans/abc123',
    )
  })

  /*
    토큰은 URL-safe Base64(`-`·`_`)라 정상 값에는 인코딩할 문자가 없다. 그래도 거는
    이유는 **서버가 토큰 문자셋을 바꿨을 때 주소가 조용히 깨지지 않게** 하기 위해서다.
  */
  it('URL 에서 뜻을 갖는 문자를 인코딩한다', () => {
    expect(shareUrlOf('a/b?c', 'https://hondigagae.com')).toBe(
      'https://hondigagae.com/shared-plans/a%2Fb%3Fc',
    )
  })

  it('토큰이 비면 주소를 만들지 않는다', () => {
    expect(shareUrlOf('', 'https://hondigagae.com')).toBeNull()
  })

  it('origin 이 비면 주소를 만들지 않는다 — 서버 렌더에서 window 가 없다', () => {
    expect(shareUrlOf('abc123', '')).toBeNull()
  })
})

describe('공유 가능 판정 (isShareablePlan)', () => {
  it('확정은 공유할 수 있다', () => {
    expect(isShareablePlan('CONFIRMED')).toBe(true)
  })

  it('완료도 공유할 수 있다', () => {
    expect(isShareablePlan('COMPLETED')).toBe(true)
  })

  it('초안은 공유할 수 없다 — 서버가 PLAN_022 로 막는다', () => {
    expect(isShareablePlan('DRAFT')).toBe(false)
  })

  /*
    **모르는 코드는 false 다.** 서버가 상태를 늘렸을 때 기본값이 true 면 화면이 먼저
    열리고 서버가 400 으로 막는다 — 사용자는 눌러 보고서야 안 된다는 걸 안다.
  */
  it('모르는 상태 코드는 공유할 수 없다고 본다', () => {
    expect(isShareablePlan('ARCHIVED')).toBe(false)
    expect(isShareablePlan('')).toBe(false)
  })
})

describe('만료 안내 (shareExpiryLabel)', () => {
  const now = new Date('2026-09-18T10:00:00+09:00')

  it('남은 날짜를 날짜로 말한다 — D-N 을 쓰지 않는다', () => {
    expect(shareExpiryLabel('2026-10-18T10:00:00', now)).toBe('2026년 10월 18일까지 볼 수 있어요')
  })

  it('오늘 만료면 오늘이라고 말한다', () => {
    expect(shareExpiryLabel('2026-09-18T23:00:00', now)).toBe('오늘까지 볼 수 있어요')
  })

  /*
    이미 지난 링크는 서버가 410 을 내므로 모달에 남아 있을 일이 거의 없다. 그래도
    `GET` 응답과 화면 사이에 자정이 낀 경우가 있어 **남은 날짜를 음수로 그리지 않는다.**
  */
  it('이미 지났으면 만료됐다고 말한다', () => {
    expect(shareExpiryLabel('2026-09-17T10:00:00', now)).toBe('만료됐어요')
  })

  it('날짜를 못 읽으면 아무 말도 하지 않는다 — 틀린 날짜는 없는 날짜보다 나쁘다', () => {
    expect(shareExpiryLabel('어제', now)).toBeNull()
    expect(shareExpiryLabel('', now)).toBeNull()
  })
})
