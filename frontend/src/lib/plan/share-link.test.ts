import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import {
  isShareablePlan,
  shareExpiryLabel,
  shareLoadErrorMessage,
  shareUrlOf,
  shouldRetryShareLinkQuery,
} from '@/lib/plan/share-link'

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

/**
 * 발급 모달의 조회 실패 문구 (#979).
 *
 * "공유 중이 아님" 은 이제 200 + null 이라 여기 오지 않는다. 대신 **404 `PLAN_001`(일정
 * 없음)이 오류 갈래로 들어온다** — 예전에는 404 를 통째로 null 로 접어 가려졌다. 404 에
 * "잠시 후 다시 시도해 주세요" 를 말하면 재시도할 것이 없는데 재시도를 권하게 된다.
 */
describe('발급 모달 조회 실패 문구 (shareLoadErrorMessage)', () => {
  it('5xx 는 일시 장애 문구다', () => {
    expect(shareLoadErrorMessage(new ApiError(503, null, null))).toBe(messages.plan.shareLoadError)
  })

  it('무응답도 일시 장애 문구다', () => {
    expect(shareLoadErrorMessage(new TypeError('Failed to fetch'))).toBe(
      messages.plan.shareLoadError,
    )
  })

  it('404 PLAN_001 은 서버 문구를 그대로 쓴다', () => {
    expect(
      shareLoadErrorMessage(new ApiError(404, 'PLAN_001', '존재하지 않는 여행 일정입니다.')),
    ).toBe('존재하지 않는 여행 일정입니다.')
  })

  /* 래퍼 없는 게이트웨이 404·403 — 재시도를 권하지 않는 폴백이어야 한다 */
  it('서버 문구가 없는 4xx 는 재시도를 권하지 않는 폴백 문구다', () => {
    for (const status of [404, 403]) {
      const message = shareLoadErrorMessage(new ApiError(status, null, null))
      expect(message).toBe(messages.plan.shareLoadFailed)
      expect(message).not.toContain('다시 시도')
    }
  })
})

/**
 * 발급 모달 조회의 재시도 (#979). §7 일정 행의 "retry 1" 을 **오류 종류를 보존한 채**
 * 구현한다 — 숫자 `retry: 1` 은 404 `PLAN_001` 까지 한 번 더 부른다.
 */
describe('발급 모달 조회 재시도 (shouldRetryShareLinkQuery)', () => {
  it('404 PLAN_001 은 재시도하지 않는다', () => {
    expect(
      shouldRetryShareLinkQuery(0, new ApiError(404, 'PLAN_001', '존재하지 않는 여행 일정입니다.')),
    ).toBe(false)
  })

  it('503 은 첫 실패에만 한 번 재시도한다', () => {
    expect(shouldRetryShareLinkQuery(0, new ApiError(503, null, null))).toBe(true)
    expect(shouldRetryShareLinkQuery(1, new ApiError(503, null, null))).toBe(false)
  })

  it('무응답은 첫 실패에 재시도한다', () => {
    expect(shouldRetryShareLinkQuery(0, new TypeError('Failed to fetch'))).toBe(true)
  })
})
