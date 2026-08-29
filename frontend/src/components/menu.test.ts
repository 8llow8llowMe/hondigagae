import { createElement, type RefObject } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Menu, type MenuItem } from '@/components/menu'

const triggerRef = { current: null } as RefObject<HTMLElement | null>

function render(items: MenuItem[], open = true) {
  return renderToStaticMarkup(
    createElement(Menu, {
      open,
      onClose: () => undefined,
      triggerRef,
      items,
      label: '내 정보',
    }),
  )
}

describe('Menu — 닫힘', () => {
  it('닫혀 있으면 아무것도 렌더하지 않는다', () => {
    expect(render([{ label: '내 반려견', href: '/pets' }], false)).toBe('')
  })
})

describe('Menu — 이동 항목 (이슈 #70)', () => {
  /**
   * `href` 를 받지 못하던 시절 `account-menu.tsx` 가 오버레이 배선을 통째로 다시 만들었다.
   * 이동을 `onSelect` + `router.push` 로 흉내내면 새 탭·가운데클릭·주소 복사가 죽는다.
   */
  it('href 항목은 앵커로 낸다 — 버튼으로 흉내내지 않는다', () => {
    const markup = render([{ label: '내 반려견', href: '/pets' }])

    expect(markup).toContain('href="/pets"')
    expect(markup).toContain('role="menuitem"')
    expect(markup).not.toContain('<button')
  })

  it('onSelect 항목은 버튼으로 낸다', () => {
    const markup = render([{ label: '전체 해제', onSelect: () => undefined }])

    expect(markup).toContain('<button')
    expect(markup).not.toContain('href=')
  })

  it('두 종류를 한 메뉴에 섞을 수 있다', () => {
    const markup = render([
      { label: '내 반려견', href: '/pets' },
      { label: '전체 해제', onSelect: () => undefined },
    ])

    expect(markup).toContain('href="/pets"')
    expect(markup).toContain('<button')
  })
})

describe('Menu — 항목 계약 (가이드 §5-2)', () => {
  it('각 항목이 44px 다', () => {
    expect(render([{ label: '내 반려견', href: '/pets' }])).toContain('h-11')
  })

  it('파괴적 항목은 danger-900 이고 위에 선을 긋는다', () => {
    const markup = render([
      { label: '내 반려견', href: '/pets' },
      { label: '로그아웃', href: '/logout', destructive: true },
    ])

    expect(markup).toContain('text-danger-900')
    // 손이 미끄러져 파괴적 항목을 누르는 것을 막는다
    expect(markup).toContain('border-t')
  })

  it('파괴적 항목이 마지막에 온다', () => {
    const markup = render([
      { label: '내 반려견', href: '/pets' },
      { label: '로그아웃', href: '/logout', destructive: true },
    ])

    expect(markup.indexOf('내 반려견')).toBeLessThan(markup.indexOf('로그아웃'))
  })

  it('접근성 이름을 붙인다', () => {
    const markup = render([{ label: '내 반려견', href: '/pets' }])

    expect(markup).toContain('role="menu"')
    expect(markup).toContain('aria-label="내 정보"')
  })
})
