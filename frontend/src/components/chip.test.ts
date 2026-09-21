import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { Chip, ChipGroup } from '@/components/chip'
import { expectSingleTabStop } from '@/test/radio-group'

function chip(key: string, selected: boolean, label: string, exclusive: boolean): ReactNode {
  return createElement(Chip, { key, exclusive, selected, onSelect: vi.fn(), children: label })
}

function renderGroup(exclusive: boolean, children: ReactNode[]): string {
  return renderToStaticMarkup(createElement(ChipGroup, { label: '축', exclusive, children }))
}

/**
 * `ChipGroup` 의 키보드 계약 — [#825](https://github.com/8llow8llowMe/hondigagae/issues/825).
 *
 * **이슈 본문의 표에 이 묶음이 빠져 있었다.** `role="radiogroup"` 을 그리는 곳을 실측으로
 * 훑다 찾았다 — AI 일정 폼 · 일정 동선 일자 축 · 긴급 반경 칩 · 지도 필터 바가 쓴다.
 */
describe('ChipGroup(exclusive) — 배타 축', () => {
  const markup = (): string =>
    renderGroup(true, [
      chip('a', true, '전체', true),
      chip('b', false, '제주시', true),
      chip('c', false, '서귀포시', true),
    ])

  it('radiogroup 으로 나간다', () => {
    expect(markup()).toContain('role="radiogroup"')
  })

  it('고른 칸만 탭 스톱이다', () => {
    expectSingleTabStop(markup())
  })
})

describe('ChipGroup(다중) — 토글 칩은 roving 이 아니다', () => {
  it('aria-pressed 칩에는 tabindex 를 달지 않는다', () => {
    const markup = renderGroup(false, [
      chip('a', true, '지금 진료중', false),
      chip('b', false, '24시간', false),
    ])

    expect(markup).toContain('aria-pressed')
    expect(markup).not.toContain('tabindex')
  })

  /** 시트를 여는 칩은 버튼이다 — 라디오도 토글도 아니다 */
  it('aria-expanded 칩에는 tabindex 를 달지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(Chip, {
        selected: false,
        onSelect: vi.fn(),
        expanded: false,
        children: '필터',
      }),
    )

    expect(markup).toContain('aria-expanded')
    expect(markup).not.toContain('tabindex')
  })
})
