import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDaySection } from '@/features/plan/plan-day-section'
import {
  PLAN_ITEM_MEMO_INPUT_ID,
  PlanItemMemoEditView,
  type PlanItemMemoEditViewProps,
} from '@/features/plan/plan-item-memo-edit-view'
import { PlanItemRow } from '@/features/plan/plan-item-row'
import { messages } from '@/lib/messages'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import { ITEM_MEMO_MAX } from '@/lib/plan/item-memo-edit'
import {
  planDayAdd,
  planDayItemTime,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 항목 메모 고치기 · 지우기 — 이슈 #1460 · `일정상세-세부명세.md` D30.
 *
 * 본문 조립(다른 필드를 잃지 않는다) · 검증 · 다녀옴 되살리기는 `lib/plan/item-memo-edit.test.ts`
 * 가 잠근다 — 여기는 진입점과 모달의 렌더 분기다. 메모 표시(#1448)는 `plan-item-memo.test.ts`.
 */
const MEMO = '아침 산책으로 바다 감상해요'
const TITLE = planDetail.items[0]!.title

function model(memo: string | null): PlanItemRowModel {
  return { item: { ...planDetail.items[0]!, memo }, distanceMeters: null, distanceKind: null }
}

function renderRow(memo: string | null, withEdit = true) {
  return renderToStaticMarkup(
    createElement(PlanItemRow, {
      model: model(memo),
      ...(withEdit ? { memoEdit: { onOpen: () => undefined, focusKey: '1:0' } } : {}),
    }),
  )
}

function renderDaySection(itemMemo?: { onOpen: (planItemId: string) => void }) {
  return renderToStaticMarkup(
    createElement(PlanDaySection, {
      day: 1,
      date: '2026-09-12',
      rows: [model(MEMO)],
      places: new Map<string, PlaceDetail>(),
      verdict: undefined,
      petConditionApplied: true,
      basisPetName: null,
      verdictFailed: false,
      onRetryVerdict: () => undefined,
      editing: false,
      onStartEdit: () => undefined,
      editor: null,
      add: planDayAdd,
      visit: planDayVisit,
      walkSafety: planDayWalkSafety,
      itemTime: planDayItemTime,
      regenerateHref: null,
      ...(itemMemo === undefined ? {} : { itemMemo }),
    }),
  )
}

const BASE: PlanItemMemoEditViewProps = {
  open: true,
  onClose: () => undefined,
  title: '협재해수욕장',
  value: MEMO,
  onValueChange: () => undefined,
  hasMemo: true,
  fieldError: null,
  formError: null,
  saving: false,
  blocked: false,
  onSubmit: () => undefined,
  onClear: () => undefined,
}

function renderModal(overrides: Partial<PlanItemMemoEditViewProps> = {}) {
  return renderToStaticMarkup(createElement(PlanItemMemoEditView, { ...BASE, ...overrides }))
}

describe('PlanItemRow — 메모 수정 진입점 (#1460)', () => {
  it('메모가 있는 행에 `메모 수정` 이 선다', () => {
    expect(renderRow(MEMO)).toContain(`>${messages.plan.itemMemoEdit}</`)
  })

  it('접근 이름이 어느 항목인지 말하고 모달을 연다고 알린다', () => {
    const markup = renderRow(MEMO)

    expect(markup).toContain(
      `aria-label="${messages.plan.itemMemoEditLabel.replace('{title}', TITLE)}"`,
    )
    expect(markup).toContain('aria-haspopup="dialog"')
  })

  it('저장 뒤 초점을 돌려받을 표식을 단다', () => {
    expect(renderRow(MEMO)).toContain('data-plan-memo-edit="1:0"')
  })

  it('메모가 없는 행에는 진입점이 없다 (D30-1)', () => {
    expect(renderRow(null)).not.toContain(messages.plan.itemMemoEdit)
  })

  it('진입점을 넘기지 않으면(기간 밖 항목 섹션) 버튼이 없다', () => {
    expect(renderRow(MEMO, false)).not.toContain(messages.plan.itemMemoEdit)
  })

  it('늘린 링크 위에 서야 눌린다 — z-10', () => {
    expect(renderRow(MEMO)).toMatch(/class="[^"]*z-10[^"]*"[^>]*data-plan-memo-edit/)
  })

  it('메모 문단보다 아래에 선다 — 읽은 자리에서 고친다', () => {
    const markup = renderRow(MEMO)

    expect(markup.indexOf(MEMO)).toBeLessThan(markup.indexOf(messages.plan.itemMemoEdit))
  })
})

describe('PlanDaySection — 메모 수정 배선 (#1460)', () => {
  it('itemMemo 를 넘기면 행에 일자 · 순서 표식이 달린 진입점이 선다', () => {
    const markup = renderDaySection({ onOpen: () => undefined })

    expect(markup).toContain('data-plan-memo-edit="1:0"')
  })

  it('넘기지 않으면 진입점이 없다', () => {
    expect(renderDaySection()).not.toContain('data-plan-memo-edit')
  })
})

describe('PlanItemMemoEditView (#1460)', () => {
  it('제목이 어느 항목의 메모인지 말하고 지우는 길을 설명한다', () => {
    const markup = renderModal()

    expect(markup).toContain(messages.plan.itemMemoModalTitle.replace('{title}', '협재해수욕장'))
    expect(markup).toContain(messages.plan.itemMemoModalDescription)
  })

  it('여러 줄 입력에 지금 메모가 들어 있고 라벨이 붙는다', () => {
    const markup = renderModal()

    expect(markup).toMatch(new RegExp(`<textarea[^>]*id="${PLAN_ITEM_MEMO_INPUT_ID}"`))
    expect(markup).toContain(`for="${PLAN_ITEM_MEMO_INPUT_ID}"`)
    expect(markup).toContain(MEMO)
  })

  it('계약 상한(500)을 입력이 막는다', () => {
    expect(renderModal()).toContain(`maxLength="${ITEM_MEMO_MAX}"`)
  })

  it('저장된 메모가 있으면 `메모 지우기` 가 선다', () => {
    expect(renderModal()).toContain(messages.plan.itemMemoClear)
  })

  it('저장된 메모가 없으면 `메모 지우기` 가 없다', () => {
    expect(renderModal({ hasMemo: false })).not.toContain(messages.plan.itemMemoClear)
  })

  it('필드 오류를 입력에 붙인다', () => {
    const markup = renderModal({ fieldError: messages.plan.itemMemoTooLong })

    expect(markup).toContain(messages.plan.itemMemoTooLong)
    expect(markup).toContain('aria-invalid="true"')
  })

  it('저장 실패 문구를 배너로 남긴다', () => {
    expect(renderModal({ formError: messages.plan.itemMemoErrorDescription })).toContain(
      messages.plan.itemMemoErrorDescription,
    )
  })

  it('저장 중에는 입력이 읽기 전용이다 — 초점을 잃지 않는다', () => {
    expect(renderModal({ saving: true })).toMatch(/<textarea[^>]*readOnly=""/)
  })

  it('다른 일자 저장이 도는 중이면 저장 · 지우기를 잠근다', () => {
    const markup = renderModal({ blocked: true })

    expect(markup).toMatch(
      new RegExp(`<button[^>]*disabled=""[^>]*>${messages.plan.itemMemoClear}</button>`),
    )
  })
})
