import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AuthTopBar } from '@/features/auth/auth-top-bar'

describe('AuthTopBar — 인증 하위 화면의 ← (#1283 C3 · C4)', () => {
  const markup = renderToStaticMarkup(
    createElement(AuthTopBar, {
      back: { href: '/login' },
      backLabel: '로그인 화면으로 돌아가기',
      title: '비밀번호 찾기',
    }),
  )

  it('뒤로는 목적지로 가는 링크다', () => {
    expect(markup).toMatch(/<a[^>]*href="\/login"/)
  })

  /* 아이콘은 aria-hidden 이라 sr-only 글자가 유일한 이름이다 (DESIGN.md §9) */
  it('아이콘만 보이고 이름은 sr-only 로 읽힌다', () => {
    expect(markup).toMatch(/<svg[^>]*aria-hidden/)
    expect(markup).toContain('<span class="sr-only">로그인 화면으로 돌아가기</span>')
  })

  it('누르는 자리가 44 다', () => {
    expect(markup).toMatch(/<a[^>]*class="[^"]*\bsize-11\b/)
  })

  it('화면 이름이 h1 이다', () => {
    expect(markup).toContain('<h1 class="text-body-1 text-fg font-semibold">비밀번호 찾기</h1>')
  })

  it('이름을 넘기지 않으면 제목을 그리지 않는다 — 화면이 따로 단다', () => {
    const bare = renderToStaticMarkup(
      createElement(AuthTopBar, { back: { href: '/login' }, backLabel: '뒤로' }),
    )
    expect(bare).not.toContain('<h1')
  })
})

describe('AuthTopBar — 단계 되돌리기는 버튼이다 (#1284)', () => {
  const markup = renderToStaticMarkup(
    createElement(AuthTopBar, { back: { onClick: () => {} }, backLabel: '이메일 다시 입력하기' }),
  )

  it('주소가 없는 단계 이동이라 링크가 아니라 버튼이다', () => {
    expect(markup).toMatch(/<button type="button"[^>]*\bsize-11\b/)
    expect(markup).not.toContain('<a')
    expect(markup).toContain('<span class="sr-only">이메일 다시 입력하기</span>')
  })
})
