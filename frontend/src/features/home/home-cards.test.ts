import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SuitabilityCard } from '@/features/home/suitability-card'
import { WalkVerdictCard } from '@/features/home/walk-verdict-card'
import { messages } from '@/lib/messages'
import { suitability, suitabilityInsufficient, walkSafety } from '@/test/fixtures/insight'

function verdict(overrides: Partial<typeof walkSafety> = {}, petName: string | null = '몽실이') {
  return renderToStaticMarkup(
    createElement(WalkVerdictCard, { data: { ...walkSafety, ...overrides }, petName }),
  )
}

function card(data = suitability) {
  return renderToStaticMarkup(createElement(SuitabilityCard, { data }))
}

describe('WalkVerdictCard — 정상 (명세 D7 #9)', () => {
  it('등급 name · 체감 열지수 · 노면 온도 · 안전 시간대를 보여준다', () => {
    const markup = verdict()

    expect(markup).toContain('위험')
    expect(markup).toContain('35.0')
    expect(markup).toContain('58.0')
    expect(markup).toContain('18:00')
    expect(markup).toContain('21:00')
  })

  it('단위를 텍스트로 붙인다 — 아이콘으로 대체하지 않는다 (D6)', () => {
    expect(verdict()).toContain('℃')
  })

  it('판정 기준을 밝힌다 — 시각·장소·반려견', () => {
    const markup = verdict()

    expect(markup).toContain('14:00')
    expect(markup).toContain('협재해수욕장')
    expect(markup).toContain('몽실이')
  })

  it('DANGER 는 critical 톤이다 — danger(5xx)가 아니라 등급 토큰을 쓴다', () => {
    const markup = verdict()

    expect(markup).toContain('metric-critical')
    expect(markup).not.toContain('text-danger-')
  })

  it('등급어에 세로 바를 쓰지 않는다 — 색과 두께로만 구분한다', () => {
    expect(verdict()).not.toContain('border-l')
  })

  it('숫자에 tabular-nums 를 건다', () => {
    expect(verdict()).toContain('tabular-nums')
  })
})

describe('WalkVerdictCard — null 처리 (명세 D7 #10)', () => {
  it('saferWindowStart 가 null 이면 안전 시간대 줄이 없다', () => {
    const markup = verdict({ saferWindowStart: null, saferWindowEnd: null })

    expect(markup).not.toContain(messages.home.saferWindowLabel)
  })

  it('체감 열지수가 null 이면 그 값만 빠지고 나머지는 남는다', () => {
    const markup = verdict({ heatIndexCelsius: null })

    expect(markup).not.toContain(messages.home.heatIndexLabel)
    expect(markup).toContain(messages.home.pavementLabel)
  })

  it('반려견이 없으면 기준 줄에 이름이 없다 — 일반 판정이다', () => {
    const markup = verdict({}, null)

    expect(markup).not.toContain('몽실이')
    expect(markup).toContain('협재해수욕장')
  })
})

describe('WalkVerdictCard — 근거 (명세 D7 #20·#21)', () => {
  it('근거 4개면 기본 2개 + 더 보기 버튼이다', () => {
    const markup = verdict()

    expect(markup).toContain('근거 2개 더 보기')
    expect(markup).toContain('aria-expanded="false"')
  })

  it('근거 2개면 더 보기 버튼이 없다', () => {
    const markup = verdict({ reasons: walkSafety.reasons.slice(0, 2) })

    expect(markup).not.toContain('더 보기')
  })

  it('서버 문장을 그대로 쓴다', () => {
    expect(verdict()).toContain('발바닥 화상 위험 구간입니다.')
  })
})

describe('SuitabilityCard — 점수 (명세 D7 #23)', () => {
  it('점수와 등급 name 을 보여준다', () => {
    const markup = card()

    expect(markup).toContain('82')
    expect(markup).toContain('/100')
    expect(markup).toContain('여행 적합')
  })

  it('score 가 null 이면 "판단 근거 부족" 이다 — 0 으로 그리지 않는다', () => {
    const markup = card(suitabilityInsufficient)

    expect(markup).toContain(messages.home.scoreUnavailable)
    expect(markup).not.toContain('>0<')
    expect(markup).not.toContain('/100')
  })

  it('INSUFFICIENT 배지는 tint 없이 점선이다', () => {
    const markup = card(suitabilityInsufficient)

    expect(markup).toContain('border-dashed')
    expect(markup).not.toContain('bg-metric-low-100')
  })

  it('배지 텍스트에 -500 을 쓰지 않는다 — tint 위 대비가 무너진다', () => {
    const markup = card()
    // 배지 span 만 본다. -500 은 22px/900 점수 숫자에는 허용된 용법이라
    // 문서 전체로 단정하면 그 정상 사용까지 잡는다 (DESIGN.md §2-3)
    const badge = /<span[^>]*rounded-sm[^>]*>여행 적합</.exec(markup)?.[0] ?? ''

    expect(badge).toContain('text-metric-high-700')
    expect(badge).not.toContain('text-metric-high-500')
  })

  it('점수 숫자에는 -500 이 허용된다 — 22px 이상 + weight 900 은 대형 텍스트다', () => {
    const markup = card()

    expect(markup).toContain('text-title-1')
    expect(markup).toContain('font-black')
    expect(markup).toContain('text-metric-high-500')
  })
})

describe('SuitabilityCard — 혼잡도 (명세 D7 #12)', () => {
  it('UNKNOWN 이면 색 배지 대신 문장으로 말한다', () => {
    const markup = card()

    expect(markup).toContain(messages.home.congestionUnknown)
  })

  it('혼잡(HIGH)은 초록이 아니다 — 적합도와 톤이 반대다', () => {
    const markup = card({
      ...suitability,
      congestion: {
        level: { code: 'HIGH', name: '혼잡', description: '붐빌 것으로 예상됩니다.' },
        concentrationRate: 72.4,
      },
    })

    expect(markup).toContain('혼잡')
    // 혼잡 배지가 metric-high(초록) tint 를 쓰면 안 된다.
    // 적합도 배지가 high 라 문서 전체에는 남아 있으므로 혼잡 배지 근처만 본다
    const badge = markup.slice(markup.indexOf('혼잡') - 200, markup.indexOf('혼잡'))
    expect(badge).toContain('metric-low')
  })
})

describe('SuitabilityCard — 링크 (명세 D6)', () => {
  it('제목만 링크다 — 행 전체를 링크로 만들면 펼침 버튼과 중첩된다', () => {
    const markup = card()

    expect(markup.match(/<a /g)).toHaveLength(1)
    expect(markup).toContain(`href="/places/${suitability.placeId}"`)
  })

  it('scoreDelta 숫자를 노출하지 않는다 (D8-2)', () => {
    const markup = card()

    expect(markup).not.toContain('-27')
    expect(markup).not.toContain('27점')
  })
})
