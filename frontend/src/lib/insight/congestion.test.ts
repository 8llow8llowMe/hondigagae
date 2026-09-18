import { describe, expect, it } from 'vitest'

import {
  barHeightPercent,
  congestionRateSummary,
  formatCongestionRange,
  isCongestionEmpty,
  splitDay,
} from '@/lib/insight/congestion'
import { congestion, congestionAllUnknown } from '@/test/fixtures/insight'
import type { DailyCongestionItem } from '@/types/insight'

/*
  **차트를 그릴지 말지를 가르는 한 줄이다** (#731). 전부 `UNKNOWN` 인 기간에는 레일·막대·
  점선 격자·날짜 축을 통째로 내지 않고 빈 상태 블록 하나만 세운다.

  경계를 잘못 잡으면 **이미 출시된 정상 갈래가 회귀한다** — 아는 날이 하루라도 있으면 그
  날이 답이고, 답이 있는 카드에서 차트를 지우면 서비스가 할 말을 스스로 가린다. 그래서
  판정을 화면이 아니라 여기 한 곳에 두고 갈래마다 잰다.
*/
describe('isCongestionEmpty', () => {
  /*
    **`hasUnknown` 이 아니라 `leastCrowded === null` 이다.** 서버가 `UNKNOWN` 을 제외하고
    최저 집중률을 고르므로, 아는 날이 하나도 없을 때만 그 값이 `null` 이 된다.
  */
  it('전부 모르는 날이면 비었다고 본다', () => {
    expect(isCongestionEmpty(congestionAllUnknown)).toBe(true)
  })

  /*
    **여기가 이 변경의 가장 위험한 지점이다.** 픽스처 7일 중 하루(`2026-09-04`)가 `UNKNOWN`
    인데, 그 하루 때문에 차트가 사라지면 정상 갈래가 통째로 무너진다 — 점선은 그쪽에서
    여전히 옳은 기호다.
  */
  it('일부만 모르는 날이면 비지 않았다', () => {
    expect(congestion.dailyCongestions.some((item) => item.concentrationRate === null)).toBe(true)
    expect(isCongestionEmpty(congestion)).toBe(false)
  })

  /* 서버가 날짜 목록 자체를 비워 보내는 갈래도 같은 빈 상태다 */
  it('날짜 목록이 비어도 빈 상태다', () => {
    expect(isCongestionEmpty({ ...congestionAllUnknown, dailyCongestions: [] })).toBe(true)
  })
})

/*
  막대 높이 — **트랙 전체가 집중률 100** 이다. 기간 안 최댓값으로 정규화하면 전부 20 대인
  한산한 주와 전부 80 대인 성수기 주가 같은 그림이 된다.
*/
describe('barHeightPercent', () => {
  it('집중률을 그대로 퍼센트로 쓴다', () => {
    expect(barHeightPercent(37.2)).toBe(37.2)
    expect(barHeightPercent(100)).toBe(100)
  })

  /*
    **0 도 실재하는 값이다** (사람이 없는 날). 높이 0 이면 막대가 사라져 `UNKNOWN`
    (막대 없음)과 화면에서 구별되지 않는다.
  */
  it('아는 값은 최소 높이를 갖는다 — UNKNOWN 과 구별돼야 한다', () => {
    expect(barHeightPercent(0)).toBe(4)
    expect(barHeightPercent(2)).toBe(4)
  })

  it('100 을 넘는 값이 트랙 밖으로 자라지 않는다', () => {
    expect(barHeightPercent(140)).toBe(100)
  })
})

/*
  기간 표기는 **응답의 `fromDate` · `toDate`** 로 만든다. `days` 로 계산하면 서버가 기간을
  자를 때 표기만 늘어난 화면이 된다.
*/
describe('formatCongestionRange', () => {
  it('시작일과 종료일을 짧게 잇는다', () => {
    expect(formatCongestionRange('2026-09-01', '2026-09-07')).toBe('9.1 – 9.7')
  })

  it('하루짜리 기간은 한 번만 쓴다', () => {
    expect(formatCongestionRange('2026-09-01', '2026-09-01')).toBe('9.1')
  })

  /* 못 읽는 날짜에 문자열을 지어내지 않는다 — 호출부가 꼬리표 자체를 내지 않는다 */
  it('날짜를 못 읽으면 null 이다', () => {
    expect(formatCongestionRange('2026-02-31', '2026-09-07')).toBeNull()
    expect(formatCongestionRange('', '')).toBeNull()
  })
})

describe('splitDay', () => {
  /* UTC 자정으로 읽는다 — 로컬로 읽으면 KST 에서 요일이 하루 밀린다 (`lib/date/day.ts`) */
  it('월·일·요일로 가른다', () => {
    expect(splitDay('2026-09-05')).toEqual({ month: '9', day: '5', weekday: '토' })
  })

  it('없는 날짜면 null 이다', () => {
    expect(splitDay('2026-02-31')).toBeNull()
  })
})

describe('congestionRateSummary — 집중률 표현 (#651 · 진단 D-3)', () => {
  /** 이 함수는 `level` 을 보지 않는다 — 평균은 `concentrationRate` 만으로 갈린다 */
  const day = (date: string, concentrationRate: number | null): DailyCongestionItem => ({
    date,
    level:
      concentrationRate === null
        ? { code: 'CONGESTION_UNKNOWN', name: '정보 없음', description: null }
        : { code: 'MODERATE', name: '보통', description: null },
    concentrationRate,
  })

  /* 소수 둘째 자리는 예측값의 정밀도를 실제보다 높게 보이게 한다 */
  it('집중률을 정수로 내린다', () => {
    const summary = congestionRateSummary(57.77, [day('2026-09-21', 57.77), day('2026-09-22', 79)])

    expect(summary.rate).toBe(58)
  })

  it('평균도 정수로 낸다', () => {
    const summary = congestionRateSummary(57.77, [
      day('2026-09-21', 57.77),
      day('2026-09-22', 79),
      day('2026-09-23', 88.18),
    ])

    // (57.77 + 79 + 88.18) / 3 = 74.98…
    expect(summary.average).toBe(75)
  })

  /*
    **반올림한 값끼리 뺀다.** 원값 차는 25.1(→25)이지만 화면에는 83 과 57 이 적혀 있어
    읽는 사람이 기대하는 차이는 26 이다. 화면의 세 숫자가 서로 맞아야 한다.
  */
  it('차이는 반올림한 값끼리 뺀 값이다 — 화면의 세 숫자가 맞는다', () => {
    /*
      **두 구현이 갈리는 값을 일부러 고른 조합이다.** 평균이 정확히 82.5 라 `Math.round`
      가 올림하고(83), 값은 57.4 라 내림한다(57) — 반올림하고 빼면 26, 빼고 반올림하면
      `round(25.1)` = 25 다. 셋 다 집중률 축(0~100) 안에 있다.
    */
    const summary = congestionRateSummary(57.4, [
      day('2026-09-21', 57.4),
      day('2026-09-22', 90.1),
      day('2026-09-23', 100),
    ])

    expect(summary.rate).toBe(57)
    expect(summary.average).toBe(83)
    expect(summary.belowAverage).toBe(26)
  })

  /*
    `concentrationRate` 가 `null` 인 날은 값이 없는 것이지 0 이 아니다 — 평균에 넣으면
    "평균보다 낮다" 가 과장된다.
  */
  it('UNKNOWN 은 평균에서 뺀다', () => {
    const withUnknown = congestionRateSummary(60, [
      day('2026-09-21', 60),
      day('2026-09-22', 80),
      day('2026-09-23', null),
      day('2026-09-24', null),
    ])
    const withoutUnknown = congestionRateSummary(60, [day('2026-09-21', 60), day('2026-09-22', 80)])

    expect(withUnknown.average).toBe(70)
    expect(withUnknown.average).toBe(withoutUnknown.average)
  })

  /* 아는 날이 하나면 그 하나가 곧 평균이다 — "평균보다 0 낮아요" 는 말이 아니다 */
  it('아는 날이 하나뿐이면 비교하지 않는다', () => {
    const summary = congestionRateSummary(58, [day('2026-09-21', 58), day('2026-09-22', null)])

    expect(summary.rate).toBe(58)
    expect(summary.average).toBeNull()
    expect(summary.belowAverage).toBeNull()
  })

  it('아는 날이 없으면 비교하지 않는다', () => {
    const summary = congestionRateSummary(58, [day('2026-09-21', null)])

    expect(summary.average).toBeNull()
    expect(summary.belowAverage).toBeNull()
  })

  it('모든 값이 같으면 차이를 말하지 않는다', () => {
    const summary = congestionRateSummary(70, [day('2026-09-21', 70), day('2026-09-22', 70)])

    expect(summary.average).toBe(70)
    expect(summary.belowAverage).toBeNull()
  })

  /*
    **방어 코드 커버리지다 — 호출부는 이 입력을 만들 수 없다.** `leastCrowded` 는 아는 날의
    최솟값이고 `Math.round` 는 단조라 `round(최솟값) <= round(평균)` 이 언제나 성립한다.
    즉 `> 0` 가드가 실제로 거르는 것은 **0 하나**뿐이다(바로 위 "모든 값이 같으면"). 그래도
    이 함수는 임의의 값을 받을 수 있으므로 음수가 새지 않는지 잰다.
  */
  it('차이가 양수가 아니면 null 이다 — 방어 코드', () => {
    const summary = congestionRateSummary(80, [day('2026-09-21', 80), day('2026-09-22', 60)])

    expect(summary.average).toBe(70)
    expect(summary.belowAverage).toBeNull()
  })
})
