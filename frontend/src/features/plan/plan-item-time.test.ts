import { createElement, createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanItemRow, timeChipFocusKey } from '@/features/plan/plan-item-row'
import { PlanItemTimeView, type PlanItemTimeViewProps } from '@/features/plan/plan-item-time-view'
import { messages } from '@/lib/messages'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import {
  planDayAdd,
  planDayItemTime,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
  planItem,
  planItemWalkSafety,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 항목 시간 칩 · 전자시계 모달 — 이슈 #1028 · `일자편집-세부명세.md` G2 · G7.
 *
 * **렌더 분기만 본다.** 증감 · 순환 · 두 자리 입력 · 서버 형식은 `lib/plan/clock-time.test.ts`
 * 가, 저장(단건 API, #1053)이 체크를 지키는 것은 `lib/api/mock/plan-detail-mock.test.ts` 가,
 * 실패 분류는 `lib/plan/item-time-error.test.ts` 가 잠근다.
 */

const PLACE_ITEM = planDetail.items[0]!
const TITLE = PLACE_ITEM.title

function renderRow(item: PlanItemDetail, withTime = true, walkSafety?: unknown) {
  const model: PlanItemRowModel = { item, distanceMeters: null, distanceKind: null }

  return renderToStaticMarkup(
    createElement(PlanItemRow, {
      model,
      ...(withTime ? { time: { onOpen: () => undefined, focusKey: timeChipFocusKey(2, 1) } } : {}),
      ...(walkSafety === undefined ? {} : { walkSafety: walkSafety as never }),
    }),
  )
}

/** `<a …>…</a>` 한 덩어리 */
function anchorOf(markup: string): string {
  const start = markup.indexOf('<a ')
  return markup.slice(start, markup.indexOf('</a>', start) + 4)
}

describe('PlanItemRow — 시간 칩 (#1028)', () => {
  /*
    **저장 뒤 초점이 돌아올 표식** (#1028 검토). 복귀를 칩 노드의 정체성에 기대지 않고 같은
    **일자 · 순서** 의 칩을 이 표식으로 찾는다 — #1053 의 단건 API 는 `planItemId` 를 지키지만,
    그 사이 다른 일괄 교체가 항목을 새로 발급해도 같은 자리로 돌아온다.
  */
  it('칩이 일자 · 순서 표식을 단다 — 저장 뒤 초점이 같은 자리로 돌아온다', () => {
    expect(timeChipFocusKey(2, 1)).toBe('2:1')
    expect(renderRow({ ...PLACE_ITEM, startTime: null })).toContain('data-plan-time-chip="2:1"')
    expect(renderRow({ ...PLACE_ITEM, startTime: '10:30:00' })).toContain(
      'data-plan-time-chip="2:1"',
    )
  })

  it('시각이 없으면 시간 등록하기 칩이 선다 — 이름에 제목이 들어간다', () => {
    const markup = renderRow({ ...PLACE_ITEM, startTime: null })

    expect(markup).toContain(`>${messages.plan.itemTimeAddAction}</button>`)
    expect(markup).toContain(
      `aria-label="${messages.plan.itemTimeAddLabel.replace('{title}', TITLE)}"`,
    )
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).not.toContain('<time')
  })

  it('시각이 있으면 그 자리가 곧 칩이다 — 10:30 이 한 번만 선다', () => {
    const markup = renderRow({ ...PLACE_ITEM, startTime: '10:30:00' })

    expect(markup).toContain('<time dateTime="10:30">10:30</time>')
    expect(markup.split('>10:30<').length - 1).toBe(1)
    expect(markup).toContain(
      `aria-label="${messages.plan.itemTimeEditLabel.replace('{title}', TITLE).replace('{time}', '10:30')}"`,
    )
    expect(markup).not.toContain(messages.plan.itemTimeAddAction)
  })

  it('칩이 제목보다 앞이다 — D14-3 시각 줄 자리 그대로다', () => {
    const markup = renderRow({ ...PLACE_ITEM, startTime: '10:30:00' })

    // 칩 이름(aria-label)에도 제목이 있으므로 제목 요소(`<h4`)로 잰다
    expect(markup.indexOf('>10:30<')).toBeLessThan(markup.indexOf('<h4'))
  })

  it('칩은 링크 밖이다 — 링크 안에 버튼을 넣지 않는다 (D6)', () => {
    const markup = renderRow({ ...PLACE_ITEM, startTime: '10:30:00' })

    expect(anchorOf(markup)).not.toContain('<button')
    expect(anchorOf(markup)).toContain(TITLE)
  })

  it('링크는 늘린 링크다 — ::after 가 행 면을 덮어 누르는 자리는 행 전체 그대로다', () => {
    const markup = renderRow({ ...PLACE_ITEM, startTime: null })

    expect(anchorOf(markup)).toContain('after:absolute')
    expect(anchorOf(markup)).toContain('after:inset-0')
  })

  it('칩이 늘린 링크 위에 선다 — z-10', () => {
    const markup = renderRow({ ...PLACE_ITEM, startTime: null })
    const chip = /<button [^>]*aria-haspopup="dialog"[^>]*>/.exec(markup)?.[0] ?? ''

    expect(chip).toContain('z-10')
  })

  it('산책 위험도 배지는 칩 옆에 그대로 붙는다 (D15-5)', () => {
    const item = { ...PLACE_ITEM, startTime: '10:30:00' }
    const markup = renderRow(item, true, planItemWalkSafety({ planItemId: item.planItemId }))

    expect(markup).toContain(messages.plan.walkSafetyFeelsLikeLabel)
    expect(markup.indexOf('10:30')).toBeLessThan(
      markup.indexOf(messages.plan.walkSafetyFeelsLikeLabel),
    )
  })

  it('시각이 없으면 칩만 서고 산책 위험도는 없다 — 판정 자체가 시각을 요구한다 (D14-4)', () => {
    const item = { ...PLACE_ITEM, startTime: null }
    const markup = renderRow(item, true, planItemWalkSafety({ planItemId: item.planItemId }))

    expect(markup).toContain(messages.plan.itemTimeAddAction)
    expect(markup).not.toContain(messages.plan.walkSafetyFeelsLikeLabel)
  })

  it('이동·휴식(MOVE) 항목에도 칩이 선다 — 링크 없는 갈래다', () => {
    const move = planItem({
      planItemId: 'move-1',
      day: 1,
      sequence: 1,
      title: '차로 이동',
      itemType: { code: 'MOVE', name: '이동', description: null },
      targetId: null,
    })
    const markup = renderRow(move)

    expect(markup).not.toContain('<a ')
    expect(markup).toContain(
      `aria-label="${messages.plan.itemTimeAddLabel.replace('{title}', '차로 이동')}"`,
    )
  })

  it('time 을 넘기지 않으면 칩이 없고 예전 시각 캡션이다 — 기간 밖 항목 섹션의 경로다', () => {
    const markup = renderRow({ ...PLACE_ITEM, startTime: '10:30:00' }, false)

    expect(markup).not.toContain('aria-haspopup="dialog"')
    expect(markup).toContain(messages.plan.startTimeSrLabel)
    expect(markup).toContain('<time dateTime="10:30">10:30</time>')
  })
})

describe('PlanDaySection — 시간 칩 배선 (#1028)', () => {
  function renderDay(editing: boolean) {
    return renderToStaticMarkup(
      createElement(PlanDaySection, {
        day: 1,
        date: '2026-09-12',
        rows: [{ item: PLACE_ITEM, distanceMeters: null, distanceKind: null }],
        places: new Map<string, PlaceDetail>(),
        verdict: undefined,
        petConditionApplied: true,
        basisPetName: null,
        verdictFailed: false,
        onRetryVerdict: () => undefined,
        editing,
        onStartEdit: () => undefined,
        editor: editing ? createElement('p', null, '편집기') : null,
        add: planDayAdd,
        visit: planDayVisit,
        walkSafety: planDayWalkSafety,
        itemTime: planDayItemTime,
        regenerateHref: null,
      }),
    )
  }

  it('일자 카드의 행마다 칩이 선다', () => {
    expect(renderDay(false)).toContain(messages.plan.itemTimeAddLabel.replace('{title}', TITLE))
  })

  it('편집 중에는 칩이 없다 — 행이 편집기로 바뀐다', () => {
    expect(renderDay(true)).not.toContain(messages.plan.itemTimeAddAction)
  })
})

function renderView(overrides: Partial<PlanItemTimeViewProps> = {}) {
  const props: PlanItemTimeViewProps = {
    open: true,
    onClose: () => undefined,
    title: TITLE,
    hour: 10,
    minute: 5,
    hasTime: false,
    formError: null,
    saving: false,
    blocked: false,
    onStep: () => undefined,
    onFieldKeyDown: () => undefined,
    onFieldChange: () => undefined,
    onFieldFocus: () => undefined,
    hourRef: createRef<HTMLInputElement>(),
    minuteRef: createRef<HTMLInputElement>(),
    onSubmit: () => undefined,
    onClear: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlanItemTimeView, props))
}

/** `id` 로 찾은 `<input …>` 태그 */
function inputTag(markup: string, id: string): string {
  return new RegExp(`<input [^>]*id="${id}"[^>]*/?>`).exec(markup)?.[0] ?? ''
}

describe('PlanItemTimeView — 전자시계 모달 (#1028)', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    expect(renderView({ open: false })).toBe('')
  })

  it('제목에 항목 이름이 들어간다', () => {
    expect(renderView()).toContain(messages.plan.itemTimeModalTitle.replace('{title}', TITLE))
  })

  it('시 · 분 두 칸이 spinbutton 이고 값 · 범위 · 값 문장 · 이름을 갖는다', () => {
    const markup = renderView()
    const hour = inputTag(markup, 'plan-item-time-hour')
    const minute = inputTag(markup, 'plan-item-time-minute')

    expect(hour).toContain('role="spinbutton"')
    expect(hour).toContain('aria-valuenow="10"')
    expect(hour).toContain('aria-valuemin="0"')
    expect(hour).toContain('aria-valuemax="23"')
    expect(hour).toContain(
      `aria-valuetext="${messages.plan.itemTimeHourValueText.replace('{value}', '10')}"`,
    )
    expect(hour).toContain(`aria-label="${messages.plan.itemTimeHourLabel}"`)

    expect(minute).toContain('role="spinbutton"')
    expect(minute).toContain('aria-valuemax="59"')
    expect(minute).toContain(`aria-label="${messages.plan.itemTimeMinuteLabel}"`)
  })

  it('두 자리로 보여 준다 — 5분은 05', () => {
    const minute = inputTag(renderView(), 'plan-item-time-minute')

    expect(minute).toContain('value="05"')
  })

  it('모바일에서 숫자 키패드가 뜬다 — inputMode=numeric', () => {
    expect(inputTag(renderView(), 'plan-item-time-hour')).toContain('inputMode="numeric"')
  })

  it('칸마다 ▲▼ 가 있고 탭 정지가 아니다 — 칸 안의 ↑↓ 가 같은 일을 한다', () => {
    const markup = renderView()

    for (const unit of [messages.plan.itemTimeHourLabel, messages.plan.itemTimeMinuteLabel]) {
      for (const template of [messages.plan.itemTimeIncrease, messages.plan.itemTimeDecrease]) {
        const tag =
          new RegExp(`<button [^>]*aria-label="${template.replace('{unit}', unit)}"[^>]*>`).exec(
            markup,
          )?.[0] ?? ''
        expect(tag).toContain('tabindex="-1"')
      }
    }
  })

  it('시각이 없으면 시간 지우기가 없다', () => {
    expect(renderView({ hasTime: false })).not.toContain(messages.plan.itemTimeClear)
  })

  it('시각이 있으면 시간 지우기가 선다', () => {
    expect(renderView({ hasTime: true })).toContain(`>${messages.plan.itemTimeClear}</button>`)
  })

  it('취소 · 저장이 있다', () => {
    const markup = renderView()

    expect(markup).toContain(`>${messages.plan.editCancel}</button>`)
    expect(markup).toContain(`>${messages.plan.itemTimeSave}</button>`)
  })

  /*
    **체크가 남는다** (#1053 · D9-2). 저장이 단건 API 라 그 날의 `다녀옴` 이 풀리지 않는다 —
    #1028 의 초기화 경고를 걷었다. 체크가 있는 날인지 모달이 알 길 자체를 없앴으므로(prop 제거)
    어느 날이든 설명은 조작 안내 한 줄뿐이다. 실제로 체크가 남는지는 mock 테스트가 잰다.
  */
  it('초기화 경고가 없다 — 설명은 조작 안내 한 줄이다', () => {
    const markup = renderView()

    expect(markup).not.toContain('초기화')
    expect(markup).not.toContain('다녀옴')
    expect(markup).toContain(messages.plan.itemTimeModalDescription)
  })

  /*
    **모바일에 없는 조작을 말하지 않는다** (#1184). 예전 설명은 `▲▼나 방향키로…` 였다 — 방향키는
    `spinbutton` 의 표준 조작이라 키보드 사용자는 역할로 이미 안다.
  */
  it('설명이 방향키를 말하지 않는다 — 모바일에는 없다', () => {
    expect(messages.plan.itemTimeModalDescription).not.toContain('방향키')
    expect(messages.plan.itemTimeModalDescription).toContain('▲▼')
  })

  it('설명은 aria-describedby 로 열 때 함께 읽힌다', () => {
    const markup = renderView()
    const describedBy = /aria-describedby="([^"]+)"/.exec(markup)?.[1] ?? ''
    const start = markup.indexOf(`id="${describedBy}"`)

    expect(describedBy).not.toBe('')
    expect(markup.indexOf(messages.plan.itemTimeModalDescription)).toBeGreaterThan(start)
  })

  it('저장 실패는 모달 안에 role=alert 로 남는다', () => {
    const markup = renderView({ formError: messages.plan.itemTimeErrorDescription })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.itemTimeErrorDescription)
  })

  it('저장 중이면 저장 버튼이 aria-busy 이고 칸은 disabled 가 아니라 readOnly 다', () => {
    const markup = renderView({ saving: true })
    const hour = inputTag(markup, 'plan-item-time-hour')

    expect(markup).toContain('aria-busy="true"')
    expect(hour).toContain('readOnly=""')
    expect(hour).not.toContain('disabled')
  })

  it('다른 일괄 교체가 도는 중이면 저장 · 지우기가 잠긴다', () => {
    const markup = renderView({ blocked: true, hasTime: true })
    const save =
      new RegExp(`<button [^>]*>${messages.plan.itemTimeSave}</button>`).exec(markup)?.[0] ?? ''
    const clear =
      new RegExp(`<button [^>]*>${messages.plan.itemTimeClear}</button>`).exec(markup)?.[0] ?? ''

    expect(save).toContain('disabled')
    expect(clear).toContain('disabled')
  })
})
