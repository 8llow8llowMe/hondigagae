import { describe, expect, it } from 'vitest'

import {
  describeGoldenWindow,
  formatHourRuns,
  isWithinGoldenWindow,
  markGoldenWindow,
} from '@/lib/insight/golden-window'
import type { HourlyWalkSafetyItem } from '@/types/insight'

const DAY = '2026-08-29T'

function hour(hh: string): HourlyWalkSafetyItem {
  return {
    at: `${DAY}${hh}:00:00`,
    walkSafetyLevel: { code: 'SAFE', name: '안전', description: null, score: null },
    temperature: 27,
    estimatedPavementCelsius: 33,
    precipitationProbability: 0,
  } as unknown as HourlyWalkSafetyItem
}

describe('isWithinGoldenWindow', () => {
  const start = `${DAY}17:00:00`
  const end = `${DAY}23:00:00`

  /* 문장이 `17:00 – 23:00` 이라고 적어 놓고 셀에서 양끝을 빼면 둘이 다시 어긋난다 */
  it('양끝을 포함한다', () => {
    expect(isWithinGoldenWindow(`${DAY}17:00:00`, start, end)).toBe(true)
    expect(isWithinGoldenWindow(`${DAY}23:00:00`, start, end)).toBe(true)
  })

  it('구간 안이면 참이다', () => {
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, start, end)).toBe(true)
  })

  it('구간 밖이면 거짓이다', () => {
    expect(isWithinGoldenWindow(`${DAY}16:00:00`, start, end)).toBe(false)
    expect(isWithinGoldenWindow(`${DAY}23:00:01`, start, end)).toBe(false)
  })

  /** `goldenStart == goldenEnd` 인 날이 정상 응답이다 (#200) */
  it('한 시각짜리 구간은 그 한 칸만 든다', () => {
    const at = `${DAY}23:00:00`

    expect(isWithinGoldenWindow(at, at, at)).toBe(true)
    expect(isWithinGoldenWindow(`${DAY}22:00:00`, at, at)).toBe(false)
  })

  /* 추천이 없는 날에 화면이 구간을 만들어 내지 않는다 */
  it('구간이 없으면 어느 칸도 들지 않는다', () => {
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, null, null)).toBe(false)
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, start, null)).toBe(false)
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, null, end)).toBe(false)
  })

  /* 뒤집힌 구간을 해석해서 없는 추천을 만들지 않는다 */
  it('끝이 시작보다 앞서면 어느 칸도 들지 않는다', () => {
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, end, start)).toBe(false)
  })
})

describe('markGoldenWindow', () => {
  const hourly = ['15', '16', '17', '18', '19'].map(hour)

  it('구간의 양끝을 짚는다', () => {
    const marks = markGoldenWindow(hourly, `${DAY}17:00:00`, `${DAY}18:00:00`)

    expect(marks.map((m) => m.inWindow)).toEqual([false, false, true, true, false])
    expect(marks.map((m) => m.windowStart)).toEqual([false, false, true, false, false])
    expect(marks.map((m) => m.windowEnd)).toEqual([false, false, false, true, false])
  })

  it('한 칸짜리 구간은 시작이자 끝이다', () => {
    const marks = markGoldenWindow(hourly, `${DAY}17:00:00`, `${DAY}17:00:00`)

    expect(marks[2]).toEqual({ inWindow: true, windowStart: true, windowEnd: true })
  })

  /* 구간이 곡선의 첫 칸/끝 칸까지 닿아도 양끝 판정이 배열 밖으로 새지 않는다 */
  it('곡선의 첫 칸과 끝 칸에 걸쳐도 양끝을 짚는다', () => {
    const marks = markGoldenWindow(hourly, `${DAY}15:00:00`, `${DAY}19:00:00`)

    expect(marks[0]?.windowStart).toBe(true)
    expect(marks[4]?.windowEnd).toBe(true)
    expect(marks.every((m) => m.inWindow)).toBe(true)
  })

  it('구간이 없는 날은 전부 거짓이다', () => {
    const marks = markGoldenWindow(hourly, null, null)

    expect(marks.every((m) => !m.inWindow && !m.windowStart && !m.windowEnd)).toBe(true)
  })

  it('곡선이 비어 있어도 견딘다', () => {
    expect(markGoldenWindow([], `${DAY}17:00:00`, `${DAY}18:00:00`)).toEqual([])
  })
})

/*
  #637. 헤드라인 옆 `주의` 배지가 **창 전체의 등급**으로 읽혔다 — `11:00 – 23:00 [주의]`.
  실제로 주의는 창 안의 두 칸(14 · 15시)이고 나머지 열한 칸은 안전이다. "좋은 시간인데
  주의?" 라는 모순을 배지가 만들었고, 그 배지가 가진 정보는 원래 **어디가 주의인가** 였다.

  그 사실을 말하려면 창 안의 등급 분포를 알아야 한다 — 이 함수가 그것을 만든다.
*/
describe('describeGoldenWindow', () => {
  function walkHour(
    hh: number,
    code: string,
    name: string,
    pavement: number,
  ): HourlyWalkSafetyItem {
    return {
      at: `${DAY}${String(hh).padStart(2, '0')}:00:00`,
      walkSafetyLevel: { code, name, description: null, scoreDescription: null },
      temperature: 30,
      estimatedPavementCelsius: pavement,
      precipitationProbability: 0,
    }
  }

  /** 11~23시. 14 · 15 만 주의다 — 2026-09-15 dev 실측의 모양 */
  function mixedDay(): HourlyWalkSafetyItem[] {
    return [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((hh) =>
      hh === 14
        ? walkHour(hh, 'CAUTION', '주의', 45.9)
        : hh === 15
          ? walkHour(hh, 'CAUTION', '주의', 46.3)
          : walkHour(hh, 'SAFE', '안전', 32),
    )
  }

  const START = `${DAY}11:00:00`
  const END = `${DAY}23:00:00`

  it('창 안 시각을 등급별 연속 구간으로 묶는다', () => {
    const { runs } = describeGoldenWindow(mixedDay(), START, END)

    expect(runs.map((run) => [run.code, ...run.hours])).toEqual([
      ['SAFE', 11, 13],
      ['CAUTION', 14, 15],
      ['SAFE', 16, 23],
    ])
  })

  /* 문장이 가리키는 구간이 곧 이 등급이다 — 창 전체 등급(`goldenLevel`)이 아니다 */
  it('가장 심한 등급의 구간을 worst 로 낸다', () => {
    const { worst } = describeGoldenWindow(mixedDay(), START, END)

    expect(worst?.code).toBe('CAUTION')
    expect(worst?.name).toBe('주의')
  })

  /*
    **문장 속 소수는 데이터 냄새다** (진단 G-2). `46.3℃까지 올라` 는 사람이 말하는 모양이
    아니다 — 곡선 셀의 소수 1자리는 그대로 둔다. 셀은 표이고 문장은 말이다.

    **반올림은 최대값을 고른 뒤에 한다.** 칸마다 먼저 반올림하면 45.9 가 46 이 되어
    46.3 과 같은 값이 되고, 어느 칸이 정점인지가 사라진다.
  */
  it('노면 최고온도를 정수로 반올림해 낸다', () => {
    const { worst } = describeGoldenWindow(mixedDay(), START, END)

    expect(worst?.maxPavement).toBe(46)
  })

  it('창 안 등급이 하나뿐이면 구간도 하나다', () => {
    const allSafe = [11, 12, 13].map((hh) => walkHour(hh, 'SAFE', '안전', 32))
    const result = describeGoldenWindow(allSafe, START, `${DAY}13:00:00`)

    expect(result.allSafe).toBe(true)
    expect(result.runs).toHaveLength(1)
    expect(result.runs[0]?.hours).toEqual([11, 13])
  })

  /* 창 밖은 이 문장의 소관이 아니다 — 헤드라인이 말하는 구간만 설명한다 */
  it('창 밖 시각은 결과에 들어오지 않는다', () => {
    const hourly = [walkHour(10, 'DANGER', '위험', 58), ...mixedDay()]
    const { runs, worst } = describeGoldenWindow(hourly, START, END)

    expect(runs.some((run) => run.code === 'DANGER')).toBe(false)
    expect(runs[0]?.hours).toEqual([11, 13])
    expect(worst?.code).toBe('CAUTION')
  })

  /*
    **모르는 코드에서 화면이 비지 않는다** (루트 `CLAUDE.md` enum 규칙). 서버가 등급을
    하나 더 내면 `SAFE` 로 떨어뜨려 "좋다" 고 말하게 되는데, 그것은 모르는 것을 좋은
    것으로 말한 것이다. `CAUTION` 자리에 두고 **이름은 서버 값 그대로** 옮긴다.
  */
  it('모르는 코드는 CAUTION 자리에 두고 이름은 서버 값을 쓴다', () => {
    const hourly = [
      walkHour(11, 'SAFE', '안전', 32),
      walkHour(12, 'FOO', '서버가 새로 낸 등급', 41),
    ]
    const { runs, worst, allSafe } = describeGoldenWindow(hourly, START, `${DAY}12:00:00`)

    expect(runs).toHaveLength(2)
    expect(worst?.code).toBe('FOO')
    expect(worst?.name).toBe('서버가 새로 낸 등급')
    expect(allSafe).toBe(false)
  })

  it('모르는 코드가 DANGER 를 밀어내지 않는다', () => {
    const hourly = [
      walkHour(11, 'FOO', '서버가 새로 낸 등급', 41),
      walkHour(12, 'DANGER', '위험', 58),
    ]
    const { worst } = describeGoldenWindow(hourly, START, `${DAY}12:00:00`)

    expect(worst?.code).toBe('DANGER')
  })

  /*
    **`Date` 를 쓰지 않는다** — `hourMinute` · `isWithinGoldenWindow` 와 같은 이유다.
    서버가 주는 것은 지역 시각 문자열이고, 파싱하면 브라우저 타임존으로 밀린다.
    이 테스트는 `TZ=UTC` 로 돌려도 같은 값이어야 한다.
  */
  it('시각을 문자열에서 뽑는다 — 타임존에 밀리지 않는다', () => {
    const hourly = [walkHour(14, 'CAUTION', '주의', 46)]
    const { runs } = describeGoldenWindow(hourly, `${DAY}14:00:00`, `${DAY}14:00:00`)

    expect(runs[0]?.hours).toEqual([14, 14])
  })

  it('창이 없는 날은 구간도 없다', () => {
    const result = describeGoldenWindow(mixedDay(), null, null)

    expect(result.runs).toEqual([])
    expect(result.worst).toBeNull()
    expect(result.allSafe).toBe(false)
  })

  /* 응답이 어긋나 창 안 시각이 하나도 없는 날. 조용히 빈 결과다 */
  it('창 안 시각을 하나도 못 찾으면 빈 결과다', () => {
    const result = describeGoldenWindow(mixedDay(), `${DAY}03:00:00`, `${DAY}04:00:00`)

    expect(result.runs).toEqual([])
    expect(result.worst).toBeNull()
  })

  /*
    **`UNKNOWN` 은 모르는 코드와 다르다** ([#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **A-2**).

    바로 위 두 테스트가 지키는 것은 *서버가 등급을 하나 더 냈을 때* 그것을 좋은 쪽으로
    접지 않는 것이다. `UNKNOWN` 은 그 경우가 아니라 **서버가 판단하지 않았다고 말한 값**
    이라 등급 자리에 올리면 문장이 `노면이 50℃까지 올라 판단 근거 부족 등급이에요` 가 된다.

    백엔드도 같은 태도다 — `WalkSafetyLevel.worseOf` 가 *"UNKNOWN 은 비교 대상이 아니라
    실제 판정이 있으면 그쪽을 택한다"*.
  */
  it('UNKNOWN 은 노면이 더 높아도 worst 가 되지 않는다', () => {
    const hourly = [
      walkHour(11, 'CAUTION', '주의', 46),
      walkHour(12, 'UNKNOWN', '판단 근거 부족', 50),
    ]
    const { runs, worst } = describeGoldenWindow(hourly, START, `${DAY}12:00:00`)

    // 구간 자체는 남는다 — 곡선 면이 그 칸을 중립 면으로 그려야 한다 (#656)
    expect(runs).toHaveLength(2)
    expect(worst?.code).toBe('CAUTION')
  })

  it('UNKNOWN 이 DANGER 를 밀어내지 않는다', () => {
    const hourly = [
      walkHour(11, 'UNKNOWN', '판단 근거 부족', 59),
      walkHour(12, 'DANGER', '위험', 58),
    ]
    const { worst } = describeGoldenWindow(hourly, START, `${DAY}12:00:00`)

    expect(worst?.code).toBe('DANGER')
  })

  /* 등급이 붙은 시각이 하나도 없으면 등급을 하나 지어내지 않는다 */
  it('창 안이 전부 UNKNOWN 이면 worst 가 없다', () => {
    const hourly = [
      walkHour(11, 'UNKNOWN', '판단 근거 부족', 32),
      walkHour(12, 'UNKNOWN', '판단 근거 부족', 33),
    ]
    const { runs, worst, allSafe } = describeGoldenWindow(hourly, START, `${DAY}12:00:00`)

    expect(runs).toHaveLength(1)
    expect(worst).toBeNull()
    expect(allSafe).toBe(false)
  })
})

describe('formatHourRuns', () => {
  it('구간을 시각 범위로 적는다', () => {
    expect(formatHourRuns([[14, 15]])).toBe('14–15시')
  })

  it('구간이 여럿이면 가운뎃점으로 잇는다', () => {
    expect(
      formatHourRuns([
        [11, 13],
        [16, 23],
      ]),
    ).toBe('11–13시 · 16–23시')
  })

  /* 한 시각을 `9–9시` 로 적으면 0분짜리 구간처럼 읽힌다 (#200 과 같은 판단) */
  it('한 시각짜리 구간은 대시로 잇지 않는다', () => {
    expect(formatHourRuns([[9, 9]])).toBe('9시')
  })

  it('구간이 없으면 빈 문자열이다', () => {
    expect(formatHourRuns([])).toBe('')
  })
})
