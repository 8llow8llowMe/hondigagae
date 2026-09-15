import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  CONGESTION_SPECIMEN,
  EMERGENCY_ROWS_SPECIMEN,
  PLAN_SPECIMEN,
  VERDICT_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { CongestionSpecimen } from '@/features/about/congestion-specimen'
import { EmergencySpecimen } from '@/features/about/emergency-specimen'
import { GoldenCurveSpecimen } from '@/features/about/golden-curve-specimen'
import { PlacesSpecimen } from '@/features/about/places-specimen'
import { PlanSpecimen } from '@/features/about/plan-specimen'
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
    expect(markup).toContain('role="img"')
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

  it('다시 짜기 링크는 실제 화면이 아니라 예시 안 문구다 — a 태그가 아니다', () => {
    expect(markup).toContain(messages.about.specimen.planRegenerate)
    expect(markup).not.toContain('<a ')
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
