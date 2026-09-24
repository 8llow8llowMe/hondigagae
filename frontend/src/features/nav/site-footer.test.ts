import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SiteFooter } from '@/features/nav/site-footer'
import { LEGAL_LINKS } from '@/lib/legal/links'
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

    /*
      **푸터 전체가 아니라 출처 목록만 센다.** #610 에서 약관 링크가 들어오며 푸터에
      `<li>` 가 두 종류가 됐다 — 전체를 세면 링크를 하나 더할 때마다 이 단언이 엉뚱하게
      깨진다. 출처 제목과 그 뒤 첫 `</ul>` 사이를 잘라 그 안에서만 센다.
    */
    const sourcesList = markup.split(messages.footer.sourcesLabel)[1]?.split('</ul>')[0] ?? ''

    expect(sourcesList.match(/<li>/g)?.length).toBe(messages.footer.sources.length)
  })

  it('공모전 표기와 한계 안내를 남긴다', () => {
    expect(markup).toContain(messages.footer.contest)
    expect(markup).toContain(messages.footer.disclaimer)
  })

  /*
    이용약관·개인정보 처리방침은 #610 에서, `/about` 은 #611 에서 실제로 생긴 화면이다.
    **규칙은 그대로다** — 없는 링크를 만들지 않는다. 바뀐 것은 전제뿐이라 단언을
    "링크가 없다"(#399) → "/about 하나뿐"(#611) → **"이 셋 말고는 없다"** 로 옮긴다.
    문의는 여전히 페이지가 없어 들어오면 여기서 걸린다.
  */
  it('약관·처리방침 링크가 실재 라우트를 가리킨다', () => {
    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
      expect(markup).toContain(link.label)
    }
  })

  /*
    **개수가 아니라 목록을 센다.** 개수만 보면 죽은 링크 하나가 살아 있는 링크 하나와
    맞바뀌어도 통과한다. 순서는 DOM 순서다 — 약관 묶음이 `/about` 보다 위에 있다.
  */
  it('갈 곳 있는 링크만 둔다 — 약관 둘과 /about 뿐이다', () => {
    expect(markup.match(/href="([^"]*)"/g)).toEqual([
      ...LEGAL_LINKS.map((link) => `href="${link.href}"`),
      'href="/about"',
    ])
  })

  /*
    **누르는 자리 44** (#905 R3·R4). 글자만의 링크는 줄 높이(약 14px)만큼만 눌린다 —
    같은 푸터의 `/about` 과 같은 방식으로 높이를 준다. 여는 태그를 하나씩 떼어 본다
    (`/about` 이 이미 `h-11` 이라 마크업 전체에서 찾으면 통과해 버린다).
  */
  it('약관 링크 둘이 44px 탭 영역을 갖는다', () => {
    for (const link of LEGAL_LINKS) {
      const tag = [...markup.matchAll(/<a [^>]*>/g)]
        .map((match) => match[0])
        .find((open) => open.includes(`href="${link.href}"`))
      const classes = (/class="([^"]*)"/.exec(tag ?? '')?.[1] ?? '').split(' ')

      expect(classes).toContain('inline-flex')
      expect(classes).toContain('min-h-11')
      expect(classes).toContain('items-center')
    }
  })

  it('약관 링크 묶음에 랜드마크 이름을 준다', () => {
    expect(markup).toContain(`aria-label="${messages.footer.legalLabel}"`)
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

  /*
    **768 미만에는 탭바가 있다** — 그 위에 푸터가 또 붙으면 내비게이션이 두 겹이다.
    경계는 탭바의 `md:hidden` 과 같은 하나뿐이라, 태블릿을 따로 가르지 않는다.
  */
  it('768 미만에서는 감춰진다 — 탭바와 같은 경계다', () => {
    expect(globals).toMatch(/@media \(width < 48rem\) \{\s*\.site-footer \{\s*display: none;/)
  })

  /*
    **감춘 요소는 여백도 주지 못한다.** 예전에는 이 푸터의 `padding-block-end` 가 모바일
    하단 클리어런스였는데, 모바일에서 빠지면서 `.page-canvas` 가 물려받았다. 옮겨 간
    자리를 여기서도 잠근다 — 한쪽만 보면 여백이 통째로 사라져도 아무도 모른다.
  */
  it('탭바 자리는 .page-canvas 가 비운다 — 푸터가 아니다', () => {
    expect(/^\.site-footer \{[^}]*\}/m.exec(globals)?.[0]).toBeUndefined()

    const canvas = /^\.page-canvas \{[^}]*\}/m.exec(globals)?.[0]

    expect(canvas).toContain('padding-block-end: calc(var(--tabbar-h)')

    const md = /@media \(width >= 48rem\) \{\s*\.page-canvas \{[^}]*\}/.exec(globals)?.[0]

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
