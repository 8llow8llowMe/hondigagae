import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SiteFooter } from '@/features/nav/site-footer'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { readSource as repoSource } from '@/test/source'
import { readGlobalsCss } from '@/test/tokens'

/**
 * 전역 푸터 — 이슈 #399.
 *
 * **상태가 없는 서버 컴포넌트라 통째로 렌더된다** (`testing-guide.md` §1).
 */
const markup = renderToStaticMarkup(createElement(SiteFooter))
const globals = readGlobalsCss()

describe('SiteFooter — 내용 (#399)', () => {
  /* 이 푸터의 존재 이유다. 공모전 출품물이고 화면 곳곳이 공공데이터를 쓴다 */
  it('데이터 출처를 목록으로 남긴다', () => {
    expect(markup).toContain(messages.footer.sourcesLabel)

    for (const source of messages.footer.sources) {
      expect(markup).toContain(source)
    }
  })

  /*
    쉼표로 이은 한 문장으로 쓰면 스크린리더가 기관 이름 다섯 개를 한 덩어리로 읽는다.
    구분은 `gap` 이 하고, 가운뎃점을 문자로 끼우지 않는다 — 그것까지 읽힌다.
  */
  it('출처를 <ul> 로 둔다 — 한 문장으로 잇지 않는다', () => {
    expect(markup).toContain('<ul')
    expect(markup.match(/<li>/g)?.length).toBe(messages.footer.sources.length)
  })

  it('공모전 표기와 한계 안내를 남긴다', () => {
    expect(markup).toContain(messages.footer.contest)
    expect(markup).toContain(messages.footer.disclaimer)
  })

  /*
    이용약관·개인정보처리방침·문의는 아직 페이지가 없다. 자리만 잡아 두면 눌러 보고
    아무 일도 일어나지 않는다 — 없는 링크를 만들지 않는다.
  */
  it('갈 곳 없는 링크를 두지 않는다', () => {
    expect(markup).not.toContain('<a ')
    expect(markup).not.toContain('href')
  })
})

describe('SiteFooter — 자리 (#399)', () => {
  /* 헤더와 같은 구조다 (#376) — 캡을 바에 걸면 `border-t` 가 화면 가운데서 끊긴다 */
  it('바는 캡하지 않고 안쪽 div 만 content-container 다', () => {
    const bar = /<footer class="([^"]*)"/.exec(markup)?.[1]

    expect(bar).toBeDefined()
    expect(bar).not.toContain('content-container')
    expect(markup).toContain('content-container')
  })

  /* 왼쪽 기준선 40 을 지킨다 (#386 · #393). 문자열을 다시 적지 않는다 */
  it('좌우 인셋을 INSET_CLASS.main 으로 참조한다', () => {
    const source = repoSource('src/features/nav/site-footer.tsx')

    expect(source).toContain('INSET_CLASS.main')
    expect(markup).toContain(INSET_CLASS.main)
  })
})

describe('SiteFooter — 지도 화면에서는 빠진다 (#399)', () => {
  /*
    `.map-canvas-height` 는 `calc(100dvh - 헤더 - 탭바)` 라 그 화면은 이미 뷰포트를 정확히
    채운다 — 푸터가 붙으면 지도 화면에 페이지 스크롤이 생긴다.

    **레이아웃이 화면마다 분기하지 않는다.** 지도 쪽이 자기 성질로 빠진다.
  */
  it('전폭 지도가 있는 문서에서는 감춰진다', () => {
    expect(globals).toMatch(/body:has\(\.map-canvas-height\) \.site-footer \{\s*display: none;/)
  })

  /* 탭바가 `fixed` 라 마지막 줄이 그 뒤로 들어간다. 탭바는 768 미만에만 있다 */
  it('모바일에서 탭바 자리를 비우고, 768 이상에서는 비우지 않는다', () => {
    const base = /^\.site-footer \{[^}]*\}/m.exec(globals)?.[0]

    expect(base).toContain('var(--tabbar-h)')

    const md = /@media \(width >= 48rem\) \{\s*\.site-footer \{[^}]*\}/.exec(globals)?.[0]

    expect(md).toContain('padding-block-end: 0')
  })

  /*
    **조립처는 `AppShell` 한 곳이다** (#494). 예전에는 `(main)` 레이아웃이 직접 그렸는데,
    전역 404 가 같은 셸을 써야 하면서 뽑아냈다 — 라우트 그룹 레이아웃은 루트
    `not-found.tsx` 까지 닿지 않는다. **두 벌이 되면 한쪽만 고쳐진다.**
  */
  it('앱 셸이 푸터를 한 번만 조립한다', () => {
    const shell = repoSource('src/features/nav/app-shell.tsx')

    expect(shell).toContain('<SiteFooter />')
    expect(shell.match(/<SiteFooter/g)?.length).toBe(1)

    // 셸을 거치지 않고 따로 그리는 곳이 생기지 않았다
    for (const path of ['app/(main)/layout.tsx', 'app/not-found.tsx']) {
      expect(repoSource(path)).not.toContain('<SiteFooter')
    }
  })
})
