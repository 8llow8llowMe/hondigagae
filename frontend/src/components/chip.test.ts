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

/**
 * `sm` 칩의 누르는 자리 — 이슈 #905 R3.
 *
 * **보이는 높이는 모바일 36 그대로다** (#883). 투명한 `::before` 가 모바일에서만 위아래
 * 6px 씩 나가 실측 46 을 만들고, 768 이상에서는 칩 자체가 44 라 되돌린다.
 */
describe('Chip — sm 의 누르는 자리 (#905 R3)', () => {
  function chipTag(size: 'sm' | 'md'): string {
    const markup = renderToStaticMarkup(
      createElement(Chip, { selected: false, onSelect: vi.fn(), size, children: '24시간' }),
    )
    return /<button[^>]*>/.exec(markup)?.[0] ?? ''
  }

  it('sm 은 모바일 h-9 를 두고 세로 6px 씩 히트 영역을 넓힌다', () => {
    const classes = (/class="([^"]*)"/.exec(chipTag('sm'))?.[1] ?? '')
      .replaceAll('&#x27;', "'")
      .split(' ')

    for (const cls of [
      'h-9',
      'relative',
      'before:absolute',
      'before:inset-x-0',
      'before:-inset-y-1.5',
      'md:before:inset-y-0',
      "before:content-['']",
    ]) {
      expect(classes).toContain(cls)
    }
  })

  it('md 는 이미 44 라 손대지 않는다', () => {
    expect(chipTag('md')).not.toContain('before:')
  })
})
