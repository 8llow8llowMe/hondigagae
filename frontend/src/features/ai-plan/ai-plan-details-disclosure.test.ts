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

  /*
    패널은 조건부 렌더라 접힌 동안 그 id 가 DOM 에 없다. `aria-controls` 를 무조건 달면
    없는 것을 가리키는 단추가 된다 (`place-walk-safety-panel.tsx` 가 못박은 규칙).
  */
  it('접혀 있으면 aria-controls 를 달지 않는다', () => {
    expect(render(false)).not.toContain('aria-controls')
    expect(render(true)).toContain('aria-controls')
  })

  /*
    **`h2` → `h3` 다** (#473). 3층 표면으로 옮기며 폼 전체가 `Surface` 카드 안에 들어갔고
    그 카드가 `AI 일정 만들기` `<h2>` 를 그린다 — 여기가 `h2` 로 남으면 카드 제목의
    형제가 되어, 카드 안의 한 구역일 뿐인 접기가 카드와 같은 무게로 읽힌다.
    지금 순서는 h1(`sr-only`) → h2(카드) → h3(접기) → h4(`AiPlanOptionsSection`)다.

    클래스는 보지 않는다 — 여기서 지키려는 것은 레이아웃이 아니라 제목 단계다.
  */
  it('머리글이 h3 로 선다 — 카드 h2 아래 한 단계다', () => {
    expect(render(false)).toMatch(/<h3[^>]*><button/)
    expect(render(true)).toMatch(/<h3[^>]*><button/)
  })

  /* 카드 제목과 같은 레벨로 되돌아가지 않는다 */
  it('머리글이 h2 가 아니다', () => {
    expect(render(false)).not.toContain('<h2')
    expect(render(true)).not.toContain('<h2')
  })
})
