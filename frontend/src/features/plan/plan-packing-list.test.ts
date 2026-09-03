import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PackingListPanel, type PackingListPanelProps } from '@/features/plan/plan-packing-list'
import { messages } from '@/lib/messages'
import type { PackingListItem } from '@/types/ai-plan'

const ITEMS: PackingListItem[] = [
  { category: '필수', name: '리드줄', reason: '야외 장소가 포함돼 이동 중 계속 필요합니다.' },
  {
    category: '날씨 대비',
    name: '휴대용 우비',
    reason: '2일차 강수확률 80% 예보라 야외 일정 중 비를 만날 수 있습니다.',
  },
  { category: '필수', name: '배변봉투', reason: '동반 장소에서 즉시 필요합니다.' },
]

function render(overrides: Partial<PackingListPanelProps> = {}) {
  const props: PackingListPanelProps = {
    items: null,
    pending: false,
    failed: false,
    onGenerate: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PackingListPanel, props))
}

describe('PackingListPanel — 상태 배타성', () => {
  it('만들기 전에는 무엇을 근거로 만드는지 먼저 말한다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.packingIntro)
    expect(markup).toContain(messages.plan.packingCta)
  })

  /*
    동기 API 라 수십 초가 걸릴 수 있다 (컨트롤러 설명). 아무 안내 없이 기다리게 하면
    사용자는 고장으로 읽는다 — 대기 문구가 걸리는 시간을 먼저 말해야 한다.
  */
  it('대기 중에는 걸리는 시간을 함께 알린다', () => {
    const markup = render({ pending: true })

    expect(markup).toContain(messages.plan.packingPending)
    expect(markup).toContain(messages.plan.packingPendingNote)
    expect(markup).not.toContain(messages.plan.packingCta)
  })

  it('실패하면 재시도를 주되 버튼을 두 개 두지 않는다', () => {
    const markup = render({ failed: true })

    expect(markup).toContain(messages.plan.packingErrorTitle)
    expect(markup).not.toContain(messages.plan.packingCta)
  })
})

describe('PackingListPanel — 결과', () => {
  it('이유를 항목마다 그대로 보여 준다 — 이게 이 기능의 핵심이다', () => {
    const markup = render({ items: ITEMS })

    for (const item of ITEMS) {
      expect(markup).toContain(item.name)
      expect(markup).toContain(item.reason)
    }
  })

  /*
    분류는 enum 이 아니라 서버가 주는 문자열이다. 가나다로 정렬하면 "필수" 가 "날씨 대비"
    뒤로 밀린다 — 서버가 보낸 순서가 곧 중요도다.
  */
  it('분류로 묶되 서버 순서를 유지한다', () => {
    const markup = render({ items: ITEMS })

    expect(markup.indexOf('필수')).toBeLessThan(markup.indexOf('날씨 대비'))
  })

  it('같은 분류의 항목이 한 묶음으로 모인다', () => {
    const markup = render({ items: ITEMS })

    // '필수' 는 제목 하나로만 나온다 — 항목마다 반복되지 않는다
    expect(markup.split('>필수<').length - 1).toBe(1)
  })

  /*
    서버가 결과를 보관하지 않는다. 저장된 것으로 오해하면 사용자가 나중에 다시 열어
    보려다 잃는다.
  */
  it('저장되지 않는 제안임을 밝힌다', () => {
    expect(render({ items: ITEMS })).toContain(messages.plan.packingNotSaved)
  })

  /*
    #179 로 `AiPackingProcessor` 가 동행 반려견 전체를 근거로 삼게 되면서 "대표 반려견
    기준이에요" 안내가 거짓이 됐다. 지우고 끝낼 수도 있었지만, 지운 문구는 다음 사람이
    "빠졌나" 하고 되돌리기 쉬운 자리라 없어야 하는 것을 테스트로 고정한다.

    "모든 아이 기준" 으로 바꾸지 않은 이유는 `messages/plan.ts` 주석에 있다 — 특성 조회가
    일부만 성공한 것을 응답이 알려 주지 않는다.
  */
  it('대표 반려견 기준이라고 말하지 않는다', () => {
    const markup = render({ items: ITEMS })

    expect(markup).toContain(messages.plan.packingNotSaved)
    expect(markup).not.toContain('대표 반려견')
  })

  /*
    특정 아이 때문에 필요한 물건은 서버가 이유에 `[반려견 2]` 꼴로 밝힌다 (`AiPlanPromptFactory`
    의 `PACKING_MULTI_PET_RULE`). 합집합이라 근거가 흐려지는 것을 이 접두가 막는데, 화면이
    이유를 손대면 그 단서가 사라진다 — 대괄호가 escape 돼 사라지지 않는 것까지 본다.
  */
  it('이유의 [반려견 N] 접두를 손대지 않는다', () => {
    const reason = '[반려견 2] 더위에 약해 한낮 야외 일정에 쿨매트가 필요합니다.'
    const markup = render({
      items: [{ category: '반려견 케어', name: '쿨매트', reason }],
    })

    expect(markup).toContain(reason)
  })
})
