/**
 * 인증 셸 — 이슈 #532 · #1283.
 *
 * **소스 문자열이 아니라 렌더 결과를 본다.** 형제인 `main-layout-surface.test.ts` 가
 * `readSourceWithoutComments` 를 쓰는 것은 `(main)` 레이아웃이 `readSession()` 을 부르는
 * **async 서버 컴포넌트라 렌더할 방법이 없어서**다 (`src/test/source.ts` 머리주석).
 * 이 레이아웃은 상태도 비동기도 없는 동기 컴포넌트라 그 우회가 필요 없고, 렌더로 보면
 * 클래스 문자열이 아니라 **실제 마크업과 접근성 이름**을 단언할 수 있다.
 *
 * `vitest.config.mts` 의 `include` 가 `app/**\/*.test.ts` 를 이미 열어 두고 있다.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import AuthLayout from './layout'

const CHILD = '로그인 폼 자리'
const markup = renderToStaticMarkup(
  createElement(AuthLayout, { children: createElement('p', null, CHILD) }),
)

const wrapper = markup.slice(0, markup.indexOf('>') + 1)
const mainTag = markup.slice(
  markup.indexOf('<main'),
  markup.indexOf('>', markup.indexOf('<main')) + 1,
)
const classes = (tag: string) => (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/)

describe('인증 셸 — 표식은 화면이 단다 (#1283)', () => {
  /*
    #532 는 락업을 셸에 뒀다. 하위 화면(가입 · 비밀번호 찾기)이 `←` 상단바를 달면서 락업과
    같은 첫 줄을 다투게 돼 화면으로 내렸다 — `AuthBrand` · `AuthTopBar` 머리주석.
  */
  it('셸은 락업을 그리지 않는다', () => {
    expect(markup).not.toContain('<svg')
    expect(markup).not.toContain('<header')
  })

  it('자식은 main 안에 든다', () => {
    const main = markup.slice(markup.indexOf('<main'), markup.indexOf('</main>'))

    expect(main).toContain(CHILD)
  })

  /*
    **높이를 잡는 곳은 하나다.** `min-h-dvh` 는 최소값이라 래퍼가 내용만큼 자란다 — 회원가입처럼
    긴 폼도 잘리지 않는다.
  */
  it('뷰포트 높이를 바깥 래퍼가 한 번만 잡는다', () => {
    expect(markup.match(/min-h-dvh/g)).toHaveLength(1)
    expect(mainTag).not.toContain('min-h-dvh')
  })
})

describe('인증 셸 — 모바일 한 면 · 데스크톱 카드 (#1283 C1)', () => {
  /*
    375 에서 카드는 화면을 거의 다 차지해 경계가 하는 일이 없고, 테두리와 좌우 여백이 겹쳐
    박스 안의 박스로 보였다. **회색 바닥 · 카드 외형은 전부 `md:` 아래에만 있어야 한다.**
  */
  it('회색 바닥은 768 이상에서만 칠한다', () => {
    expect(classes(wrapper)).toContain('md:bg-bg-sunken')
    expect(classes(wrapper)).not.toContain('bg-bg-sunken')
  })

  it('카드 외형(흰 면 · 테두리 · radius 12)은 768 이상에서만 든다', () => {
    const mainClasses = classes(mainTag)

    expect(mainClasses).toEqual(expect.arrayContaining(['md:bg-bg', 'md:border', 'md:rounded-lg']))
    for (const bare of ['border', 'rounded-lg', 'bg-bg']) expect(mainClasses).not.toContain(bare)
    // 16(`rounded-xl`)은 모달 · 바텀시트처럼 떠 있는 것의 신호다 (`surface.tsx`)
    expect(mainTag).not.toContain('rounded-xl')
  })

  /* 섹션은 페이지 위에 눕지 뜨지 않는다 — DESIGN.md §6 */
  it('카드에 그림자를 주지 않는다', () => {
    expect(mainTag).not.toMatch(/\bshadow-/)
  })

  /* 폭 제한이 래퍼에 있으면 데스크톱 회색이 384px 띠로만 칠해진다 */
  it('폭 제한은 main 이 갖는다 — 바닥은 전폭이다', () => {
    expect(wrapper).not.toContain('max-w-sm')
    expect(mainTag).toContain('max-w-sm')
  })

  /*
    **세로 가운데 정렬은 데스크톱에만** (C2). 모바일에서 가운데 정렬이면 화면마다 내용 높이가
    달라 넘길 때 첫 줄이 튄다.
  */
  it('모바일은 위쪽 정렬, 데스크톱 카드만 가운데다', () => {
    expect(classes(wrapper)).toContain('md:justify-center')
    expect(classes(wrapper)).not.toContain('justify-center')
  })
})
