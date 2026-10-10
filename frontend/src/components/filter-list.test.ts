import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { FilterCheck, FilterList, FilterRadio } from '@/components/filter-list'
import { expectSingleTabStop } from '@/test/radio-group'

function radio(key: string, selected: boolean, label: string): ReactNode {
  return createElement(FilterRadio, { key, selected, onSelect: vi.fn(), children: label })
}

function check(key: string, selected: boolean, label: string): ReactNode {
  return createElement(FilterCheck, { key, selected, onSelect: vi.fn(), children: label })
}

function renderList(exclusive: boolean, children: ReactNode[]): string {
  return renderToStaticMarkup(createElement(FilterList, { label: '축', exclusive, children }))
}

/**
 * `FilterList` 의 키보드 계약 — [#825](https://github.com/8llow8llowMe/hondigagae/issues/825).
 *
 * 이 묶음은 `/places` · `/emergency` · `/plans` 필터가 모두 쓰는 **공용 프리미티브**라,
 * 여기가 어긋나면 세 화면이 함께 어긋난다.
 */
describe('FilterList(exclusive) — 배타 축', () => {
  const markup = (): string =>
    renderList(true, [
      radio('a', true, '전체'),
      radio('b', false, '동물병원'),
      radio('c', false, '약국'),
    ])

  it('radiogroup 으로 나간다', () => {
    expect(markup()).toContain('role="radiogroup"')
  })

  it('고른 칸만 탭 스톱이다', () => {
    expectSingleTabStop(markup())
  })

  it('고른 칸이 바뀌면 탭 스톱도 따라간다', () => {
    expectSingleTabStop(
      renderList(true, [
        radio('a', false, '전체'),
        radio('b', true, '동물병원'),
        radio('c', false, '약국'),
      ]),
    )
  })
})

/**
 * **다중 축은 라디오 그룹이 아니다.** 체크박스는 칸마다 탭 스톱이 규약이고 화살표로
 * 선택이 바뀌면 안 된다 — 한 몸통(`OptionButton`)을 공유하므로 넘치기 쉬운 자리다.
 */
describe('FilterList(다중) — 체크박스 축은 roving 이 아니다', () => {
  const markup = renderList(false, [check('a', true, '24시간'), check('b', false, '주차')])

  it('group 으로 나간다', () => {
    expect(markup).toContain('role="group"')
  })

  it('체크박스에는 tabindex 를 달지 않는다', () => {
    const checkboxes = [...markup.matchAll(/<button[^>]*role="checkbox"[^>]*>/g)]

    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every((match) => !match[0].includes('tabindex'))).toBe(true)
  })
})
