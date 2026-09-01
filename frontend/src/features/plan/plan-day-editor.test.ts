import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayEditor } from '@/features/plan/plan-day-editor'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { messages } from '@/lib/messages'
import { toEditItems, toggleRemoved } from '@/lib/plan/day-items'
import {
  planAlternative,
  planDayAdd,
  planDayVisit,
  planDetail,
  planVerdict,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

const ITEMS = toEditItems(planDetail.items)

function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayEditor, {
      items: ITEMS,
      dirty: true,
      saving: false,
      error: null,
      announcement: '',
      focusTarget: null,
      onClearFocus: () => undefined,
      onMove: () => undefined,
      onToggleRemoved: () => undefined,
      onSave: () => undefined,
      onCancel: () => undefined,
      ...overrides,
    }),
  )
}

describe('PlanDayEditor — 편집 중 화면', () => {
  it('저장 전에는 아무것도 바뀌지 않는다고 말한다 — 낙관적 업데이트를 하지 않는다', () => {
    expect(render()).toContain(messages.plan.editHint)
  })

  it('거리 숫자 대신 안내 문장이 온다 — 순서를 옮길 때마다 숫자가 흔들리면 안 된다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.editDistanceNote)
    expect(markup).not.toContain('직선')
  })

  it('순서가 뜻을 갖는 목록이라 ol 이다', () => {
    expect(render()).toContain('<ol')
  })

  it('이동 버튼에 접근 가능한 이름이 있다', () => {
    const markup = render()

    expect(markup).toContain(`aria-label="${messages.plan.editMoveUp}"`)
    expect(markup).toContain(`aria-label="${messages.plan.editMoveDown}"`)
  })

  it('맨 위의 위로 이동과 맨 아래의 아래로 이동은 잠긴다', () => {
    // 2개짜리 목록이라 disabled 가 정확히 2개(첫 행 위 / 마지막 행 아래)여야 한다
    const markup = render()
    const disabledCount = markup.split('disabled=""').length - 1

    expect(ITEMS).toHaveLength(2)
    expect(disabledCount).toBe(2)
  })

  it('삭제 표시는 취소선과 문구로 이중 전달한다 — 색·선만으로 알리지 않는다', () => {
    const markup = render({ items: toggleRemoved(ITEMS, 0) })

    expect(markup).toContain('line-through')
    expect(markup).toContain(messages.plan.editRemoveMark)
    expect(markup).toContain(messages.plan.editRestore)
  })

  it('삭제해도 목록에서 빼지 않는다 — 복구가 자리를 잃지 않게', () => {
    const markup = render({ items: toggleRemoved(ITEMS, 0) })

    expect(markup).toContain(planDetail.items[0]?.title as string)
  })

  it('조회되지 않는 항목을 편집 진입 시 미리 짚는다 (PLAN_004 후보)', () => {
    // 장소를 가리키는데 `place` 가 비었다 — delisting 이거나 tour-service 장애다 (#115)
    const markup = render({ items: toEditItems([{ ...planDetail.items[0]!, place: null }]) })

    expect(markup).toContain(messages.plan.editMissingPlaceMark)
  })

  it('요약이 온 항목에는 붙이지 않는다 — 멀쩡한 행을 문제처럼 보이게 하지 않는다', () => {
    expect(render()).not.toContain(messages.plan.editMissingPlaceMark)
  })

  it('WALK 는 place 가 비어도 짚지 않는다 — 애초에 물어볼 장소가 없다', () => {
    const walk = {
      ...planDetail.items[0]!,
      itemType: { code: 'WALK', name: '산책', description: null },
      place: null,
    }

    expect(render({ items: toEditItems([walk]) })).not.toContain(messages.plan.editMissingPlaceMark)
  })

  it('변경이 없으면 저장을 잠그고 그 이유를 aria-describedby 로 준다', () => {
    const markup = render({ dirty: false })

    expect(markup).toContain('aria-describedby="plan-edit-no-changes"')
    expect(markup).toContain(messages.plan.editNoChanges)
  })

  it('변경이 있으면 이유 문구를 내지 않는다', () => {
    expect(render()).not.toContain(messages.plan.editNoChanges)
  })

  it('이동·삭제를 aria-live 로 알린다', () => {
    const markup = render({ announcement: '2번째로 이동했어요' })

    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('2번째로 이동했어요')
  })
})

describe('PlanDayEditor — 저장 실패', () => {
  it('5xx 는 다시 시도할 수 있다고 말하고 편집 내용이 남아 있음을 알린다', () => {
    const markup = render({
      error: { message: messages.plan.editSaveErrorDescription, retriable: true },
    })

    expect(markup).toContain(messages.plan.editSaveErrorTitle)
    expect(markup).toContain('편집한 내용은 그대로 있어요')
    // 저장 버튼이 살아 있어야 다시 시도할 수 있다
    expect(markup).toContain(messages.plan.editSave)
  })

  it('PLAN_004 는 재시도를 권하지 않는다 — 같은 본문이 같은 400 을 받는다', () => {
    const markup = render({
      error: { message: messages.plan.editMissingPlaceError, retriable: false },
    })

    expect(markup).toContain('목록에서 빼면 저장할 수 있어요')
    expect(markup).not.toContain(messages.plan.editSaveErrorTitle)
  })

  it('실패해도 편집 목록이 그대로 남는다', () => {
    const markup = render({
      error: { message: messages.plan.editMissingPlaceError, retriable: false },
    })

    expect(markup).toContain(planDetail.items[0]?.title as string)
    expect(markup).toContain(planDetail.items[1]?.title as string)
  })
})

describe('PlanDaySection — 편집 진입', () => {
  function renderSection(overrides: Record<string, unknown> = {}) {
    return renderToStaticMarkup(
      createElement(PlanDaySection, {
        day: 1,
        date: '2026-09-12',
        rows: [{ item: planDetail.items[0]!, distanceMeters: 4100, distanceKind: 'previous' }],
        places: new Map<string, PlaceDetail>(),
        verdict: {
          ...planVerdict,
          indoorAlternatives: [planAlternative({ placeId: '212481712381923330', title: '오설록' })],
        },
        petConditionApplied: true,
        verdictFailed: false,
        onRetryVerdict: () => undefined,
        editing: false,
        onStartEdit: () => undefined,
        editor: null,
        add: planDayAdd,
        visit: planDayVisit,
        ...overrides,
      }),
    )
  }

  it('항목이 있으면 순서 편집 버튼을 낸다', () => {
    expect(renderSection()).toContain(messages.plan.editDayAction)
  })

  it('항목이 0개면 순서 편집을 내지 않는다 — 바꿀 순서가 없다', () => {
    expect(renderSection({ rows: [] })).not.toContain(messages.plan.editDayAction)
  })

  it('편집 중에는 순서 편집 버튼과 거리 숫자가 사라지고 editor 가 들어간다', () => {
    const markup = renderSection({
      editing: true,
      editor: createElement('p', null, '편집 중입니다'),
    })

    expect(markup).toContain('편집 중입니다')
    expect(markup).not.toContain(messages.plan.editDayAction)
    expect(markup).not.toContain('직선 4.1km')
  })

  it('편집 중에는 실내 대안 블록을 감춘다 — 다른 조작을 섞지 않는다', () => {
    expect(renderSection()).toContain(messages.plan.indoorAlternativesTitle)
    expect(renderSection({ editing: true, editor: null })).not.toContain(
      messages.plan.indoorAlternativesTitle,
    )
  })
})
