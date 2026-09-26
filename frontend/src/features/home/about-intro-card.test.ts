import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AboutIntroCard } from '@/features/home/about-intro-card'
import { messages } from '@/lib/messages'
import { readSourceWithoutComments as source } from '@/test/source'

/** 비로그인 홈의 서비스 소개 카드 (#950) */
describe('AboutIntroCard', () => {
  const markup = renderToStaticMarkup(createElement(AboutIntroCard))

  it('/about 으로 간다', () => {
    expect(markup).toContain('href="/about"')
    expect(markup).toContain(messages.home.aboutIntroTitle)
    expect(markup).toContain(messages.home.aboutIntroDescription)
  })

  /*
    `Banner` 는 줄 전체가 `<a>` 다. × 가 그 안에 들어가면 대화형 요소가 겹친다 — HTML 이
    금지하고, 누르면 닫히는 대신 링크가 열린다. `</a>` 가 `<button` 보다 먼저 닫혀야 한다.
  */
  it('× 는 링크 밖, 형제다', () => {
    const anchorClose = markup.indexOf('</a>')
    const button = markup.indexOf('<button')

    expect(anchorClose).toBeGreaterThan(-1)
    expect(button).toBeGreaterThan(anchorClose)
  })

  it('× 는 icon-only 라 aria-label 이 이름이다', () => {
    const tag = /<button[^>]*>/.exec(markup)?.[0] ?? ''

    expect(tag).toContain(`aria-label="${messages.home.aboutIntroDismiss}"`)
    expect(tag).toContain('type="button"')
  })

  /* 누르는 자리 44 (DESIGN.md 터치 영역) — 아이콘 20 만으로는 손가락이 빗나간다 */
  it('× 의 누르는 자리는 44 다', () => {
    const tag = /<button[^>]*>/.exec(markup)?.[0] ?? ''

    expect(tag).toMatch(/\bsize-11\b/)
  })

  /* 홈에서 개는 올레 배너 한 마리다 (DESIGN.md §0-5) */
  it('캐릭터를 세우지 않는다', () => {
    expect(markup).not.toContain('data-character')
  })

  /** × 버튼의 `onClick` 본문만 — 파일 어디엔가 글자가 있는 것으로는 통과하지 않게 좁힌다 */
  function dismissHandler(): string {
    const card = source('src/features/home/about-intro-card.tsx')
    const button = card.indexOf('<button')
    const open = card.indexOf('onClick={() => {', button)
    const close = card.indexOf('}}', open)
    if (button < 0 || open < 0 || close < 0) throw new Error('× 버튼의 onClick 을 찾지 못했다')
    return card.slice(open, close)
  }

  /* 닫으면 다음 방문에도 서지 않아야 한다 — 화면에서 치우기만 하면 새로고침에 되살아난다 */
  it('× 는 쿠키를 쓰고 치운다', () => {
    expect(dismissHandler()).toMatch(/markAboutSeen\(\)\s*setDismissed\(true\)/)
  })

  /* 누른 버튼이 사라지면 초점이 body 로 떨어진다 — 다음 카드(AI 배너)의 링크로 넘긴다 */
  it('닫으면 초점을 다음 카드로 넘긴다', () => {
    const handler = dismissHandler()

    expect(handler).toContain("?.nextElementSibling?.querySelector<HTMLElement>('a, button')")
    expect(handler).toMatch(/setDismissed\(true\)\s*next\?\.focus\(\)/)
  })

  /*
    뒤로/앞으로 가기는 캐시된 페이로드(`showAboutIntro: true`)를 다시 쓴다 — 닫은 카드가
    되살아나지 않도록 브라우저가 쿠키를 본다. 서버 스냅숏은 `false` 라 하이드레이션은 서버 그림 그대로다.
  */
  it('뒤로 가기에서 되살아나지 않는다 — 브라우저가 쿠키를 한 번 더 본다', () => {
    const card = source('src/features/home/about-intro-card.tsx')

    expect(card).toContain('() => hasSeenAboutIn(document.cookie)')
    expect(card).toMatch(/hasSeenAboutIn\(document\.cookie\),\s*\(\) => false,?\s*\)/)
    expect(card).toContain('if (dismissed || seen) return null')
  })

  /* 서버 스냅숏이 false 라 서버 렌더에서는 카드가 선다 — 위의 markup 이 그 증거다 */
  it('서버 렌더에서는 선다', () => {
    expect(markup).toContain('<section')
  })
})
