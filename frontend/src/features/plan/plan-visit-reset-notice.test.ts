import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanAddPlaceShell } from '@/features/plan/plan-add-place-view'
import {
  PlanDayMoveAddView,
  type PlanDayMoveAddViewProps,
} from '@/features/plan/plan-day-move-add-view'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { messages } from '@/lib/messages'
import {
  planAlternative,
  planDayAdd,
  planDayItemTime,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
  planVerdict,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/**
 * '다녀옴' 초기화 경고의 자리 — 이슈 #1066 (#124 의 경고를 옮겼다).
 *
 * 예전에는 체크가 있는 날마다 **일자 제목 아래 상시 한 줄**이었다. 다녀옴은 여행 중에 쓰는
 * 기능이라 여행 기간 내내 일자마다 붙어 있게 되어, **고치러 들어간 순간**에 알리도록
 * 옮겼다: `순서 편집` 편집기 위 · `장소 추가` 화면 머리 · `이동·휴식 추가` 모달 안.
 *
 * 세 자리 모두 **체크가 있는 날에만** 선다 — 잃을 것이 없는 날에 띄우면 경고가 배경음이
 * 된다 (#124 의 판단 그대로).
 */

const PLAIN = planDetail.items[0]!
const VISITED = { ...PLAIN, visited: true }

function row(item: typeof PLAIN) {
  return { item, distanceMeters: null, distanceKind: null }
}

function renderDaySection(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanDaySection, {
      day: 1,
      date: '2026-09-12',
      rows: [row(VISITED)],
      places: new Map<string, PlaceDetail>(),
      verdict: undefined,
      petConditionApplied: true,
      basisPetName: null,
      verdictFailed: false,
      onRetryVerdict: () => undefined,
      editing: false,
      onStartEdit: () => undefined,
      editor: createElement('div', { 'data-editor': '' }),
      add: planDayAdd,
      visit: planDayVisit,
      walkSafety: planDayWalkSafety,
      itemTime: planDayItemTime,
      regenerateHref: null,
      ...overrides,
    }),
  )
}

/** 예전 상시 줄의 문구 — 어느 자리에서도 다시 서지 않아야 한다 */
const OLD_NOTICE = '순서를 바꾸거나 장소를 담으면'

describe('일자 카드 — 상시 줄을 걷는다 (#1066)', () => {
  it('체크가 있는 날에도 편집 전에는 경고를 세우지 않는다', () => {
    const markup = renderDaySection()

    expect(markup).not.toContain(messages.plan.visitResetOnEditNotice)
    expect(markup).not.toContain(OLD_NOTICE)
  })
})

describe('순서 편집 — 편집기 위에 선다 (#1066)', () => {
  it('체크가 있는 날 편집을 열면 편집기보다 앞에 선다', () => {
    const markup = renderDaySection({ editing: true })

    expect(markup).toContain(messages.plan.visitResetOnEditNotice)
    expect(markup.indexOf(messages.plan.visitResetOnEditNotice)).toBeLessThan(
      markup.indexOf('data-editor'),
    )
  })

  it('체크가 없는 날에는 편집을 열어도 서지 않는다', () => {
    const markup = renderDaySection({ editing: true, rows: [row(PLAIN)] })

    expect(markup).toContain('data-editor')
    expect(markup).not.toContain(messages.plan.visitResetOnEditNotice)
  })
})

/*
  실내 대안 `담기` 는 들어가는 화면 없이 카드 안에서 바로 저장한다 — 그 목록 머리가 진입
  자리다. 비 예보가 있는 날에만 서는 목록이라 상시 줄로 돌아가지 않는다.
*/
describe('실내 대안 담기 — 목록 머리에 선다 (#1066)', () => {
  const rainy = { ...planVerdict, indoorAlternatives: [planAlternative({ title: '김창열미술관' })] }

  it('체크가 있는 비 오는 날에는 대안 제목 뒤에 선다', () => {
    const markup = renderDaySection({ verdict: rainy })

    expect(markup).toContain(messages.plan.visitResetOnAddNotice)
    expect(markup.indexOf(messages.plan.visitResetOnAddNotice)).toBeGreaterThan(
      markup.indexOf(messages.plan.indoorAlternativesTitle),
    )
  })

  it('체크가 없으면 대안 목록이 있어도 서지 않는다', () => {
    const markup = renderDaySection({ verdict: rainy, rows: [row(PLAIN)] })

    expect(markup).toContain(messages.plan.indoorAlternativesTitle)
    expect(markup).not.toContain(messages.plan.visitResetOnAddNotice)
  })
})

function renderMoveView(overrides: Partial<PlanDayMoveAddViewProps> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayMoveAddView, {
      open: true,
      onClose: () => undefined,
      day: 1,
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

/*
  `이동·휴식 추가` 도 일괄 교체다 (#1014) — 넣으면 새 `planItemId` 가 발급되어 그 날의 체크가
  지워진다. 예전 상시 줄은 이 진입점이 생기기 전 문구라 계기에 넣지 않았다.
*/
describe('이동·휴식 추가 — 모달 안에 선다 (#1066)', () => {
  it('체크가 있는 날에는 입력 뒤에 선다', () => {
    const markup = renderMoveView({ resetsVisits: true })

    expect(markup).toContain(messages.plan.visitResetOnMoveNotice)
    expect(markup.indexOf(messages.plan.visitResetOnMoveNotice)).toBeGreaterThan(
      markup.indexOf(messages.plan.addMoveFieldLabel),
    )
  })

  it('체크가 없는 날에는 서지 않는다 — 기본값이 없음이다', () => {
    expect(renderMoveView()).not.toContain(messages.plan.visitResetOnMoveNotice)
  })
})

function renderAddShell(notice: string | null, beforeLodging = false) {
  return renderToStaticMarkup(
    createElement(PlanAddPlaceShell, {
      day: 1,
      backHref: '/plans/1#day1',
      planTitle: '몽실이와 제주 2박 3일',
      notice,
      beforeLodging,
      listHref: '/plans/1/days/1/add?view=list',
      mapHref: '/plans/1/days/1/add',
      view: 'list',
      children: createElement('ul', { 'data-list': '' }),
    }),
  )
}

describe('장소 추가 — 화면 머리에 선다 (#1066)', () => {
  it('경고가 있으면 부제 뒤, 목록 앞에 선다', () => {
    const markup = renderAddShell(messages.plan.visitResetOnAddNotice)
    const subtitle = messages.plan.addPlaceSubtitle.replace('{day}', '1')

    expect(markup.indexOf(messages.plan.visitResetOnAddNotice)).toBeGreaterThan(
      markup.indexOf(subtitle),
    )
    expect(markup.indexOf(messages.plan.visitResetOnAddNotice)).toBeLessThan(
      markup.indexOf('data-list'),
    )
  })

  it('없으면 줄 자체가 없다', () => {
    const markup = renderAddShell(null)

    expect(markup).not.toContain(messages.plan.visitResetOnAddNotice)
    expect(markup).not.toContain(OLD_NOTICE)
  })
})

/*
  **부제가 담기는 자리를 거짓말하지 않는다** (#1175). 끝에 숙박이 있는 날 "맨 뒤에 담겨요" 라고
  쓰면, 담은 뒤 숙소 앞에 선 것을 보고 잘못 담긴 줄 안다.
*/
describe('장소 추가 — 부제가 담길 자리를 말한다 (#1175)', () => {
  it('끝에 숙박이 있는 날은 숙소 앞이라고 말한다', () => {
    const markup = renderAddShell(null, true)

    expect(markup).toContain(messages.plan.addPlaceSubtitleBeforeLodging.replace('{day}', '1'))
    expect(markup).not.toContain(messages.plan.addPlaceSubtitle.replace('{day}', '1'))
  })

  it('아니면 맨 뒤다', () => {
    expect(renderAddShell(null)).toContain(messages.plan.addPlaceSubtitle.replace('{day}', '1'))
  })
})
