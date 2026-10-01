import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmptyState } from '@/components/empty-state'
import { ErrorStateView } from '@/components/error-state'

/**
 * 상태 컴포넌트의 `flush` — 이슈 #1079.
 *
 * 인증 셸 카드(`px-4 py-6 md:px-5`) 안에서 `EmptyState` 가 자기 여백(`py-12` + `main` 인셋)을
 * 한 번 더 먹어, 소셜 콜백 제목이 x=49 에 섰다(다른 인증 화면은 33). 폼 안의 `ErrorState` 도
 * 같은 여백으로 폼을 밀었다. `flush` 는 **담는 쪽이 이미 여백을 가진 자리**에서 그 둘을 걷는다.
 */
function classOf(markup: string): string {
  return /class="([^"]*)"/.exec(markup)?.[1] ?? ''
}

const ERROR_BASE = { title: '잠시 문제가 생겼어요', onRetry: () => undefined, offline: false }

describe('ErrorState — flush (#1079)', () => {
  it('기본은 지금 그대로다 — 세로 48 과 main 인셋', () => {
    const outer = classOf(renderToStaticMarkup(createElement(ErrorStateView, ERROR_BASE)))

    expect(outer).toContain('py-12')
    expect(outer).toContain('px-4 md:px-10')
  })

  it('flush 면 자기 여백을 갖지 않는다', () => {
    const outer = classOf(
      renderToStaticMarkup(createElement(ErrorStateView, { ...ERROR_BASE, flush: true })),
    )

    expect(outer).not.toMatch(/\bpy-/)
    expect(outer).not.toMatch(/\bpx-/)
    expect(outer).toContain('flex flex-col')
  })

  it('flush 여도 재시도는 남는다', () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorStateView, { ...ERROR_BASE, flush: true }),
    )

    expect(markup).toContain('<button')
  })
})

describe('EmptyState — flush · h1 (#1079)', () => {
  it('기본은 지금 그대로다 — 세로 48 · main 인셋 · h2', () => {
    const markup = renderToStaticMarkup(createElement(EmptyState, { title: '없어요' }))

    expect(classOf(markup)).toContain('py-12')
    expect(classOf(markup)).toContain('px-4 md:px-10')
    expect(markup).toContain('<h2')
  })

  it('flush 면 자기 여백을 갖지 않는다', () => {
    const outer = classOf(
      renderToStaticMarkup(createElement(EmptyState, { title: '없어요', flush: true })),
    )

    expect(outer).not.toMatch(/\bpy-/)
    expect(outer).not.toMatch(/\bpx-/)
  })

  it('화면 전체가 상태인 자리는 제목을 h1 로 줄 수 있다 — 크기는 그대로다', () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, { title: '로그인하지 못했어요', headingLevel: 1, flush: true }),
    )

    expect(markup).toContain(
      '<h1 class="text-body-1 text-fg font-semibold">로그인하지 못했어요</h1>',
    )
  })
})
