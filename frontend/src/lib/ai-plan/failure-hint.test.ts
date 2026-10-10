import { describe, expect, it } from 'vitest'

import {
  isEmptyPlanFailure,
  isNarrowedRegionFailure,
  isShortenablePeriodTimeout,
  JOB_TIMEOUT,
  LLM_EMPTY_PLAN,
  NO_PLACE_CANDIDATES,
} from '@/lib/ai-plan/failure-hint'

describe('isNarrowedRegionFailure (#251)', () => {
  it('지역을 좁힌 채 AIPLAN_012 로 실패하면 단서를 붙인다', () => {
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, '4')).toBe(true)
  })

  /*
    **좁히지 않았으면 붙이지 않는다.** 제주 전체로 만들다 실패한 사람에게 "지역을 넓혀
    보세요" 는 할 수 없는 일을 시키는 것이고, 그 순간 다른 안내까지 흘려 읽게 된다.
  */
  it('제주 전체였으면 붙이지 않는다', () => {
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, null)).toBe(false)
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, '')).toBe(false)
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, undefined)).toBe(false)
  })

  /** 기간·예산 문제에 지역을 권하면 원인을 잘못 짚는다 */
  it('다른 실패 코드에는 붙이지 않는다', () => {
    expect(isNarrowedRegionFailure('AIPLAN_005', '4')).toBe(false)
    expect(isNarrowedRegionFailure(null, '4')).toBe(false)
  })

  /** 백엔드 `AiPlanErrorCode.NO_PLACE_CANDIDATES` 복제본 — 한 글자만 달라도 단서가 죽는다 */
  it('코드가 백엔드와 같다', () => {
    expect(NO_PLACE_CANDIDATES).toBe('AIPLAN_012')
  })
})

describe('isShortenablePeriodTimeout — 제한 시간 초과 단서 (#710)', () => {
  /*
    서버 문구는 `AI 일정 생성이 제한 시간을 넘겼습니다.` 까지다 — **할 수 있는 일**은
    응답 어디에도 없다. 기간이 길수록 LLM 이 짜야 하는 일자가 늘어 오래 걸린다.
  */
  it('이틀 이상이면 기간 단축을 권한다', () => {
    expect(isShortenablePeriodTimeout(JOB_TIMEOUT, 2)).toBe(true)
    expect(isShortenablePeriodTimeout(JOB_TIMEOUT, 5)).toBe(true)
  })

  /*
    **하루짜리에는 붙이지 않는다.** 1일 일정에 "하루 줄이면 빨라져요" 는 할 수 없는 일을
    시키는 것이다 (#251 이 좁히지 않은 지역에 "넓혀 보세요" 를 붙이지 않은 것과 같은 판단).
  */
  it('하루짜리에는 붙이지 않는다', () => {
    expect(isShortenablePeriodTimeout(JOB_TIMEOUT, 1)).toBe(false)
    expect(isShortenablePeriodTimeout(JOB_TIMEOUT, 0)).toBe(false)
  })

  /** 조건을 잃으면 하루인지 가릴 수 없다 — 모르는 채로 권하는 쪽이 틀릴 여지가 크다 */
  it('기간을 모르면 붙이지 않는다', () => {
    expect(isShortenablePeriodTimeout(JOB_TIMEOUT, null)).toBe(false)
    expect(isShortenablePeriodTimeout(JOB_TIMEOUT, undefined)).toBe(false)
  })

  /** 후보가 없어 실패한 사람에게 기간을 줄이라고 하면 후보가 더 줄어든다 */
  it('다른 실패 코드에는 붙이지 않는다', () => {
    expect(isShortenablePeriodTimeout(NO_PLACE_CANDIDATES, 3)).toBe(false)
    expect(isShortenablePeriodTimeout(null, 3)).toBe(false)
  })

  /** 백엔드 `AiPlanErrorCode.JOB_TIMEOUT` 복제본 — 한 글자만 달라도 단서가 죽는다 */
  it('코드가 백엔드와 같다', () => {
    expect(JOB_TIMEOUT).toBe('AIPLAN_006')
  })
})

describe('isEmptyPlanFailure — 빈 초안 실패 단서 (#1270 · 백엔드 #1268)', () => {
  /*
    서버는 빈 초안을 한 번 다시 부르고도 비면 `AIPLAN_022` 로 끝낸다. 원인은 조건이 아니라
    그 회차의 모델 선택이라(dev 의 바로 앞 실행은 같은 조건으로 채워졌다) 같은 조건으로
    다시 누르는 것이 듣는 수다.
  */
  it('AIPLAN_022 면 단서를 붙인다', () => {
    expect(isEmptyPlanFailure(LLM_EMPTY_PLAN)).toBe(true)
  })

  /** 후보가 없거나(012) 시간이 넘친(006) 실패에 "같은 조건으로" 를 권하면 원인을 잘못 짚는다 */
  it('다른 실패 코드에는 붙이지 않는다', () => {
    expect(isEmptyPlanFailure(NO_PLACE_CANDIDATES)).toBe(false)
    expect(isEmptyPlanFailure(JOB_TIMEOUT)).toBe(false)
    expect(isEmptyPlanFailure(null)).toBe(false)
    expect(isEmptyPlanFailure(undefined)).toBe(false)
  })

  /** 백엔드 `AiPlanErrorCode.LLM_EMPTY_PLAN` 복제본 — 한 글자만 달라도 단서가 죽는다 */
  it('코드가 백엔드와 같다', () => {
    expect(LLM_EMPTY_PLAN).toBe('AIPLAN_022')
  })
})
