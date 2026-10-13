import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlanConfirmCheckModal,
  type PlanConfirmCheckModalProps,
} from '@/features/plan/plan-confirm-check-modal'
import { messages } from '@/lib/messages'
import type { PlanConfirmCheckDay } from '@/lib/plan/confirm-check'

/**
 * 확정 전 점검 시트 — 이슈 #1425 · 명세 D26-2.
 */
const DAYS: PlanConfirmCheckDay[] = [
  {
    day: 1,
    issues: [
      { kind: 'backward', planItemId: 'a', title: '흑돼지 거리', time: '12:30' },
      { kind: 'overlap', planItemId: 'b', title: '애월 펜션', time: '15:00' },
    ],
  },
  {
    day: 3,
    issues: [{ kind: 'no-time', planItemId: 'c', title: '성산일출봉' }, { kind: 'no-meal' }],
  },
]

function render(overrides: Partial<PlanConfirmCheckModalProps> = {}): string {
  const props: PlanConfirmCheckModalProps = {
    open: true,
    days: DAYS,
    onClose: () => undefined,
    onFix: () => undefined,
    onProceed: () => undefined,
    ...overrides,
  }
  return renderToStaticMarkup(createElement(PlanConfirmCheckModal, props))
}

describe('점검 시트 — 열림', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    expect(render({ open: false })).toBe('')
  })

  it('dialog 다 — alertdialog 가 아니다 (확정은 되돌릴 수 있다, D11-2)', () => {
    const html = render()

    expect(html).toContain('role="dialog"')
    expect(html).not.toContain('alertdialog')
    expect(html).toContain(messages.plan.confirmCheckTitle)
    expect(html).toContain(messages.plan.confirmCheckDescription)
  })
})

describe('점검 시트 — 일자 묶음', () => {
  it('문제가 있는 일자만 일자마다 하나의 고치러 가기를 둔다', () => {
    const html = render()

    expect(html).toContain('>1일차<')
    expect(html).toContain('>3일차<')
    expect(html).not.toContain('>2일차<')
    expect(html.match(new RegExp(`>${messages.plan.confirmCheckFix}<`, 'g'))).toHaveLength(2)
  })

  it('고치러 가기의 이름이 일자로 갈리고 보이는 글자를 품는다 (WCAG 2.5.3)', () => {
    const html = render()

    expect(html).toContain('aria-label="1일차 고치러 가기"')
    expect(html).toContain('aria-label="3일차 고치러 가기"')
  })

  it('시각 사유는 일정 상세 경고 칩과 같은 낱말이다 (D25-4)', () => {
    const html = render()

    expect(html).toContain('12:30')
    expect(html).toContain('흑돼지 거리')
    expect(html).toContain(messages.plan.itemTimeBackward)
    expect(html).toContain('애월 펜션')
    expect(html).toContain(messages.plan.itemTimeOverlap)
  })

  it('빈 시각과 식사 없는 날을 말한다', () => {
    const html = render()

    expect(html).toContain('성산일출봉')
    expect(html).toContain(messages.plan.confirmCheckNoTime)
    expect(html).toContain(messages.plan.confirmCheckNoMeal)
  })

  it('한 일자 안의 줄 순서는 입력 순서다 — 일자 카드의 순서와 같다', () => {
    const html = render()

    expect(html.indexOf('흑돼지 거리')).toBeLessThan(html.indexOf('애월 펜션'))
    expect(html.indexOf('성산일출봉')).toBeLessThan(html.indexOf(messages.plan.confirmCheckNoMeal))
  })
})

describe('점검 시트 — 조작부', () => {
  it('그대로 확정과 닫기가 있다 — 그대로 확정은 주요 버튼 색면이 아니다', () => {
    const html = render()

    expect(html).toContain(messages.plan.confirmCheckProceed)
    expect(html).toContain(messages.plan.confirmCheckClose)

    const proceed = html.slice(
      html.lastIndexOf('<button', html.indexOf(messages.plan.confirmCheckProceed)),
      html.indexOf(messages.plan.confirmCheckProceed),
    )
    expect(proceed).not.toContain('bg-brand-600')
  })
})
