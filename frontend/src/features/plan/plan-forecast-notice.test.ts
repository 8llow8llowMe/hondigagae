import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanForecastNotice } from '@/features/plan/plan-forecast-notice'
import { messages } from '@/lib/messages'

const VERDICT_BEYOND = '예보는 오늘부터 11일까지만 제공되어 이 날짜는 아직 알려 드릴 수 없습니다.'
const WALK_BEYOND =
  '산책 위험도는 시각별 예보로만 안내할 수 있고, 그 예보는 오늘부터 5일까지입니다. 이 날짜는 아직 알려 드릴 수 없습니다.'

describe('PlanForecastNotice — 일정 상단 예보 안내 (#1426)', () => {
  it('머리 한 줄 아래 서버 문장을 하나씩 그대로 세운다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanForecastNotice, { sentences: [VERDICT_BEYOND, WALK_BEYOND] }),
    )

    expect(markup).toContain(messages.plan.forecastNoticeTitle)
    expect(markup.split(VERDICT_BEYOND)).toHaveLength(2)
    expect(markup.split(WALK_BEYOND)).toHaveLength(2)
    expect(markup.indexOf(messages.plan.forecastNoticeTitle)).toBeLessThan(
      markup.indexOf(VERDICT_BEYOND),
    )
  })

  it('경보가 아니다 — 아이콘은 중립색이고 danger 를 쓰지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanForecastNotice, { sentences: [VERDICT_BEYOND] }),
    )

    expect(markup).toContain('text-fg-muted')
    expect(markup).not.toContain('danger')
  })
})
