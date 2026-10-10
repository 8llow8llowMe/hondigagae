import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  CONGESTION_SPECIMEN,
  EMERGENCY_ENTRY_SPECIMEN,
  EMERGENCY_ROWS_SPECIMEN,
  GOLDEN_CURVE_HOURLY,
  GOLDEN_CURVE_SPECIMEN,
  HOURLY_GRADE_EDGES,
  PLACE_ROWS_SPECIMEN,
  PLAN_ALT_SPECIMEN,
  PLAN_SPECIMEN,
  VERDICT_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { CongestionSpecimen } from '@/features/about/congestion-specimen'
import { EmergencySpecimen } from '@/features/about/emergency-specimen'
import { GoldenCurveSpecimen, hourlyGrade } from '@/features/about/golden-curve-specimen'
import { isPlaceDimmed, PlacesSpecimen } from '@/features/about/places-specimen'
import { PlanSpecimen } from '@/features/about/plan-specimen'
import { ScrollStage } from '@/features/about/scroll-stage'
import { VerdictSpecimen } from '@/features/about/verdict-specimen'
import { messages } from '@/lib/messages'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 고정 예시 4개 (#635, 명세 §6-4 2단). **끝 상태가 정본이다** — 정적 마크업에 최종값이 있고
 * 숨김 클래스가 없다. 재생은 마운트 뒤 클라이언트 몫이라 여기서는 보지 않는다.
 */
describe('VerdictSpecimen — 히어로 판정 카드', () => {
  const markup = renderToStaticMarkup(createElement(VerdictSpecimen))

  it('최종값이 처음부터 DOM 에 있다 — 29 · 56.0 · 31 · 위험', () => {
    expect(markup).toContain('>29<')
    expect(markup).toContain('>56.0<')
    expect(markup).toContain('>31<')
    expect(markup).toContain(messages.about.specimen.verdictGrade)
  })

  it('등급어는 metric-critical 로 칠한다 — 예시라도 실제 등급 자리다', () => {
    expect(markup).toContain('metric-critical')
  })

  it('노면 값에만 등급 색이 붙는다 — 기온·체감은 중립 수치다', () => {
    expect(markup.match(/text-metric-critical-500/g)?.length).toBe(1)
  })

  it('근거 문장이 치환돼 들어간다', () => {
    expect(markup).toContain(`${VERDICT_SPECIMEN.pavementThreshold}℃`)
    expect(markup).toContain(VERDICT_SPECIMEN.window)
    expect(markup).not.toContain('{threshold}')
    expect(markup).not.toContain('{window}')
  })

  it('예시 캡션이 있다 — 지금 제주 날씨로 읽히지 않게', () => {
    expect(markup).toContain(messages.about.specimen.verdictNote)
  })

  it('숨김 클래스가 없다', () => {
    expect(markup).not.toContain('opacity-0')
  })
})

describe('GoldenCurveSpecimen — 골든타임 곡선', () => {
  const markup = renderToStaticMarkup(createElement(GoldenCurveSpecimen))

  it('그래프는 role=img + 한 문장 라벨이다', () => {
    expect(markup).toContain('role="img"')
    expect(markup).toContain(messages.about.specimen.curveAria)
  })

  it('정적 렌더는 다 그려진 상태다 — dashoffset 0 · 숨김 없음', () => {
    expect(markup).toContain('stroke-dashoffset:0')
    expect(markup).not.toContain('stroke-dashoffset:1;')
    expect(markup).not.toContain('opacity-0')
  })

  it('선은 pathLength=1 위에서 그린다 — 없으면 1px 점선이 된다', () => {
    expect(markup).toContain('pathLength="1"')
  })

  it('노면 선만 등급 색이다 — 기온 선은 중립', () => {
    expect(markup).toContain('stroke-metric-critical-500')
    expect(markup).toContain('stroke-fg-muted')
  })

  it('추천 구간 면은 tint 층이다 — 글자를 얹지 않는 면', () => {
    expect(markup).toContain('fill-metric-high-100')
  })

  it('부제에 추천 구간이 치환돼 들어간다', () => {
    expect(markup).toContain(VERDICT_SPECIMEN.window)
    expect(markup).not.toContain('{window}')
  })

  it('봉우리 라벨은 판정 카드의 노면 값에서 파생된다', () => {
    expect(markup).toContain(`${VERDICT_SPECIMEN.pavement.toFixed(1)}℃`)
  })

  it('예시는 그림이라 y축 눈금을 두지 않는다', () => {
    expect(markup).not.toContain('50℃')
  })

  it('판정 배지가 산책 축의 위험이다 — 단계 2 가 가리키는 그림 (#914)', () => {
    const badge = markup.match(
      /<span class="[^"]*bg-metric-critical-100[^"]*">[\s\S]*?<\/span><\/span>/,
    )?.[0]
    expect(badge).toBeDefined()
    expect(badge).toContain(messages.common.metricAxisWalkSafety)
    expect(badge).toContain(messages.about.specimen.verdictGrade)
  })

  it('기상특보 띠는 metric-mid 이고 정적 렌더에 보인다 — 단계 4 가 가리키는 그림 (#914)', () => {
    const strip = markup.match(
      new RegExp(`<p class="([^"]*)"[^>]*>${messages.about.specimen.curveAlert}<`),
    )
    expect(strip?.[1]).toContain('bg-metric-mid-100')
    expect(strip?.[1]).not.toContain('opacity-0')
  })

  it('무대 안에서도 정적 렌더는 전부 보인다 — 무대의 첫 단계는 마지막 단계다', () => {
    const staged = renderToStaticMarkup(
      createElement(ScrollStage, {
        count: 4,
        copy: null,
        visual: createElement(GoldenCurveSpecimen),
      }),
    )
    expect(staged).not.toContain('opacity-0')
    expect(staged).toContain('stroke-dashoffset:0')
    expect(staged).toContain(messages.about.specimen.curveAlert)
  })

  it('시각 핸들은 라벨이 붙은 range 이고 12시에서 시작한다 (#916)', () => {
    const input = markup.match(/<input [^>]*type="range"[^>]*>/)?.[0] ?? ''
    expect(input).toContain('min="0"')
    expect(input).toContain(`max="${GOLDEN_CURVE_HOURLY.length - 1}"`)
    expect(input).toContain('value="12"')
    const id = input.match(/id="([^"]+)"/)?.[1]
    expect(markup).toContain(`<label for="${id}"`)
    expect(markup).toContain(messages.about.specimen.curveScrubLabel)
  })

  it('만지기 전에는 읽기 줄이 비어 있다 — 카드 배지와 같은 사실을 두 번 말하지 않는다', () => {
    expect(markup).toMatch(/<p aria-hidden="true" class="[^"]*"><\/p>/)
    expect(markup.match(/stroke-dasharray="3 3"/g)).toBeNull()
  })

  it('읽기는 range 의 aria-valuetext 하나다 — aria-live 를 더하면 두 번 읽힌다', () => {
    const input = markup.match(/<input [^>]*type="range"[^>]*>/)?.[0] ?? ''
    expect(input).toContain('aria-valuetext="12:00 · 기온 29℃ · 노면 56.0℃"')
    expect(markup).not.toContain('aria-live')
  })
})

/** 두 path 의 마지막 x — 둘 다 같아야 하고 그 값을 돌려준다 */
function GOLDEN_CURVE_SPECIMEN_PATH_END_X(): number {
  const endX = (path: string) => Number(path.trim().split(/[ ,]+/).at(-2))
  const temperature = endX(GOLDEN_CURVE_SPECIMEN.temperaturePath)
  expect(endX(GOLDEN_CURVE_SPECIMEN.pavementPath)).toBe(temperature)
  return temperature
}

describe('곡선 24점 표 — 계산식이 아니라 예시 값 (#916)', () => {
  it('24시간이다', () => {
    expect(GOLDEN_CURVE_HOURLY).toHaveLength(24)
  })

  it('추천 구간(06–08시)은 안전이다 — 카드 문구와 같은 장면', () => {
    for (const hour of [6, 7, 8]) {
      expect(hourlyGrade(GOLDEN_CURVE_HOURLY[hour]?.pavement ?? 0)).toBe('SAFE')
    }
  })

  it('12시 봉우리는 판정 카드의 노면 값이고 위험이다', () => {
    const noon = GOLDEN_CURVE_HOURLY[12]
    expect(noon?.pavement).toBe(VERDICT_SPECIMEN.pavement)
    expect(noon?.temperature).toBe(VERDICT_SPECIMEN.temperature)
    const code = hourlyGrade(noon?.pavement ?? 0)
    expect(code).toBe('DANGER')
    expect(messages.about.specimen.walkGrades[code]).toBe(messages.about.specimen.verdictGrade)
  })

  it('등급 경계는 서버 기본값과 같다 — 노면 42 이상 주의 · 52 이상 위험 (WalkSafetyEvaluator)', () => {
    expect(HOURLY_GRADE_EDGES).toEqual({ caution: 42, danger: 52 })
  })

  it.each([
    [41, 'SAFE'],
    [42, 'CAUTION'],
    [51.9, 'CAUTION'],
    [52, 'DANGER'],
  ] as const)('노면 %s℃ 는 %s — 서버와 같은 선', (pavement, code) => {
    expect(hourlyGrade(pavement)).toBe(code)
  })

  it('표의 경계 근처 값도 실서비스와 같은 등급으로 읽힌다 — 14시 52 위험 · 16시 41 안전', () => {
    expect(hourlyGrade(GOLDEN_CURVE_HOURLY[14]?.pavement ?? 0)).toBe('DANGER')
    expect(hourlyGrade(GOLDEN_CURVE_HOURLY[16]?.pavement ?? 0)).toBe('SAFE')
  })

  it('곡선 path 가 23시(x 357)까지 간다 — 시각 핸들의 끝 점이 선 밖에 뜨지 않게', () => {
    expect(GOLDEN_CURVE_SPECIMEN_PATH_END_X()).toBe(12 + 23 * 15)
  })

  it('노면 곡선은 12시에서 접선이 수평이다 — 봉우리가 12시 뒤로 밀리지 않게', () => {
    // `S x2 y2, 192 18` 의 조절점 y 가 18 이어야 다음 반사 조절점도 18 이다
    expect(GOLDEN_CURVE_SPECIMEN.pavementPath).toMatch(/S \d+ 18, 192 18/)
  })
})

describe('CongestionSpecimen — 한산한 날 막대', () => {
  const markup = renderToStaticMarkup(createElement(CongestionSpecimen))

  it('막대는 congestion 토큰이다 — 등급 색을 쓰지 않는다 (§2-3 #603)', () => {
    expect(markup.match(/bg-congestion-bar/g)?.length).toBe(CONGESTION_SPECIMEN.heights.length - 1)
    expect(markup.match(/bg-congestion-best/g)?.length).toBe(1)
    expect(markup).not.toContain('bg-metric-')
  })

  it('정적 렌더는 자라난 상태다 — scale-y-0 없음', () => {
    expect(markup).not.toContain('scale-y-0')
  })

  it('가장 한산한 날을 문장으로도 말한다 — 색만으로 전달하지 않는다', () => {
    expect(markup).toContain(CONGESTION_SPECIMEN.bestDate)
    expect(markup).toContain(`role="group" aria-label="${messages.about.specimen.congestionAria}"`)
  })

  it('막대 일곱이 버튼이고 이름이 날짜 · 서버 어휘 수준이다 (#916)', () => {
    const names = [...markup.matchAll(/<button type="button" aria-label="([^"]*)"/g)].map(
      (match) => match[1],
    )
    const copy = messages.about.specimen
    expect(names).toEqual(
      CONGESTION_SPECIMEN.dates.map((date, index) =>
        index === CONGESTION_SPECIMEN.bestIndex
          ? copy.congestionBarBest.replace('{date}', date)
          : copy.congestionBar
              .replace('{date}', date)
              .replace('{level}', CONGESTION_SPECIMEN.levels[index] ?? ''),
      ),
    )
  })

  it('가장 한산한 날의 날짜가 툴팁 표와 같다 — 두 곳이 다른 날을 말하지 않는다', () => {
    expect(CONGESTION_SPECIMEN.dates[CONGESTION_SPECIMEN.bestIndex]).toBe(
      CONGESTION_SPECIMEN.bestDate,
    )
    expect(CONGESTION_SPECIMEN.levels[CONGESTION_SPECIMEN.bestIndex]).toBe('한산')
  })

  it('탭은 열기만 한다 — 토글이면 안드로이드에서 포커스가 연 것을 클릭이 닫는다', () => {
    const source = readSourceWithoutComments('src/features/about/congestion-specimen.tsx')
    expect(source).toMatch(
      /onClick=\{\(event\) => \{\s*event\.currentTarget\.focus\(\)\s*setOpen\(index\)/,
    )
    expect(source).not.toMatch(/current === index \? null : index/)
  })

  it('툴팁은 aria-hidden 이고 정적 렌더에서 숨어 있다 — 투명도가 아니라 invisible', () => {
    const tips = markup.match(/<span aria-hidden="true" class="[^"]*\bbg-fg\b[^"]*"/g) ?? []
    expect(tips).toHaveLength(CONGESTION_SPECIMEN.heights.length)
    for (const tip of tips) {
      expect(tip).toContain('invisible')
      expect(tip).not.toContain('opacity-0')
    }
  })
})

describe('PlanSpecimen — AI 일정 일자 탭', () => {
  const markup = renderToStaticMarkup(createElement(PlanSpecimen))

  it('탭은 tablist 이고 1일차가 선택돼 있다', () => {
    expect(markup).toContain('role="tablist"')
    expect(markup.match(/aria-selected="true"/g)?.length).toBe(1)
    expect(markup).toContain(PLAN_SPECIMEN[0].day)
    // 선택된 것이 **1일차** 인지까지 본다 — 개수만 세면 어느 탭이든 하나면 통과한다
    expect(markup).toMatch(
      /<button[^>]*id="about-plan-tab-0"[^>]*aria-selected="true"|<button[^>]*aria-selected="true"[^>]*id="about-plan-tab-0"/,
    )
  })

  it('탭 셋이 같은 패널 하나를 가리킨다 — 없는 id 를 가리키지 않는다', () => {
    expect(markup).toContain('role="tabpanel"')
    expect(markup.match(/aria-controls="about-plan-panel"/g)?.length).toBe(PLAN_SPECIMEN.length)
  })

  it('1일차 항목 셋이 처음부터 보인다', () => {
    for (const item of PLAN_SPECIMEN[0].items) expect(markup).toContain(item.title)
  })

  it('다시 짜기는 시연 버튼이고 링크가 아니다 — 예시 안에 실제 라우트를 심지 않는다 (#916)', () => {
    const button = markup.match(/<button type="button"(?![^>]*role="tab")[^>]*>/)?.[0] ?? ''
    expect(button).not.toBe('')
    // 클래스의 `disabled:` 변형이 아니라 속성을 본다
    expect(button).not.toContain('disabled=""')
    expect(markup).toContain(messages.about.specimen.planRegenerate)
    expect(markup).not.toContain('<a ')
  })

  it('예시 캡션이 있다 — 대체 세트도 고정값이다', () => {
    expect(markup).toContain(messages.about.specimen.planRegenerateNote)
    expect(PLAN_ALT_SPECIMEN).toHaveLength(PLAN_SPECIMEN.length)
    for (const alt of PLAN_ALT_SPECIMEN) expect(alt).toHaveLength(3)
  })

  it('진행 중에는 disabled 가 아니라 aria-disabled 다 — 키보드 포커스가 body 로 떨어지지 않게', () => {
    const source = readSourceWithoutComments('src/features/about/plan-specimen.tsx')
    expect(source).toContain('aria-disabled={busyStep !== null || undefined}')
    expect(source).not.toMatch(/\sdisabled=\{/)
  })

  it('진행 중에 일자를 바꾸면 취소한다 — 보고 있지 않은 일자를 바꾸지 않게', () => {
    const source = readSourceWithoutComments('src/features/about/plan-specimen.tsx')
    expect(source).toMatch(/if \(next !== selected && busyStep !== null\) cancelRegenerate\(\)/)
    expect(source).toContain('onClick={() => selectDay(index)}')
  })

  it('끝나면 완료 문장을 live 영역에 남긴다 — 감속 모션 경로도 같은 문장이다', () => {
    expect(messages.about.specimen.planRegenerated).toContain('{day}')
    expect(messages.about.specimen.planRestored).toContain('{day}')
    const source = readSourceWithoutComments('src/features/about/plan-specimen.tsx')
    expect(source).toMatch(/busyStep !== null \? copy\.planRegenerateSteps\[busyStep\] : done/)
  })

  it('진행 문장 자리는 aria-live 이고 정적 렌더에서는 비어 있다', () => {
    expect(markup).toMatch(/<p aria-live="polite" class="[^"]*"><\/p>/)
  })
})

/**
 * 서버 예시 둘 — 상태가 없어 `'use client'` 가 아니다 (#635 fix 1).
 *
 * `about-view.test.ts` 가 `AboutView` 를 통째로 렌더해 이미 덮지만, 파일로 떼어낸 뒤에는
 * **그 자체로 서는지**도 본다 — 호출자 없이 렌더되지 않으면 서버 컴포넌트가 아니다.
 */
describe('PlacesSpecimen — 내 반려견 기준 필터 예시', () => {
  const markup = renderToStaticMarkup(createElement(PlacesSpecimen))

  it('동반 정보 없음은 점선 태그다 — 불가로 단정하지 않는다', () => {
    expect(markup).toContain(messages.about.specimen.unknownTag)
    expect(markup).toMatch(/border-metric-unknown-500[^"]*border-dashed/)
  })

  it('필터 칩 문구를 messages 에서 읽는다 — 뷰에 한국어를 박지 않는다', () => {
    expect(markup).toContain(messages.about.specimen.filterIndoor)
    expect(markup).toContain(messages.about.specimen.filterOpen)
  })

  it('무대 훅 — 칩 셋 · 행 셋 · 정보 없음 행 하나 (#914)', () => {
    // 고정 칩 하나는 span, 누르는 칩 둘은 button 이다 (#916)
    expect(markup.match(/<(span|button)[^>]*class="[^"]*\babout-stage-chip\b/g)).toHaveLength(3)
    expect(markup.match(/<li class="[^"]*\babout-stage-row\b/g)).toHaveLength(3)
    expect(markup.match(/<li class="[^"]*\babout-stage-row-unknown\b/g)).toHaveLength(1)
  })

  it('실내·실외 태그와 운영 중 태그만 단계 3 강조 대상이다 (#914)', () => {
    const live = [
      ...markup.matchAll(/<span class="[^"]*\babout-stage-tag-live\b[^"]*">([^<]*)</g),
    ].map((match) => match[1])
    const expected = PLACE_ROWS_SPECIMEN.flatMap((row) => [
      row.setting,
      ...('open' in row ? [messages.about.specimen.filterOpen] : []),
    ])
    expect(live.sort()).toEqual([...expected].sort())
  })

  it('필터 칩 둘이 눌리는 토글이고 고정 칩은 버튼이 아니다 (#916)', () => {
    const toggles = [
      ...markup.matchAll(/<button type="button" aria-pressed="(true|false)"[^>]*>([^<]*)</g),
    ]
    expect(toggles.map((match) => match[2])).toEqual([
      messages.about.specimen.filterIndoor,
      messages.about.specimen.filterOpen,
    ])
    expect(toggles.every((match) => match[1] === 'false')).toBe(true)
    expect(markup).toMatch(new RegExp(`<span class="[^"]*">${messages.about.specimen.placesChip}<`))
  })

  it('누르는 칩은 28 높이 그대로 누르는 자리만 넓힌다 — 테두리 1px 을 빼도 44 이상', () => {
    for (const [tag] of markup.matchAll(/<button type="button" aria-pressed[^>]*>/g)) {
      expect(tag).toContain('h-7')
      expect(tag).toContain('before:-inset-y-2.5')
    }
  })

  it('정적 렌더에서는 흐려진 행이 없다 — 필터는 꺼진 채 시작한다', () => {
    expect(markup).not.toContain('opacity-30')
  })

  it.each([
    [{ indoor: false, open: false }, [false, false, false]],
    [{ indoor: true, open: false }, [true, false, true]],
    [{ indoor: false, open: true }, [false, false, true]],
    [{ indoor: true, open: true }, [true, false, true]],
  ])('필터 %o 이면 행 흐림이 %o 다 — 행은 지우지 않는다', (filter, expected) => {
    expect(PLACE_ROWS_SPECIMEN.map((row) => isPlaceDimmed(row, filter))).toEqual(expected)
  })

  it('실내 칩이 거르는 값은 라벨이 아니라 indoor 불리언이다', () => {
    for (const row of PLACE_ROWS_SPECIMEN) expect(row.indoor).toBe(row.setting === '실내')
  })

  it('무대 훅 클래스를 붙여도 정적 렌더의 태그 톤 클래스가 그대로다', () => {
    expect(markup).toMatch(/border-metric-unknown-500[^"]*about-stage-tag-unknown/)
  })
})

describe('EmergencySpecimen — 가까운 병원·약국 예시', () => {
  const markup = renderToStaticMarkup(createElement(EmergencySpecimen))

  it('두 시설이 이름과 거리로 선다', () => {
    for (const row of EMERGENCY_ROWS_SPECIMEN) {
      expect(markup).toContain(row.name)
      expect(markup).toContain(row.distance)
    }
  })

  it('예시 캡션이 있다 — 실제 거리로 읽히지 않게', () => {
    expect(markup).toContain(messages.about.specimen.emergencyNote)
  })

  it('DOM 순서가 거리순이다 — 단계 0 의 뒤섞임은 transform 뿐이다 (#914)', () => {
    const positions = EMERGENCY_ROWS_SPECIMEN.map((row) => markup.indexOf(row.name))
    const distances = EMERGENCY_ROWS_SPECIMEN.map((row) => Number.parseFloat(row.distance))
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('위치 점은 aria-hidden 장식이다', () => {
    expect(markup).toMatch(/<span aria-hidden="true" class="about-stage-locate[ "]/)
  })

  it('일정 안 진입 행이 있고 링크가 아니다 — 예시 안에 실제 라우트를 심지 않는다 (#914)', () => {
    const entry = markup.match(/<div class="about-stage-entry[^"]*">[\s\S]*?<\/div>/)?.[0]
    expect(entry).toBeDefined()
    expect(entry).toContain(EMERGENCY_ENTRY_SPECIMEN.day)
    expect(entry).toContain(messages.about.specimen.emergencyEntry)
    expect(entry).not.toContain('<a ')
  })
})

/**
 * 좌우 인셋은 `INSET_CLASS` 하나가 정한다 (검토 최종 Important 3).
 *
 * `px-4 … md:px-5` 를 컴포넌트마다 손으로 적으면 `lib/ui/inset` 이 바뀔 때 여기만 남는다 —
 * 그 드리프트가 `inset.ts` 주석이 기록한 실측 사고(판정 40 · 골든타임 24)의 원인이었다.
 */
describe('예시 카드 — 인셋을 문자열로 적지 않는다', () => {
  for (const file of [
    'src/features/about/verdict-specimen.tsx',
    'src/features/about/golden-curve-specimen.tsx',
  ]) {
    it(`${file} 은 INSET_CLASS.card 를 쓴다`, () => {
      const source = readSourceWithoutComments(file)
      expect(source).toContain('INSET_CLASS.card')
      expect(source).not.toContain('md:px-5')
    })
  }
})
