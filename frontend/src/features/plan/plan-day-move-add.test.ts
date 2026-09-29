import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  guardClose,
  PlanDayMoveAddView,
  type PlanDayMoveAddViewProps,
} from '@/features/plan/plan-day-move-add-view'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { messages } from '@/lib/messages'
import { ITEM_TITLE_MAX } from '@/lib/plan/day-items'
import {
  planDayAdd,
  planDayItemTime,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 이동·휴식 직접 추가 — 이슈 #1014 · `일자편집-세부명세.md` H6.
 *
 * **파일을 따로 둔다.** 일자 카드의 다른 액션 테스트(`plan-day-section.test.ts`)와 섞으면
 * 액션 줄을 고치는 다른 변경과 같은 자리를 다툰다. 검증 로직(`validateMoveTitle`)과 본문
 * 조립(`appendMoveItemPayload`)은 `lib/plan/day-items.test.ts` 가 잠근다 — 여기는 렌더 분기다.
 */

const ROW = { item: planDetail.items[0]!, distanceMeters: null, distanceKind: null }

function renderDaySection(overrides = {}) {
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

/** 라벨이 정확히 `label` 인 `<button …>` 여는 태그. 없으면 `undefined` */
function buttonTag(markup: string, label: string): string | undefined {
  return new RegExp(`<button [^>]*>${label}</button>`).exec(markup)?.[0]
}

/** 여는 태그의 `class` 값 */
function classOf(tag: string | undefined): string | undefined {
  return tag === undefined ? undefined : /class="([^"]*)"/.exec(tag)?.[1]
}

describe('PlanDaySection — 이동·휴식 추가 버튼 (#1014)', () => {
  it('항목이 있는 날 `순서 편집` 오른쪽에 선다', () => {
    const markup = renderDaySection()

    expect(buttonTag(markup, messages.plan.addMoveAction)).toBeDefined()
    expect(markup.indexOf(messages.plan.addMoveAction)).toBeGreaterThan(
      markup.indexOf(messages.plan.editDayAction),
    )
  })

  it('`순서 편집` 과 같은 variant · size 다 — class 가 같다', () => {
    const markup = renderDaySection()
    const moveClass = classOf(buttonTag(markup, messages.plan.addMoveAction))

    expect(moveClass).toBeDefined()
    expect(moveClass).toBe(classOf(buttonTag(markup, messages.plan.editDayAction)))
  })

  /* `장소 추가` 와 같다 — 항목 수를 보지 않는다. 장소가 없어도 이동·휴식은 넣을 수 있다 */
  it('빈 일자에도 남는다 — `순서 편집` 은 없어도 `장소 추가` 뒤에 선다', () => {
    const markup = renderDaySection({ rows: [] })

    expect(markup).not.toContain(messages.plan.editDayAction)
    expect(buttonTag(markup, messages.plan.addMoveAction)).toBeDefined()
    expect(markup.indexOf(messages.plan.addMoveAction)).toBeGreaterThan(
      markup.indexOf(messages.plan.addPlaceAction),
    )
  })

  /* 편집 중에는 액션 줄 전체가 감춰진다 — 편집기가 저장 지점을 들고 있다 */
  it('편집 중에는 없다', () => {
    expect(renderDaySection({ editing: true })).not.toContain(messages.plan.addMoveAction)
  })

  it('다이얼로그를 연다는 것을 알린다 — aria-haspopup="dialog"', () => {
    expect(buttonTag(renderDaySection(), messages.plan.addMoveAction)).toContain(
      'aria-haspopup="dialog"',
    )
  })

  /* 모달 제출이 잠기는 것이지 진입이 잠기는 것은 아니다 — 여는 것은 아무것도 보내지 않는다 */
  it('다른 담기가 진행 중이어도 버튼은 눌린다', () => {
    const markup = renderDaySection({ add: { ...planDayAdd, busy: true } })

    expect(buttonTag(markup, messages.plan.addMoveAction)).not.toContain('disabled=""')
  })
})

function renderView(overrides: Partial<PlanDayMoveAddViewProps> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayMoveAddView, {
      open: true,
      onClose: () => undefined,
      day: 2,
      title: '',
      onTitleChange: () => undefined,
      fieldError: null,
      formError: null,
      saving: false,
      blocked: false,
      onSubmit: () => undefined,
      ...overrides,
    }),
  )
}

/** 제출 버튼의 여는 태그 */
function cancelTag(markup: string): string | undefined {
  return new RegExp(`<button [^>]*>(?:(?!</button>).)*${messages.plan.editCancel}`).exec(
    markup,
  )?.[0]
}

function submitTag(markup: string): string | undefined {
  return new RegExp(`<button [^>]*>(?:(?!</button>).)*${messages.plan.addMoveSubmit}`).exec(
    markup,
  )?.[0]
}

describe('PlanDayMoveAddView — 모달 (#1014)', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    expect(renderView({ open: false })).toBe('')
  })

  it('제목이 어느 일자인지 말하고 설명이 맨 뒤에 붙는다는 것을 말한다', () => {
    const markup = renderView({ day: 2 })

    expect(markup).toContain('2일차에 이동·휴식 추가')
    expect(markup).toContain(messages.plan.addMoveDescription)
  })

  it('입력이 빈 채로 열리고 placeholder 는 예시다', () => {
    const markup = renderView()

    expect(markup).toContain('value=""')
    expect(markup).toContain(`placeholder="${messages.plan.addMovePlaceholder}"`)
    expect(messages.plan.addMovePlaceholder).toContain('예:')
  })

  it('100자 제한이 입력에 걸려 있다 — 서버 @Size(max = 100)', () => {
    expect(renderView()).toContain(`maxLength="${ITEM_TITLE_MAX}"`)
  })

  it('라벨이 입력에 붙고 필수 표시가 있다', () => {
    const markup = renderView()

    expect(markup).toContain(`for="plan-move-add-title"`)
    expect(markup).toContain(`id="plan-move-add-title"`)
    expect(markup).toContain(messages.plan.addMoveFieldLabel)
    expect(markup).toContain('text-danger-500 ml-1')
  })

  it('필드 오류가 없으면 aria-invalid 가 없다', () => {
    const markup = renderView()

    expect(markup).not.toContain('aria-invalid')
    expect(markup).not.toContain(messages.plan.addMoveTitleRequired)
  })

  it('필드 오류가 있으면 문구와 aria-invalid · aria-describedby 가 붙는다', () => {
    const markup = renderView({ fieldError: messages.plan.addMoveTitleRequired })

    expect(markup).toContain(messages.plan.addMoveTitleRequired)
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('aria-describedby="plan-move-add-title-error"')
  })

  it('저장 실패는 role="alert" 배너로 남는다', () => {
    const markup = renderView({ formError: messages.plan.addMoveErrorDescription })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.addMoveErrorDescription)
  })

  it('실패가 없으면 배너가 없다', () => {
    expect(renderView()).not.toContain('role="alert"')
  })

  /* 제출 버튼이 footer(폼 밖)에 서므로 `form` 속성으로 잇는다 — 빠지면 Enter 도 클릭도 안 보낸다 */
  it('제출 버튼이 폼과 이어진다', () => {
    const markup = renderView()
    const tag = submitTag(markup)

    expect(tag).toContain('type="submit"')
    expect(tag).toContain('form="plan-move-add-form"')
    expect(markup).toContain('<form id="plan-move-add-form"')
  })

  it('다른 담기가 진행 중이면 제출이 잠긴다', () => {
    expect(submitTag(renderView({ blocked: true }))).toContain('disabled=""')
  })

  it('저장 중이면 제출이 진행 표시를 낸다', () => {
    expect(submitTag(renderView({ saving: true }))).toContain('aria-busy="true"')
  })

  it('평소에는 제출이 잠겨 있지 않다 — 빈 값도 누르면 검증 문구가 뜬다', () => {
    expect(submitTag(renderView())).not.toContain('disabled=""')
  })
})

/*
  **저장 중에는 닫히지 않는다** (#1014 검토). 닫을 수 있으면 응답 전에 `순서 편집` 이 낡은 목록으로
  열리고, 그대로 저장하면 방금 넣은 항목이 지워진다. 닫은 뒤 난 실패도 그릴 곳이 없다.
*/
describe('PlanDayMoveAddView — 저장 중 닫기', () => {
  it('저장 중이면 취소가 잠긴다', () => {
    expect(cancelTag(renderView({ saving: true }))).toContain('disabled=""')
  })

  it('평소에는 취소가 잠겨 있지 않다', () => {
    expect(cancelTag(renderView())).not.toContain('disabled=""')
  })

  it('저장 중이면 Esc·바깥 누름·닫기 버튼이 닫지 않는다', () => {
    let closed = 0
    guardClose(true, () => (closed += 1))()

    expect(closed).toBe(0)
  })

  it('저장 중이 아니면 그대로 닫는다', () => {
    let closed = 0
    guardClose(false, () => (closed += 1))()

    expect(closed).toBe(1)
  })
})
