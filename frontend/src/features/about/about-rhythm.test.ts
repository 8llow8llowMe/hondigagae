import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AboutView } from '@/features/about/about-view'
import { HeroParallax, ScrollCue } from '@/features/about/hero-parallax'
import { ScaleCount } from '@/features/about/scale-count'
import { ScrollProgressBar } from '@/features/about/scroll-progress-bar'
import { SectionNav } from '@/features/about/section-nav'
import { SPLIT_WORD_STAGGER_MS, SplitHeading } from '@/features/about/split-heading'
import { messages } from '@/lib/messages'
import { readSourceWithoutComments } from '@/test/source'
import { readGlobalsCss } from '@/test/tokens'

/**
 * 첫 화면 리듬 (#915, 명세 `docs/superpowers/specs/2026-09-25-about-interactive-design.md` §4).
 *
 * 전부 **장식**이라 지키는 것은 셋이다 — 정적 렌더가 끝 상태인가, 접근성 트리를 어지르지
 * 않는가(한 문장 제목 · 랜드마크 없음 · 최종값), 새 길이 · 색을 만들지 않는가.
 */
const view = renderToStaticMarkup(createElement(AboutView))

describe('SplitHeading — 어절 등장 제목', () => {
  const text = messages.about.hero.heading
  const markup = renderToStaticMarkup(createElement(SplitHeading, { id: 'h', text }))
  const words = text.split(' ')

  it('h1 의 원문은 sr-only 한 문장이다 — 스크린리더가 조각으로 읽지 않는다', () => {
    expect(markup).toMatch(new RegExp(`^<h1 id="h"><span class="sr-only">${text}</span>`))
    expect(markup).not.toContain('aria-label')
  })

  it('어절마다 aria-hidden 조각이고 60ms 씩 늦게 선다', () => {
    const pieces = [
      ...markup.matchAll(
        /<span aria-hidden="true" class="about-split-word" style="animation-delay:(\d+)ms">([^<]*)</g,
      ),
    ]
    expect(pieces.map((piece) => piece[2])).toEqual(words)
    expect(pieces.map((piece) => Number(piece[1]))).toEqual(
      words.map((_, index) => index * SPLIT_WORD_STAGGER_MS),
    )
  })

  it('조각을 이으면 원문이다 — 어절 사이 공백이 텍스트로 남아 줄바꿈이 그대로 된다', () => {
    const pieces = markup.replace(/<span class="sr-only">[^<]*<\/span>/, '')
    expect(pieces.replace(/<[^>]+>/g, '')).toBe(text)
  })

  it('화면의 h1 이 SplitHeading 이다', () => {
    expect(view).toContain(`<h1 id="about-hero-heading" class=`)
    expect(view).toMatch(new RegExp(`id="about-hero-heading"[^>]*><span class="sr-only">${text}<`))
  })
})

describe('SectionNav — 절 내비', () => {
  const items = [
    { id: 'about-hero', label: messages.about.nav.top },
    { id: 'about-q1', label: messages.about.q1.kicker },
  ]
  const markup = renderToStaticMarkup(
    createElement(SectionNav, { label: messages.about.nav.label, items }),
  )

  it('랜드마크를 늘리지 않는다 — nav 가 아니라 이름 있는 목록이다', () => {
    expect(markup).not.toContain('<nav')
    expect(markup).not.toContain('role="navigation"')
    expect(markup).toContain(`<ul aria-label="${messages.about.nav.label}"`)
  })

  it('1280 이상에서만 선다', () => {
    const root = markup.match(/^<div class="([^"]*)"/)?.[1] ?? ''
    expect(root.split(' ')).toEqual(expect.arrayContaining(['hidden', 'xl:block', 'fixed']))
  })

  it('라벨은 1536 전까지 sr-only 다 — 1280 에서 본문에 닿지 않게', () => {
    expect(markup.match(/<span class="sr-only 2xl:not-sr-only">/g)).toHaveLength(items.length)
  })

  it('정적 렌더에는 현재 절이 없다 — 재기 전에 거짓 강조를 하지 않는다', () => {
    expect(markup).not.toContain('aria-current')
  })

  it('링크가 터치 영역 44 다', () => {
    for (const link of markup.match(/<a [^>]*>/g) ?? []) expect(link).toContain('min-h-11')
  })

  it('화면의 내비는 여섯 절이고 라벨은 각 절의 제목이다 — 표지어는 가는 곳을 말하지 못한다', () => {
    // sr-only 라벨 span 은 내비에만 있다 — 잘라 내지 않고 전부 센다(일곱 번째가 끼면 실패)
    const labels = [...view.matchAll(/<span class="sr-only 2xl:not-sr-only">([^<]*)</g)].map(
      (match) => match[1],
    )
    expect(labels).toEqual([
      messages.about.nav.top,
      messages.about.q1.heading,
      messages.about.q2.heading,
      messages.about.q3.heading,
      messages.about.q4.heading,
      messages.about.data.heading,
    ])
  })

  it('정적 렌더의 내비는 숨지 않았다 — inert 는 본문을 지난 뒤에만 붙는다', () => {
    expect(markup).not.toContain('inert')
    expect(markup).not.toContain('opacity-0')
  })
})

describe('ScrollCue · HeroParallax · ScrollProgressBar', () => {
  it('스크롤 힌트는 정적 렌더에 보이고 질문 1 절을 가리킨다', () => {
    // 절 내비의 `질문 1` 링크도 `#about-q1` 이라 힌트 문구가 든 링크를 집는다
    const cue =
      [...view.matchAll(/(<a href="#about-q1"[^>]*>)([\s\S]*?)<\/a>/g)].find((match) =>
        match[2]?.includes(messages.about.hero.scrollCue),
      )?.[1] ?? ''
    expect(cue).toContain('lg:inline-flex')
    expect(cue).not.toContain('opacity-0')
    expect(cue).not.toContain('aria-hidden')
    expect(view).toContain(messages.about.hero.scrollCue)
  })

  it('패럴랙스는 정적 렌더에 transform 이 없다', () => {
    const markup = renderToStaticMarkup(
      createElement(HeroParallax, { children: createElement('p', null, '카드') }),
    )
    expect(markup).toBe('<div><p>카드</p></div>')
  })

  it('진행선은 aria-hidden 장식이고 1024 이상에서는 없다', () => {
    const markup = renderToStaticMarkup(createElement(ScrollProgressBar))
    expect(markup).toBe('<div aria-hidden="true" class="about-progress lg:hidden"></div>')
  })

  it('스크롤 힌트 단독 렌더도 숨김 없이 선다', () => {
    const markup = renderToStaticMarkup(
      createElement(ScrollCue, { href: '#x', children: '내려가요' }),
    )
    expect(markup).not.toContain('tabindex')
    expect(markup).not.toContain('opacity-0')
  })
})

describe('ScaleCount — 규모 숫자', () => {
  const markup = renderToStaticMarkup(createElement(ScaleCount, { value: 315 }))

  it('최종값은 sr-only 로, 시각 노드도 정적 렌더에서는 최종값이다', () => {
    expect(markup).toBe(
      '<span><span class="sr-only">315</span><span aria-hidden="true">315</span></span>',
    )
  })
})

describe('소스 가드 — 스크롤 연동', () => {
  it('useScrollFrame 은 passive 스크롤 + 한 프레임에 한 번이고 cleanup 이 있다', () => {
    const source = readSourceWithoutComments('src/features/about/use-scroll-frame.ts')
    expect(source).toMatch(/addEventListener\('scroll', schedule, \{ passive: true \}\)/)
    expect(source).toMatch(/if \(frame !== 0\) return/)
    expect(source).toContain("removeEventListener('scroll', schedule)")
    expect(source).toContain('cancelAnimationFrame(frame)')
  })

  it('패럴랙스는 1024 이상 · 감속 모션 아님에서만 움직인다', () => {
    const source = readSourceWithoutComments('src/features/about/hero-parallax.tsx')
    expect(source).toContain("matchMedia('(min-width: 64rem)')")
    expect(source).toContain('prefersReducedMotion()')
  })

  it('카운트업은 한 곳(use-count-up)에만 있다 — 판정 카드와 규모 숫자가 같이 쓴다', () => {
    expect(readSourceWithoutComments('src/features/about/verdict-specimen.tsx')).not.toMatch(
      /function useCountUp/,
    )
    expect(readSourceWithoutComments('src/features/about/scale-count.tsx')).toContain(
      "from '@/features/about/use-count-up'",
    )
  })
})

describe('globals.css 감속 모션 규칙', () => {
  it('애니메이션 지연도 끈다 — 안 끄면 제목 어절이 60ms 간격으로 하나씩 튀어나온다 (#915)', () => {
    const css = readGlobalsCss()
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced.slice(0, reduced.indexOf('\n}\n'))).toContain('animation-delay: 0s !important;')
  })
})

describe('globals.css 첫 화면 리듬 블록', () => {
  const css = readGlobalsCss()
  const start = css.lastIndexOf('/*', css.indexOf('소개 페이지 첫 화면 리듬'))
  const end = css.indexOf('소개 페이지 스크롤 무대')
  const block = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '')

  it('블록이 무대 블록 위에 있다', () => {
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
  })

  it('어절 등장은 200ms · both 이고 시작 상태는 keyframes 의 from 이다', () => {
    expect(block).toMatch(/\.about-split-word \{[^}]*animation: about-word-in 200ms ease-out both;/)
    expect(block).toMatch(/@keyframes about-word-in \{\s*from \{[^}]*opacity: 0;/)
  })

  it('첫 화면 높이는 1024 이상에서만, 헤더를 뺀 높이다', () => {
    expect(block).toMatch(
      /@media \(width >= 64rem\) \{\s*\.about-hero-fill \{\s*min-block-size: calc\(100dvh - var\(--header-h\)\);/,
    )
  })

  it('절 앵커는 헤더 높이만큼 스크롤 여백을 둔다 — "처음" 이 맨 위로 간다', () => {
    expect(block).toMatch(/\.about-anchor \{\s*scroll-margin-top: var\(--header-h\);/)
    expect(view).toMatch(/<section id="about-hero"[^>]*class="[^"]*\babout-anchor\b/)
  })

  it('진행선은 헤더 바로 아래이고 헤더(z-40)보다 아래 층이다', () => {
    expect(block).toMatch(/\.about-progress \{[^}]*inset-block-start: var\(--header-h\);/)
    expect(block).toMatch(/\.about-progress \{[^}]*z-index: 30;/)
  })

  it('색은 토큰만 · 새 길이 없음', () => {
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    for (const [, ms] of block.matchAll(/(\d+)ms/g)) expect(['150', '200']).toContain(ms)
  })
})

describe('화면 — 등급 색을 장식에 쓰지 않는다', () => {
  it('절 내비 · 진행선에 metric- 가 없다', () => {
    const nav = view.slice(0, view.indexOf('<section'))
    expect(nav).toContain('about-progress')
    expect(nav).not.toContain('metric-')
  })
})
