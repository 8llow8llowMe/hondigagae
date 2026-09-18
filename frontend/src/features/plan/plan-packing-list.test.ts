import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PACKING_PREVIEW_MAX_ITEMS,
  PackingListPanel,
  type PackingListPanelProps,
} from '@/features/plan/plan-packing-list'
import { messages } from '@/lib/messages'
import type { CodeNameMetadata } from '@/types/api'
import type { PlanPackingDetailItem, PlanPackingListResponse } from '@/types/plan'

const AI_SOURCE: CodeNameMetadata = { code: 'AI', name: 'AI', description: null }
const USER_SOURCE: CodeNameMetadata = { code: 'USER', name: '직접 추가', description: null }

function item(
  overrides: Partial<PlanPackingDetailItem> & Pick<PlanPackingDetailItem, 'name'>,
): PlanPackingDetailItem {
  return {
    packingItemId: `id-${overrides.name}`,
    category: '필수',
    reason: '야외 장소가 포함돼 이동 중 계속 필요합니다.',
    source: AI_SOURCE,
    checked: false,
    sortOrder: 0,
    ...overrides,
  }
}

const ITEMS: PlanPackingDetailItem[] = [
  item({ name: '리드줄', sortOrder: 0 }),
  item({
    name: '휴대용 우비',
    category: '날씨 대비',
    reason: '2일차 강수확률 80% 예보라 야외 일정 중 비를 만날 수 있습니다.',
    sortOrder: 1,
  }),
  item({ name: '배변봉투', reason: '동반 장소에서 즉시 필요합니다.', sortOrder: 2 }),
]

/** 저장된 목록 */
function saved(
  items: PlanPackingDetailItem[],
  overrides: Partial<PlanPackingListResponse> = {},
): PlanPackingListResponse {
  return {
    planId: '754304949915095040',
    items,
    totalCount: items.length,
    checkedCount: items.filter((entry) => entry.checked).length,
    generatedAt: '2026-09-14T10:00:00',
    ...overrides,
  }
}

/** 아직 만든 적 없다 — `items` 가 비고 `generatedAt` 이 null 인 갈래 */
const NEVER_GENERATED = saved([], { generatedAt: null })

function render(overrides: Partial<PackingListPanelProps> = {}) {
  const props: PackingListPanelProps = {
    list: NEVER_GENERATED,
    loading: false,
    failed: false,
    onReload: () => undefined,
    generating: false,
    generateFailed: false,
    onGenerate: () => undefined,
    onToggleChecked: () => undefined,
    onRemove: () => undefined,
    onAdd: () => undefined,
    adding: false,
    addError: null,
    actionError: null,
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
    생성은 여전히 동기이고 수십 초가 걸릴 수 있다 (컨트롤러 설명). 저장이 붙어 기다리는
    것이 첫 1회로 줄었을 뿐, 그 1회 동안 사용자가 겪는 일은 전과 같다.
  */
  it('생성 대기 중에는 걸리는 시간을 함께 알린다', () => {
    const markup = render({ generating: true })

    expect(markup).toContain(messages.plan.packingPending)
    expect(markup).toContain(messages.plan.packingPendingNote)
    expect(markup).not.toContain(messages.plan.packingCta)
  })

  it('생성에 실패하면 재시도를 주되 버튼을 두 개 두지 않는다', () => {
    const markup = render({ generateFailed: true })

    expect(markup).toContain(messages.plan.packingErrorTitle)
    expect(markup).not.toContain(messages.plan.packingCta)
  })

  /*
    **조회 실패와 생성 실패는 다른 오류다** (#586). 저장이 붙기 전에는 실패가 생성 하나뿐
    이었다 — 이제 목록을 못 읽는 경우가 따로 생겼고, 그때 `AI로 준비물 챙기기` 를 권하면
    이미 저장된 목록을 덮어쓸 수 있다.
  */
  it('조회에 실패하면 생성을 권하지 않고 다시 읽기를 준다', () => {
    const markup = render({ failed: true, list: null })

    expect(markup).toContain(messages.plan.packingLoadErrorTitle)
    expect(markup).not.toContain(messages.plan.packingCta)
  })

  it('조회 대기 중에는 생성 문구를 먼저 그리지 않는다', () => {
    const markup = render({ loading: true, list: null })

    expect(markup).not.toContain(messages.plan.packingCta)
    expect(markup).not.toContain(messages.plan.packingIntro)
  })
})

/*
  **서버가 "아직 안 만들었다" 와 "만들고 다 지웠다" 를 구분해 주지 않는다.** `generatedAt`
  은 AI 항목이 하나도 없으면 null 이라, 전부 지우면 다시 null 로 돌아간다. 화면이 가르는
  것은 **"AI가 골랐어요" 라고 말해도 되는가** 다.
*/
describe('PackingListPanel — AI 항목이 없을 때', () => {
  it('빈 목록이면 생성을 권한다', () => {
    expect(render({ list: NEVER_GENERATED })).toContain(messages.plan.packingCta)
  })

  /*
    **직접 적어 둔 항목만 있는 목록에 "AI가 골랐어요" 를 붙이면 거짓말이다.**
    그리고 그 사용자에게도 생성 버튼은 남아 있어야 한다 — 아직 AI 를 부른 적이 없다.
  */
  it('직접 추가만 한 목록에는 AI 근거 문장을 붙이지 않고 생성을 권한다', () => {
    const markup = render({
      list: saved([item({ name: '배변봉투', reason: null, source: USER_SOURCE })], {
        generatedAt: null,
      }),
    })

    expect(markup).not.toContain(messages.plan.packingResultBasis)
    expect(markup).toContain(messages.plan.packingCta)
    expect(markup).not.toContain(messages.plan.packingRetryCta)
  })

  it('AI 항목이 있으면 "다시 만들기" 다', () => {
    const markup = render({ list: saved(ITEMS) })

    expect(markup).toContain(messages.plan.packingRetryCta)
    expect(markup).toContain(messages.plan.packingResultBasis)
  })

  /** AI 를 부르기 전에도 직접 적어 둘 수 있어야 한다 */
  it('빈 목록에서도 직접 추가를 열 수 있다', () => {
    expect(render({ list: NEVER_GENERATED })).toContain(messages.plan.packingAddAction)
  })
})

describe('PackingListPanel — 결과', () => {
  it('이유를 항목마다 그대로 보여 준다 — 이게 이 기능의 핵심이다', () => {
    const markup = render({ list: saved(ITEMS) })

    for (const entry of ITEMS) {
      expect(markup).toContain(entry.name)
      expect(markup).toContain(entry.reason)
    }
  })

  /*
    분류는 enum 이 아니라 서버가 주는 문자열이다. 가나다로 정렬하면 "필수" 가 "날씨 대비"
    뒤로 밀린다 — 서버가 보낸 순서가 곧 중요도다.
  */
  it('분류로 묶되 서버 순서를 유지한다', () => {
    const markup = render({ list: saved(ITEMS) })

    expect(markup.indexOf('필수')).toBeLessThan(markup.indexOf('날씨 대비'))
  })

  it('같은 분류의 항목이 한 묶음으로 모인다', () => {
    const markup = render({ list: saved(ITEMS) })

    // '필수' 는 제목 하나로만 나온다 — 항목마다 반복되지 않는다
    expect(markup.split('>필수<').length - 1).toBe(1)
  })

  /*
    특정 아이 때문에 필요한 물건은 서버가 이유에 `[반려견 2]` 꼴로 밝힌다
    (`AiPlanPromptFactory` 의 `PACKING_MULTI_PET_RULE`). 화면이 이유를 손대면 그 단서가
    사라진다 — 대괄호가 escape 돼 사라지지 않는 것까지 본다.
  */
  it('이유의 [반려견 N] 접두를 손대지 않는다', () => {
    const reason = '[반려견 2] 더위에 약해 한낮 야외 일정에 쿨매트가 필요합니다.'
    const markup = render({
      list: saved([item({ name: '쿨매트', category: '반려견 케어', reason })]),
    })

    expect(markup).toContain(reason)
  })

  /*
    #179 로 `AiPackingProcessor` 가 동행 반려견 전체를 근거로 삼게 되면서 "대표 반려견
    기준이에요" 안내가 거짓이 됐다. 지운 문구는 다음 사람이 "빠졌나" 하고 되돌리기 쉬운
    자리라 없어야 하는 것을 테스트로 고정한다.
  */
  it('대표 반려견 기준이라고 말하지 않는다', () => {
    expect(render({ list: saved(ITEMS) })).not.toContain('대표 반려견')
  })

  it('챙김 수를 목록과 같은 수로 말한다', () => {
    const markup = render({ list: saved([item({ name: '리드줄', checked: true }), ITEMS[1]!]) })

    expect(markup).toContain(
      messages.plan.packingCheckedSummary.replace('{checked}', '1').replace('{total}', '2'),
    )
  })

  /** 항목마다 지울 수 있어야 하고, icon-only 버튼은 이름을 `aria-label` 로 갖는다 (D6) */
  it('항목마다 삭제 버튼이 이름을 갖는다', () => {
    const markup = render({ list: saved(ITEMS) })

    expect(markup).toContain(messages.plan.packingRemoveLabel.replace('{name}', '리드줄'))
  })
})

/*
  **#586.** 저장이 붙으면서 화면이 말해야 할 사실이 뒤집혔다. `packingNotSaved`
  ("저장되지 않는 제안이에요") 는 **거짓말이 됐으므로 지웠다** — 지운 문구는 다음 사람이
  되돌리기 쉬운 자리라 테스트로 고정한다.
*/
describe('PackingListPanel — 저장된다는 사실을 말한다 (#586)', () => {
  it('"저장되지 않는다" 는 어느 상태에서도 나오지 않는다', () => {
    const denials = ['저장되지 않는', '화면을 벗어나면 사라져요']

    for (const markup of [render(), render({ list: saved(ITEMS) })]) {
      for (const denial of denials) expect(markup).not.toContain(denial)
    }
  })

  it('만들기 전에도 결과에서도 저장된다고 말한다', () => {
    expect(render()).toContain(messages.plan.packingSavedNote)
    expect(render({ list: saved(ITEMS) })).toContain(messages.plan.packingSavedNote)
  })

  /*
    서버가 AI 항목만 교체하고 사용자 항목·같은 이름의 체크는 승계한다. 그것을 말하지
    않으면 짐을 반쯤 싸 둔 사람이 `다시 만들기` 를 누르지 못한다.
  */
  it('다시 만들기 옆에서 무엇이 지워지지 않는지 말한다', () => {
    expect(render({ list: saved(ITEMS) })).toContain(messages.plan.packingRegenerateNote)
  })

  /** 직접 추가한 항목은 이유가 null 이다 — 빈 자리로 두지 않고 그것이 실패가 아님을 말한다 */
  it('직접 추가한 항목을 따로 밝히고 이유 자리를 비우지 않는다', () => {
    const markup = render({
      list: saved([item({ name: '배변봉투', reason: null, source: USER_SOURCE })]),
    })

    expect(markup).toContain(messages.plan.packingUserBadge)
    expect(markup).toContain(messages.plan.packingUserNoReason)
  })
})

/*
  **#397.** 이 절이 접었다 펴는 토글처럼 읽혀 **서비스의 AI 기능 하나가 부가 기능으로
  보였다.** 여기서 지키는 것은 **세 상태 전부가 AI 를 말하는가** 다 — 하나라도 빠지면
  그 상태에 들어온 사용자에게는 여전히 체크리스트다.
*/
describe('PackingListPanel — AI 산출물임을 말한다 (#397)', () => {
  it('제목 옆에 AI 배지가 선다 — 헤더 nav 와 같은 낱말이다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.packingAiBadge)
    // accent 는 "AI 가 생성·판단한 것" 표시 전용이다 (DESIGN.md §2-5)
    expect(markup).toContain('bg-accent-100')
  })

  it('만들기 전 안내가 AI 를 주어로 말한다', () => {
    expect(messages.plan.packingIntro).toContain('AI')
    expect(render()).toContain(messages.plan.packingIntro)
  })

  /*
    이 문장이 CTA 를 누를지 정하는 유일한 근거다. caption 톤으로 흐려 두면
    절이 토글처럼 읽힌다 — 그것이 이 이슈의 원인이었다.
  */
  it('만들기 전 안내를 흐리게 두지 않는다', () => {
    const line = new RegExp(`<p class="([^"]*)">${messages.plan.packingIntro}`).exec(render())?.[1]

    expect(line).toBeDefined()
    expect(line).toContain('text-body-2')
    expect(line).not.toContain('text-fg-muted')
    expect(line).not.toContain('text-caption')
  })

  it('CTA 가 무엇이 만들어지는지 말한다', () => {
    expect(messages.plan.packingCta).toContain('AI')
    expect(render()).toContain(messages.plan.packingCta)
  })

  it('대기 문구도 AI 가 무엇을 하는 중인지 말한다', () => {
    const markup = render({ generating: true })

    expect(messages.plan.packingPending).toContain('AI')
    expect(markup).toContain(messages.plan.packingPending)
  })

  it('결과 머리에서 무엇에 근거한 목록인지 다시 못박는다', () => {
    const markup = render({ list: saved(ITEMS) })

    expect(markup).toContain(messages.plan.packingResultBasis)
    expect(messages.plan.packingResultBasis).toContain('AI')
  })

  /*
    **이유는 이 기능이 다른 체크리스트와 다른 유일한 지점인데 가장 작은 글자였다.**
    품목 이름보다 크게 두지는 않는다 — 챙기는 것은 품목이고 이유는 그 근거다.

    **그래서 `Checkbox` 의 `description` 에 넘기지 않는다** — 그 자리는 `text-caption`
    으로 고정돼 있어 넘기는 순간 #397 이 되돌려진다.
  */
  it('이유를 caption 이 아니라 body-2 로 둔다 — 품목 이름과 크기가 같고 톤으로만 갈린다', () => {
    const markup = render({ list: saved(ITEMS) })
    const reason = ITEMS[0]?.reason as string
    const cls = new RegExp(`<span class="([^"]*)">${reason}`).exec(markup)?.[1]

    expect(cls).toBeDefined()
    expect(cls).toContain('text-body-2')
    expect(cls).not.toContain('text-caption')
    // 품목 이름(체크박스 라벨)도 body-2 다 — 톤만 다르다
    expect(markup).toContain(`<span class="text-body-2 text-fg">${ITEMS[0]?.name}</span>`)
  })
})

/**
 * 요약 모드 (#732 · 진단 665-3).
 *
 * 승격된 자리에서 이 카드가 답해야 하는 것은 *"짐을 얼마나 쌌는가"* 다 — 목록 전체를
 * 펴면 그날의 다른 과업(브리핑)이 아래로 밀린다.
 */
describe('PackingListPanel — 요약 모드 (#732)', () => {
  const MANY = Array.from({ length: PACKING_PREVIEW_MAX_ITEMS + 2 }, (_, index) =>
    item({ name: `준비물 ${index}`, sortOrder: index, checked: index < 3 }),
  )

  it('진행률을 문장 한 줄로 먼저 말한다', () => {
    const markup = render({ preview: true, list: saved(MANY) })

    expect(markup).toContain(
      messages.plan.packingProgress
        .replace('{total}', String(MANY.length))
        .replace('{checked}', '3'),
    )
  })

  it('항목을 다섯까지만 직접 보여 준다', () => {
    const markup = render({ preview: true, list: saved(MANY) })

    expect(markup).toContain('준비물 0')
    expect(markup).toContain(`준비물 ${PACKING_PREVIEW_MAX_ITEMS - 1}`)
    expect(markup).not.toContain(`준비물 ${PACKING_PREVIEW_MAX_ITEMS}`)
  })

  /* 요약이 읽기 전용이면 짐을 싸면서 체크하려고 매번 펴야 한다 */
  it('요약에서도 체크할 수 있다', () => {
    const markup = render({ preview: true, list: saved(MANY) })

    expect(markup).toContain('type="checkbox"')
  })

  /*
    **이 버튼이 여는 것은 나머지 항목만이 아니다** — 재생성·직접 추가도 그 뒤에 있다.
    다섯 개짜리 목록에서 버튼이 사라지면 승격된 동안 준비물을 더할 방법이 없어진다.
  */
  it('항목이 다섯 이하여도 전체 보기가 남는다', () => {
    const markup = render({ preview: true, list: saved(ITEMS) })

    expect(markup).toContain(messages.plan.packingExpandAction)
  })

  it('접힌 동안에는 도구와 긴 안내를 세우지 않는다 — 카드가 개요보다 길어지지 않게', () => {
    const markup = render({ preview: true, list: saved(MANY) })

    expect(markup).not.toContain(messages.plan.packingAddAction)
    expect(markup).not.toContain(messages.plan.packingRegenerateNote)
  })

  it('요약 모드가 아니면 예전 그대로다 — 분류 머리와 도구가 함께 선다', () => {
    const markup = render({ list: saved(MANY) })

    expect(markup).toContain(`준비물 ${PACKING_PREVIEW_MAX_ITEMS}`)
    expect(markup).toContain(messages.plan.packingAddAction)
    expect(markup).not.toContain(messages.plan.packingExpandAction)
  })
})
