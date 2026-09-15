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

  /*
    44px — 모바일 최소 터치 영역 (DESIGN.md §7).

    **고정 `h-11` 이면 안 된다.** 심볼이 48px 이라 44px 상자 안에서 잘린다. 기준은
    최소값으로 지키고 내용이 더 크면 링크가 따라 자라야 한다.
  */
  it('로고 링크가 최소 터치 영역을 갖되 내용에 따라 자란다', () => {
    expect(markup).toMatch(/<a[^>]*class="[^"]*\bmin-h-11\b/)
    // 고정 높이가 되살아나면 48px 심볼이 잘린다. `min-h-11` 에 걸리지 않게 앞 경계를 본다
    expect(markup).not.toMatch(/<a[^>]*class="[^"]*[\s"]h-11\b/)
  })

  /*
    **락업을 2배로 그린다** — `DESIGN.md` §1 개정. 헤더(심볼 24 · 워드마크 20×74)와
    같은 크기로 두면 헤더가 없는 이 화면에서 유일한 신원 단서가 폼 위 각주처럼 읽힌다.
    두 값이 **같은 배율**이어야 락업 비율이 유지되므로 한 테스트에서 함께 본다.
  */
  it('심볼 48 · 워드마크 40×148 — 헤더의 정확히 2배다', () => {
    expect(markup).toMatch(/<svg[^>]*width="48"[^>]*height="48"/)
    expect(markup).toMatch(/<svg[^>]*height="40"[^>]*width="148"/)
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

describe('인증 셸 — 회색 바닥 위 카드', () => {
  const wrapper = markup.slice(0, markup.indexOf('>') + 1)
  const mainTag = markup.slice(
    markup.indexOf('<main'),
    markup.indexOf('>', markup.indexOf('<main')) + 1,
  )

  /*
    흰 폼을 흰 바닥에 올려 두면 입력할 영역의 경계가 화면에 없다. 나머지 35화면이 이미
    회색 바닥 위 흰 카드(`DESIGN.md §0`)인데 인증 넷만 다른 세계였다.
  */
  it('바닥이 L0 회색이다', () => {
    expect(wrapper).toContain('bg-bg-sunken')
  })

  /*
    **폭 제한이 바깥 래퍼에 남아 있으면 회색이 384px 띠로만 칠해진다.** 래퍼는 전폭이고
    가운데 정렬만 하며, `max-w-sm` 은 카드가 갖는다.
  */
  it('폭 제한은 카드가 갖는다 — 바닥은 전폭이다', () => {
    expect(wrapper).not.toContain('max-w-sm')
    expect(wrapper).toContain('items-center')
    expect(mainTag).toContain('max-w-sm')
  })

  /*
    L1 카드 — 흰 면 + 1px 테두리 + radius 12. **16 이 아니다**: 16(`rounded-xl`)은
    모달·바텀시트처럼 떠 있는 것의 신호라 섹션이 가져가면 그 신호가 죽는다
    (`surface.tsx` 머리주석 · DESIGN.md §5).
  */
  it('카드가 흰 면 · 테두리 · radius 12 다', () => {
    expect(mainTag).toContain('bg-bg')
    expect(mainTag).toContain('border-border')
    expect(mainTag).toMatch(/\brounded-lg\b/)
    expect(mainTag).not.toContain('rounded-xl')
  })

  /* 섹션은 페이지 위에 눕지 뜨지 않는다 — DESIGN.md §6 */
  it('카드에 그림자를 주지 않는다', () => {
    expect(mainTag).not.toMatch(/\bshadow-/)
  })

  /*
    **모바일에서도 테두리를 두른다.** `Surface` 가 768 미만에서 좌우 테두리를 걷는 것은
    페이지 폭을 다 쓰는 섹션의 규칙이고, 이 카드는 어느 폭에서도 384px 중앙 열이라
    전폭으로 펴질 일이 없다 — 좌우를 걷으면 회색 위에 위아래 선만 뜬다.
  */
  it('모바일에서 테두리를 걷지 않는다', () => {
    expect(mainTag).not.toContain('border-y')
    expect(mainTag).not.toContain('md:rounded-lg')
  })
})
