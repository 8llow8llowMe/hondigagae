import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import type { WeatherWarningItem } from '@/types/insight'

function warning(levelCode: string, typeName = '폭염'): WeatherWarningItem {
  return {
    type: { code: 'HEAT_WAVE', name: typeName, description: '더위가 심합니다.' },
    level: {
      code: levelCode,
      name: levelCode === 'ADVISORY' ? '주의보' : '경보',
      description: null,
    },
    effectiveAt: '2026-08-29T06:00:00',
  }
}

function render(item: WeatherWarningItem | null) {
  return renderToStaticMarkup(createElement(WeatherWarningBadge, { warning: item }))
}

function renderOnTint(item: WeatherWarningItem) {
  return renderToStaticMarkup(
    createElement(WeatherWarningBadge, { warning: item, surface: 'tint' }),
  )
}

describe('WeatherWarningBadge', () => {
  it('특보가 없으면 아무것도 그리지 않는다 — 흔한 경우에 빈 자리를 남기지 않는다', () => {
    expect(render(null)).toBe('')
  })

  it('종류와 단계를 함께 쓴다 — 색만으로 정보를 전달하지 않는다 (DESIGN.md §2-3)', () => {
    const markup = render(warning('WARNING'))

    expect(markup).toContain('폭염')
    expect(markup).toContain('경보')
  })

  it('경보와 주의보의 톤이 다르다', () => {
    expect(render(warning('WARNING'))).toContain('metric-critical')
    expect(render(warning('ADVISORY'))).toContain('metric-mid')
  })

  /*
    백엔드 `WeatherWarningLevel.from` 이 못 알아본 문구를 낮은 쪽으로 접지 않는 것과 같은
    규칙이다. 표기가 바뀌었을 뿐인데 태풍경보를 주의보 색으로 그리면 위험을 축소해 말한다.
  */
  it('모르는 단계 코드는 경보로 읽는다', () => {
    expect(render(warning('SOMETHING_NEW'))).toContain('metric-critical')
  })

  /*
    원천이 코드가 아니라 문구를 주기 때문에 표기가 조금만 바뀌어도 OTHER 가 된다.
    그때 배지를 숨기면 특보가 떠 있는데 없다고 말하게 된다.
  */
  it('못 알아본 종류(OTHER)도 감추지 않는다', () => {
    const other: WeatherWarningItem = {
      type: { code: 'OTHER', name: '기타 특보', description: '기상특보가 발효 중입니다.' },
      level: { code: 'ADVISORY', name: '주의보', description: null },
      effectiveAt: null,
    }

    expect(render(other)).toContain('기타 특보')
  })
})

/**
 * 같은 톤의 tint 면 위에 설 때 (#709).
 *
 * 홈 특보 스트립이 `-100` 면을 깔면서, 배지가 **자기와 같은 색** 위에 서게 됐다 —
 * 대비 1.00:1 이라 배지가 사라지고 글자만 남는다. 면과 채움을 맞바꾼다.
 */
describe('WeatherWarningBadge — tint 면 위 (#709)', () => {
  it('채움을 --bg 로 두고 테두리로 톤을 말한다', () => {
    const markup = renderOnTint(warning('ADVISORY'))

    expect(markup).toContain('bg-bg')
    expect(markup).toContain('border-metric-mid-500')
    // 면과 같은 채움을 쓰면 묻힌다
    expect(markup).not.toContain('bg-metric-mid-100')
  })

  it('경보도 같은 방식으로 뒤집힌다', () => {
    const markup = renderOnTint(warning('WARNING'))

    expect(markup).toContain('border-metric-critical-500')
    expect(markup).not.toContain('bg-metric-critical-100')
  })

  /* 글자는 어느 면에서나 `-700` 이다 — 뒤집기가 대비를 깎지 않는다 (contrast.test.ts) */
  it('글자 색은 -700 그대로다', () => {
    expect(renderOnTint(warning('ADVISORY'))).toContain('text-metric-mid-700')
  })

  /* 기본은 그대로다 — 다른 호출부 7곳이 이 갈래를 쓴다 */
  it('surface 를 주지 않으면 기존 tint 채움이다', () => {
    expect(render(warning('ADVISORY'))).toContain('bg-metric-mid-100')
  })
})
