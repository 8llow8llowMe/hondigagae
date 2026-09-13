/**
 * 인증 셸의 서비스 표식 — 이슈 #532.
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

describe('인증 셸 — 서비스 표식 (#532)', () => {
  /*
    이 이슈의 존재 이유다. `(auth)` 는 `AppShell` 밖이라 `GlobalHeader` 가 없어서
    넷 다 어느 서비스의 로그인 창인지 화면만 보고 알 수 없었다.
  */
  it('브랜드 락업을 셸이 그린다 — 페이지 넷이 각자 그리지 않는다', () => {
    expect(markup).toContain('<svg')
    // 워드마크는 라이브 텍스트가 아니라 아웃라인 SVG 다 (브랜드 명세 B4)
    expect(markup).toContain('<title>혼디가개</title>')
    expect(markup).toContain('aria-label="혼디가개"')
  })

  it('홈으로 가는 링크다 — 이 셸의 유일한 출구다', () => {
    expect(markup).toMatch(/<a[^>]*href="\/"/)
  })

  /*
    **`aria-label` 을 링크에 다시 붙이지 않는다** — `Wordmark` 의 `<svg role="img">` 가
    이미 이름을 들고 있어서 둘 다 있으면 스크린리더가 이름을 두 번 읽는다.
    `GlobalHeader` 의 로고 링크와 같은 규칙이고 근거는 브랜드 명세 B4 의 표에 있다.
  */
  it('링크가 자기 aria-label 을 갖지 않는다 — 이름은 워드마크가 준다', () => {
    const anchor = markup.slice(markup.indexOf('<a'), markup.indexOf('>', markup.indexOf('<a')) + 1)

    expect(anchor).not.toContain('aria-label')
    expect(markup.match(/aria-label="혼디가개"/g)).toHaveLength(1)
  })

  /* 심볼은 장식이다 — 워드마크가 이미 이름을 말하므로 두 번 읽히면 안 된다 */
  it('심볼은 aria-hidden 이다', () => {
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  /* 44px — 모바일 최소 터치 영역 (DESIGN.md §7) */
  it('로고 링크가 최소 터치 영역을 갖는다', () => {
    expect(markup).toMatch(/<a[^>]*class="[^"]*\bh-11\b/)
  })
})

describe('인증 셸 — 랜드마크와 높이 (#532)', () => {
  /*
    표식을 `<main>` 안에 넣으면 사이트 수준 내비게이션이 본문 랜드마크 안으로 들어간다.
    둘을 가르되 **높이·가운데 정렬은 바깥 래퍼가 갖는다** — `<main>` 이 그대로 들고 있으면
    표식이 뷰포트 맨 위에 박혀 폼과 140px 넘게 벌어진다.
  */
  it('header 가 main 보다 앞에 있고 둘이 갈려 있다', () => {
    const header = markup.indexOf('<header')
    const main = markup.indexOf('<main')

    expect(header).toBeGreaterThan(-1)
    expect(main).toBeGreaterThan(header)
    // 표식이 본문 랜드마크 안으로 들어가면 안 된다
    expect(markup.indexOf('</header>')).toBeLessThan(main)
  })

  it('자식은 main 안에 든다', () => {
    const main = markup.slice(markup.indexOf('<main'), markup.indexOf('</main>'))

    expect(main).toContain(CHILD)
    expect(main).not.toContain('<svg')
  })

  /*
    **높이를 잡는 곳은 하나다.** `<main>` 에 남아 있으면 래퍼와 둘이 잡아 표식이 묶음
    밖으로 밀린다. 내용이 길어도 잘리지 않는 근거이기도 하다 — `min-h-dvh` 는 고정
    높이가 아니라 최소값이라 래퍼가 내용만큼 자라고 `justify-center` 가 무효가 된다.
  */
  it('뷰포트 높이와 가운데 정렬을 바깥 래퍼가 한 번만 잡는다', () => {
    expect(markup.match(/min-h-dvh/g)).toHaveLength(1)

    const mainTag = markup.slice(
      markup.indexOf('<main'),
      markup.indexOf('>', markup.indexOf('<main')) + 1,
    )
    expect(mainTag).not.toContain('min-h-dvh')
    expect(mainTag).not.toContain('justify-center')
  })
})
