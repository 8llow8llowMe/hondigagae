import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayEditor } from '@/features/plan/plan-day-editor'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { messages } from '@/lib/messages'
import { toEditItems } from '@/lib/plan/day-items'
import {
  planDayAdd,
  planDayItemTime,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 일괄 교체 잠금이 버튼에 보인다 — 이슈 #1488 · `일정상세-세부명세.md` D30-4.
 *
 * 잠금(`dayItemsLock`)은 예전에 클릭만 조용히 무시했다. 잠긴 동안 버튼이 `disabled` 로 서는지 본다.
 * 어느 일자를 막는지는 `lib/plan/day-items-lock.test.ts` 가 잠근다 — 여기는 렌더 분기다.
 */

const ROW = { item: planDetail.items[0]!, distanceMeters: null, distanceKind: null }

function renderDaySection(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDaySection, {
      day: 1,
      date: '2026-09-12',
      rows: [ROW],
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
      ...overrides,
    }),
  )
}

function renderEditor(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayEditor, {
      items: toEditItems(planDetail.items),
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
      onSaveWithTimes: () => undefined,
      ...overrides,
    }),
  )
}

/** 보이는 글자가 `label` 인 `<button …>` 여는 태그. 없으면 `undefined` */
function buttonTag(markup: string, label: string): string | undefined {
  return new RegExp(`<button [^>]*>(?:(?!</button>).)*${label}(?:(?!</button>).)*</button>`).exec(
    markup,
  )?.[0]
}

function openingTag(tag: string | undefined): string {
  return /^<button [^>]*>/.exec(tag ?? '')?.[0] ?? ''
}

describe('PlanDaySection — `순서 편집` 잠금 (#1488)', () => {
  it('잠기지 않으면 누를 수 있다', () => {
    const tag = openingTag(buttonTag(renderDaySection(), messages.plan.editDayAction))

    expect(tag).not.toBe('')
    expect(tag).not.toContain('disabled=""')
  })

  it('이 일자 저장이 도는 동안 disabled 로 선다 — 눌러도 반응이 없던 버튼이다', () => {
    const tag = openingTag(
      buttonTag(renderDaySection({ editBlocked: true }), messages.plan.editDayAction),
    )

    expect(tag).toContain('disabled=""')
  })
})

describe('PlanDayEditor — 다른 저장이 도는 동안 (#1488)', () => {
  it('잠기지 않으면 저장을 누를 수 있고 잠긴 이유 줄이 없다', () => {
    const markup = renderEditor()

    expect(openingTag(buttonTag(markup, messages.plan.editSave))).not.toContain('disabled=""')
    expect(markup).not.toContain(messages.plan.editBlockedNote)
  })

  it('저장이 disabled 로 서고 잠긴 이유를 보이는 글자로 말한다', () => {
    const markup = renderEditor({ blocked: true })
    const save = openingTag(buttonTag(markup, messages.plan.editSave))

    expect(save).toContain('disabled=""')
    expect(save).toContain('aria-describedby="plan-edit-blocked"')
    expect(markup).toContain(`id="plan-edit-blocked"`)
    expect(markup).toContain(messages.plan.editBlockedNote)
  })

  it('시각 확인의 두 저장 답도 disabled 다 — 취소는 남는다', () => {
    const markup = renderEditor({ blocked: true, timeRealign: '10:00 → 09:00' })

    expect(openingTag(buttonTag(markup, messages.plan.editTimeRealignAction))).toContain(
      'disabled=""',
    )
    expect(openingTag(buttonTag(markup, messages.plan.editTimeKeepAction))).toContain('disabled=""')
    expect(openingTag(buttonTag(markup, messages.plan.editCancel))).not.toContain('disabled=""')
  })
})
