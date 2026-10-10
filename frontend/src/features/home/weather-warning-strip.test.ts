import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WeatherWarningStrip } from '@/features/home/weather-warning-strip'
import type { WeatherWarningItem } from '@/types/insight'

const HEAT_WAVE: WeatherWarningItem = {
  type: { code: 'HEAT_WAVE', name: '폭염', description: '더위가 심합니다.' },
  level: { code: 'WARNING', name: '경보', description: '기상청이 위험을 경고한 단계입니다.' },
  effectiveAt: '2026-09-09T11:00:00',
}

const render = (warning: WeatherWarningItem | null) =>
  renderToStaticMarkup(createElement(WeatherWarningStrip, { warning }))

describe('WeatherWarningStrip (#349)', () => {
  it('배지와 서버 설명 문장을 함께 그린다', () => {
    const markup = render(HEAT_WAVE)

    expect(markup).toContain('폭염')
    expect(markup).toContain('경보')
    expect(markup).toContain('기상청이 위험을 경고한 단계입니다.')
  })

  /*
    **`type.description` 을 쓰지 않는다.** 판정 근거의 `WEATHER_WARNING_ACTIVE` 문장이
    서버에서 `"{type} {level} 발효 중입니다. {type.description}"` 으로 조립되므로, 여기에
    같은 값을 쓰면 한 화면에서 그 꼬리를 두 번 말하게 된다 — 이 이슈가 없앤 모양이다.
  */
  it('판정 근거 문장과 겹치는 type.description 을 쓰지 않는다', () => {
    expect(render(HEAT_WAVE)).not.toContain('더위가 심합니다.')
  })

  /* 특보가 없는 날이 압도적으로 흔하다 — 그때 빈 줄을 남기지 않는다 */
  it('특보가 없으면 아무것도 렌더하지 않는다', () => {
    expect(render(null)).toBe('')
  })

  /*
    **FE 가 문구를 보태지 않는다** (`docs/styling-guide.md` §7). 그리는 것은 서버 값
    셋뿐이다 — `type.name` · `level.name` · `level.description`. "발효 중이에요" 같은 말을
    여기서 지어내면 판정 근거의 서버 문장과 같은 사실을 두 어투로 말하게 된다.
  */
  it('서버 값 밖의 문장을 지어내지 않는다', () => {
    const markup = render(HEAT_WAVE)

    expect(markup).not.toContain('발효')
  })

  /*
    `level.description` 은 nullable 이다. 없으면 배지만 남고, 빈 `<p>` 를 그리지 않는다.
  */
  it('설명이 없으면 배지만 남는다', () => {
    const markup = render({ ...HEAT_WAVE, level: { ...HEAT_WAVE.level, description: null } })

    expect(markup).toContain('폭염')
    expect(markup).not.toContain('<p')
  })

  /*
    페이지 로드 시점에 이미 있는 내용이라 라이브 리전이 아니다 — `role="alert"` 로 두면
    스크린리더가 읽던 것을 끊는다.
  */
  it('alert 라이브 리전으로 두지 않는다', () => {
    expect(render(HEAT_WAVE)).not.toContain('role="alert"')
  })
})

describe('WeatherWarningStrip — 콘텐츠 컨테이너 (#376)', () => {
  /*
    스트립은 `rail-layout` 밖, 두 열 위에 있다. 레일만 캡하면 1920 에서 이 줄의 글자만
    화면 끝(40px)에 남고 아래 본문은 264px 에서 시작해 **세로 기준선이 꺾인다.**

    헤더와 같은 처리다 — 바는 전폭이라 `border-b` 가 헤더 구분선과 같은 길이로 이어지고,
    안쪽만 캡해 글자가 본문과 같은 세로선에 선다.
  */
  it('바는 전폭이다 — border-b 가 헤더 구분선과 같은 길이로 이어진다', () => {
    const markup = render(HEAT_WAVE)

    expect(markup).toContain('border-b')
    expect(markup).not.toMatch(/<section[^>]*class="[^"]*content-container/)
  })

  it('안쪽 줄이 content-container 로 캡된다', () => {
    expect(render(HEAT_WAVE)).toMatch(/class="content-container/)
  })
})

/**
 * 면을 등급 tint 로 깐다 (#709).
 *
 * 채움이 없던 동안 특보는 아래 본문 카드와 **같은 무게**로 섰다. tint 면 · `-500` 하단선 ·
 * 뒤집은 배지 **셋이 함께** 가야 하고, 하나를 빼면 나머지가 무너진다.
 */
describe('WeatherWarningStrip — 등급 tint 면 (#709)', () => {
  const ADVISORY: WeatherWarningItem = {
    type: { code: 'STRONG_WIND', name: '강풍', description: '바람이 강합니다.' },
    level: {
      code: 'ADVISORY',
      name: '주의보',
      description: '기상 조건이 나빠지고 있습니다. 일정을 조정하는 편이 좋습니다.',
    },
    effectiveAt: '2026-09-18T09:00:00',
  }

  /** `<section>` 열림 태그 — 면과 하단선은 여기 붙는다 (안쪽 줄이 아니다) */
  const bar = (markup: string) => {
    const match = /<section[^>]*>/.exec(markup)

    expect(match).not.toBeNull()
    return match?.[0] ?? ''
  }

  it('주의보는 mid tint 면과 mid 하단선을 함께 쓴다', () => {
    const section = bar(render(ADVISORY))

    expect(section).toContain('bg-metric-mid-100')
    expect(section).toContain('border-metric-mid-500')
  })

  it('경보는 critical tint 면과 critical 하단선을 함께 쓴다', () => {
    const section = bar(render(HEAT_WAVE))

    expect(section).toContain('bg-metric-critical-100')
    expect(section).toContain('border-metric-critical-500')
  })

  /*
    **면이 바뀌면 배지도 같이 바뀐다.** 셋이 한 톤에서 갈라지면 "노란 면 위 빨간 배지" 가
    나온다 — 톤을 스트립에서 한 번만 고르는 이유다.
  */
  it('면과 배지가 같은 톤 계열을 쓴다', () => {
    expect(render(ADVISORY)).not.toContain('metric-critical')
    expect(render(HEAT_WAVE)).not.toContain('metric-mid')
  })

  /*
    **배지가 tint 위에서 뒤집힌다.** 면과 배지 채움이 같은 `-100` 이면 대비 1.00:1 이라
    배지가 사라지고 글자만 남는다 — 채움은 `--bg`, 테두리는 `-500` 이다.
  */
  it('배지가 tint 면 위에서 뒤집힌다 — 같은 색으로 묻히지 않는다', () => {
    const markup = render(ADVISORY)
    const badge = markup.slice(markup.indexOf('<span'))

    expect(badge).toContain('bg-bg')
    expect(badge).toContain('border-metric-mid-500')
    // 배지가 면과 같은 채움을 쓰면 안 된다 — 그 클래스는 `<section>` 에만 있다
    expect(badge).not.toContain('bg-metric-mid-100')
  })

  /*
    **면도 전폭이다.** 안쪽 줄에 칠하면 1920 에서 tint 가 1440 에서 끊기고 그 바깥이 회색
    바닥으로 남아, 전폭으로 이어지는 `border-b` 와 길이가 어긋난다 (#376 과 같은 이유).
  */
  it('면이 안쪽 줄이 아니라 전폭 바에 붙는다', () => {
    const markup = render(ADVISORY)
    const inner = markup.slice(markup.indexOf('content-container'))

    expect(bar(markup)).toContain('bg-metric-mid-100')
    expect(inner).not.toContain('bg-metric-mid-100')
  })

  /*
    §10 — "배지·판정 옆의 장식성 세로 바". 강조를 세로 바로 대신하지 않는다.
  */
  it('세로 강조 바를 쓰지 않는다', () => {
    expect(render(ADVISORY)).not.toMatch(/\bborder-l\b|\bw-1\b/)
  })
})
