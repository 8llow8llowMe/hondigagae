/**
 * `(main)` 레이아웃의 세로 뼈대 — 이슈 #456③.
 *
 * **소스를 문자열로 읽는다.** `app/(main)/layout.tsx` 는 `readSession()` 을 부르고
 * `prefetchQuery` 를 기다리는 async 서버 컴포넌트라 node 환경에서 렌더할 방법이 없다
 * (`testing-guide.md` §1). 여기서 지키려는 것도 렌더 결과가 아니라 **높이 계약**이다 —
 * 누가 뷰포트 높이를 잡고, 누가 그 남는 높이를 먹고, 탭바 자리는 어디가 비우는가.
 * `route-state-surface.test.ts` 와 같은 방식이다.
 *
 * **주석을 걷은 사본에 대해 단언한다 — 다만 지금은 어느 단언도 그것에 기대지 않는다.**
 * 확인한 결과를 그대로 적는다: `strip` 을 항등함수로 바꿔 돌려도 다섯 단언이 그대로
 * 통과하고, `pb-16` 을 되돌린 뮤테이션도 그대로 잡힌다. `layout.tsx` 의 주석이
 * `pb-16 md:pb-0` 을 걷어낸 이유로 인용하긴 하지만 `id="main"` 뒤가 아니라 **앞**에
 * 있어서, 자리를 보는 정규식(`/id="main"[^>]*\bpb-/`)에 걸리지 않는다.
 *
 * **그래도 걷는다.** 가장 노출된 것은 `min-h-dvh` 를 **한 번만** 세는 단언이다 —
 * 지금 주석은 `min-h` 까지만 적고 있지만 누가 근거를 적으며 `min-h-dvh` 를 그대로
 * 인용하는 순간 그 단언이 코드와 무관하게 깨진다. 이 저장소 주석은 근거를 길게 적어
 * 클래스명이 그대로 등장하고, 형제 파일(`route-state-surface.test.ts` · `plan-create-surface`)
 * 은 실제로 그것에 속은 전례(#451)가 있다.
 *
 * ### 여기서 잠그는 결정 셋
 *
 * 1. **뷰포트 높이는 레이아웃이 한 번 잡는다** (`flex min-h-dvh flex-col`). 내용이 짧은
 *    화면에서 L0 회색이 콘텐츠 높이에서 끊기고 그 아래로 흰 `body` 가 보이던 것이
 *    이 이슈의 출발이다 — 1280×900 `/places/<없는 id>` 실측: 회색이 274 에서 끝나고
 *    푸터 아래 **366px 가 맨 흰색**. `DESIGN.md §0` 의 "흰색은 바닥이 아니라 섹션의 색" 이
 *    거기서 뒤집힌다. **페이지마다 붙이지 않는다** — 그러면 같은 규칙이 열두 곳으로
 *    갈린다 (`route-state-surface.test.ts` 가 이 이슈로 미뤄 둔 결정이다).
 * 2. **남는 높이는 `Canvas` 가 `flex-1` 로 받는다.** `min-h: 100dvh - 헤더` 를 박는 안은
 *    같은 흰 공백을 없애지만 **없던 스크롤을 짧은 화면마다 만든다** — 푸터(260)가 통째로
 *    접힘 아래로 내려가기 때문이다. `flex-1` 은 푸터 자리를 남기고 나머지만 먹는다.
 * 3. **탭바 자리를 본문 래퍼가 비우지 않는다.** 예전 `pb-16 md:pb-0` 은 `Canvas` **밖**
 *    이라 모바일에서 회색 바닥과 푸터 사이에 흰 띠 64px 을 만들었다 (375×812 실측:
 *    회색이 266 에서 끝나고 푸터가 330 에서 시작). 그 자리는 이미 둘이 비우고 있다 —
 *    푸터는 자기 `padding-block-end`, 푸터가 빠지는 지도 화면은 `.map-canvas-height`.
 *
 * ### 실측 (이 커밋 뒤)
 *
 * | 화면 | 뷰포트 | 회색 바닥 | 푸터 | 문서 높이 |
 * | --- | --- | --- | --- | --- |
 * | `/places/<없는 id>` | 1280×900 | 64–640 | 640–900 | 900 (스크롤 없음) |
 * | `/places/<없는 id>` | 375×812 | 56–460 | 460–812 | 812 (스크롤 없음) |
 * | 지도(모바일) | 375×812 | 56–812 | 빠짐 | 812 (스크롤 없음) |
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { Canvas } from '@/components/surface'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** 블록 주석과 줄 주석을 걷은 소스 — 계약은 코드에만 있다 */
function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function code(relative: string): string {
  return strip(readFileSync(`${ROOT}${relative}`, 'utf8'))
}

const LAYOUT = 'app/(main)/layout.tsx'

describe('(main) 레이아웃 — 세로 뼈대', () => {
  it('뷰포트 높이를 레이아웃이 한 번 잡는다 — 페이지마다 min-h 를 붙이지 않는다', () => {
    const source = code(LAYOUT)

    expect(source).toContain('flex min-h-dvh flex-col')
    // 뼈대는 하나여야 한다. 둘이 되면 어느 쪽이 높이를 잡는지 화면마다 갈린다
    expect(source.match(/min-h-dvh/g)).toHaveLength(1)
  })

  it('머리 · 본문 · 푸터가 그 열 안에 있다 — 탭바만 fixed 라 밖이다', () => {
    const source = code(LAYOUT)
    const skeleton = source.indexOf('flex min-h-dvh flex-col')
    const closing = source.indexOf('</div>', source.indexOf('<SiteFooter />'))

    for (const inside of ['<GlobalHeader', 'id="main"', '<SiteFooter />']) {
      const at = source.indexOf(inside)
      expect(at).toBeGreaterThan(skeleton)
      expect(at).toBeLessThan(closing)
    }

    // 탭바가 열 안에 들어가면 `fixed` 인데도 자리를 한 번 더 차지한다
    expect(source.indexOf('<MobileTabBar')).toBeGreaterThan(closing)
  })

  it('본문 래퍼가 남는 높이를 먹고 Canvas 에 넘긴다', () => {
    expect(code(LAYOUT)).toMatch(/<div id="main" className="flex flex-1 flex-col">/)
  })

  /*
    **`pb-*` 가 `Canvas` 밖에 있으면 회색과 푸터 사이에 흰 띠가 생긴다.** 탭바 자리를
    비워야 한다는 요구 자체는 살아 있고, 그것을 비우는 두 곳을 아래에서 함께 잠근다 —
    한쪽이 사라지면 모바일 마지막 줄이 탭바 뒤로 들어간다.
  */
  it('탭바 자리를 본문 래퍼가 비우지 않는다 — 푸터와 지도가 각자 비운다', () => {
    expect(code(LAYOUT)).not.toMatch(/id="main"[^>]*\bpb-/)

    const css = readFileSync(`${ROOT}app/globals.css`, 'utf8')
    expect(css).toMatch(/\.site-footer\s*\{[^}]*padding-block-end:\s*calc\(var\(--tabbar-h\)/)
    expect(css).toMatch(
      /\.map-canvas-height\s*\{[^}]*100dvh - var\(--header-h\) - var\(--tabbar-h\)/,
    )
  })

  /*
    **높이를 주는 쪽과 받는 쪽을 한 파일에서 쌍으로 잠근다.** 한쪽만 보는 단언은
    드리프트를 못 잡는다 — 레이아웃에서 `flex-1` 을 떼든 `Canvas` 에서 떼든 회색 바닥은
    똑같이 끊기는데, 그때 깨지는 단언이 없으면 아무도 모른다 (#464 폭 드리프트를 잡은 방식).
  */
  it('Canvas 가 그 높이를 flex-1 로 받는다 — min-h 로 받지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(Canvas, { as: 'main', children: '내용' }))

    expect(markup).toContain('flex-1')
    /*
      `min-h` 로 받으면 푸터가 통째로 접힘 아래로 내려가 **없던 스크롤이 짧은 화면마다
      생긴다.** 그 안을 기각한 근거는 `surface.tsx` 의 `Canvas` 주석에 있다.
    */
    expect(markup).not.toMatch(/min-h-/)
  })
})
