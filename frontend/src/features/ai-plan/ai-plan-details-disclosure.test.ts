import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AiPlanDetailsDisclosure } from '@/features/ai-plan/ai-plan-details-disclosure'
import { messages } from '@/lib/messages'

function render(open: boolean) {
  return renderToStaticMarkup(
    createElement(AiPlanDetailsDisclosure, {
      open,
      summary: '제주 전체 · 예산 상관없음',
      onToggle: () => undefined,
      children: createElement('p', null, '안쪽 내용'),
    }),
  )
}

describe('AiPlanDetailsDisclosure — 접힘/펼침', () => {
  it('접혀 있으면 안쪽 내용을 렌더하지 않는다', () => {
    const html = render(false)

    expect(html).not.toContain('안쪽 내용')
  })

  it('접혀 있으면 요약을 보여 준다', () => {
    expect(render(false)).toContain('제주 전체 · 예산 상관없음')
  })

  it('펼치면 안쪽 내용이 나온다', () => {
    expect(render(true)).toContain('안쪽 내용')
  })

  it('펼치면 요약을 감춘다 — 아래에 실제 값이 있으므로 두 번 말하지 않는다', () => {
    expect(render(true)).not.toContain('제주 전체 · 예산 상관없음')
  })

  it('상태를 보조기술에 알린다', () => {
    expect(render(false)).toContain('aria-expanded="false"')
    expect(render(true)).toContain('aria-expanded="true"')
  })

  it('여는 단추에 라벨이 있다', () => {
    expect(render(false)).toContain(messages.aiPlan.detailsToggle)
  })
})
