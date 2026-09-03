import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkVerdict } from '@/features/home/walk-verdict'
import { walkSafety } from '@/test/fixtures/insight'
import type { WalkSafetyResponse, WeatherWarningItem } from '@/types/insight'

const HEAT_WAVE_WARNING: WeatherWarningItem = {
  type: { code: 'HEAT_WAVE', name: '폭염', description: '더위가 심합니다.' },
  level: { code: 'WARNING', name: '경보', description: '기상청이 위험을 경고한 단계입니다.' },
  effectiveAt: '2026-08-29T11:00:00',
}

function render(data: WalkSafetyResponse) {
  return renderToStaticMarkup(createElement(WalkVerdict, { data, petName: '몽실이' }))
}

describe('WalkVerdict — 기상특보', () => {
  it('특보가 없으면 배지가 없다', () => {
    expect(render(walkSafety)).not.toContain('경보')
  })

  /*
    데스크톱 등급 줄은 `md:flex` 라 모바일에서 아예 렌더되지 않는다. 접힌 모바일 한 줄에도
    배지가 있어야 이 서비스에서 가장 흔한 화면이 특보를 말한다.
  */
  it('모바일 접힌 줄과 데스크톱 등급 줄 양쪽에 배지가 온다', () => {
    const markup = render({ ...walkSafety, weatherWarning: HEAT_WAVE_WARNING })
    const occurrences = markup.split('폭염').length - 1

    expect(occurrences).toBe(2)
  })

  /*
    배지는 근거 문장을 대체하지 않는다 — 서버가 보내는 `WEATHER_WARNING_ACTIVE` 문장이
    무엇을 조심해야 하는지 말하고, 배지는 그 사실을 문단 밖으로 올릴 뿐이다.
  */
  it('배지가 근거 목록을 대체하지 않는다', () => {
    const markup = render({
      ...walkSafety,
      weatherWarning: HEAT_WAVE_WARNING,
      reasons: [
        {
          code: 'WEATHER_WARNING_ACTIVE',
          name: '기상특보 발효',
          description: '폭염 경보 발효 중입니다. 더위가 심합니다.',
        },
      ],
    })

    expect(markup).toContain('폭염 경보 발효 중입니다.')
  })
})
