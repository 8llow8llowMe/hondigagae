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
