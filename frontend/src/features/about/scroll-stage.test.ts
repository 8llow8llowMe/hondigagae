import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ScrollStage, ScrollStagePoint, stageClassName } from '@/features/about/scroll-stage'
import { activeStepLine, stepAt } from '@/features/about/use-active-step'
import { readSourceWithoutComments } from '@/test/source'
import { readGlobalsCss } from '@/test/tokens'

/**
 * 스크롤 무대 (#914, 명세 `docs/superpowers/specs/2026-09-25-about-interactive-design.md` §3).
 *
 * **정적 렌더가 마지막 단계(전부 보임)다.** 검색 봇 · JS 실패 · 감속 모션이 전부 끝 상태를
 * 본다. 그 계약이 셋으로 나뉘어 있어 셋 다 잠근다 — 훅의 첫 상태, 래퍼의 플래그, CSS 의
 * "아직 안 온 단계만 숨김" 규칙.
 */

/** 무대 래퍼의 여는 태그만 — 마크업 전체에서 클래스를 찾으면 자식에 속아 통과한다 */
function stageOpenTag(markup: string): string {
  return markup.match(/<div class="about-stage[ "][^>]*>/)?.[0] ?? ''
}

function renderStage(count: number, context?: string) {
  const points = Array.from({ length: count }, (_, index) =>
    createElement(ScrollStagePoint, {
      key: index,
      index: index + 1,
      children: createElement('p', null, `항목 ${index + 1}`),
    }),
  )
  return renderToStaticMarkup(
    createElement(ScrollStage, {
      count,
      copy: createElement('ul', null, points),
      visual: createElement('p', null, '예시'),
      ...(context === undefined ? {} : { context: createElement('span', null, context) }),
    }),
  )
}

describe('stageClassName — 단계 → 래퍼 클래스', () => {
  it('누적 플래그다 — 단계 3 이면 is-step-1 · 2 · 3', () => {
    const cls = stageClassName(3, false).split(' ')
    expect(cls).toEqual(expect.arrayContaining(['is-step-1', 'is-step-2', 'is-step-3']))
    expect(cls).not.toContain('is-step-4')
  })

  it('지금 단계 하나만 is-current 다', () => {
    const cls = stageClassName(2, false).split(' ')
    expect(cls.filter((name) => name.startsWith('is-current-'))).toEqual(['is-current-2'])
  })

  it('단계 0 에는 is-step 이 하나도 없다 — 무대에 아직 들어오지 않았다', () => {
    expect(stageClassName(0, true)).not.toContain('is-step-')
  })

  it('is-live 는 재기가 걸렸을 때만 붙는다', () => {
    expect(stageClassName(2, false).split(' ')).not.toContain('is-live')
    expect(stageClassName(2, true).split(' ')).toContain('is-live')
  })

  it('is-settling 은 첫 맞춤 동안만 붙는다 — 기본값은 없음', () => {
    expect(stageClassName(0, true).split(' ')).not.toContain('is-settling')
    expect(stageClassName(0, true, true).split(' ')).toContain('is-settling')
  })

  it('is-heading-gone 은 절 제목이 헤더 밑으로 들어갔을 때만 붙는다 (#940) — 기본값은 없음', () => {
    expect(stageClassName(1, true).split(' ')).not.toContain('is-heading-gone')
    expect(stageClassName(1, true, false, true).split(' ')).toContain('is-heading-gone')
  })
})

describe('activeStepLine — 기준선 (#940)', () => {
  it('헤더 아래 화면의 가운데다 — 고정 카드의 중심과 같은 선', () => {
    expect(activeStepLine(800, 64)).toBe(432)
    expect(activeStepLine(680, 64)).toBe(372)
    // 헤더가 없으면 뷰포트 가운데로 돌아간다
    expect(activeStepLine(900, 0)).toBe(450)
  })
})

describe('stepAt — 중심들 → 단계 (명세 2026-09-25 §3-4 · #940)', () => {
  /*
    **식 자체를 잠근다.** 훅은 node 에서 돌릴 수 없어 소스 가드만으로는 한 칸 어긋남 ·
    방향 뒤집힘 · 사이를 아래 항목으로 세는 실수가 전부 통과한다 (검토 Minor 2).
    기준선 450 · 항목 셋의 중심이 [center] 에 선 경우들.
  */
  const line = 450
  it.each([
    ['아직 안 왔다 — 전부 기준선 아래', [600, 1100, 1600], 0],
    ['첫 항목 중심이 기준선에 막 닿았다', [450, 950, 1450], 1],
    ['첫 항목 중심이 기준선 위 · 둘째는 아래', [200, 722, 1244], 1],
    ['기준선이 1·2 중심 사이에 있다 — 위 항목', [-80, 460, 980], 1],
    ['둘째 항목 중심이 기준선을 지났다', [-300, 400, 922], 2],
    ['무대를 지나왔다 — 마지막 번호', [-2000, -1500, -1000], 3],
  ] as const)('%s', (_, centers, expected) => {
    expect(stepAt(centers, line)).toBe(expected)
  })

  it('등록되지 않은 항목(null)은 건너뛰되 번호는 원래 자리로 센다', () => {
    expect(stepAt([-900, null, -100], line)).toBe(3)
    expect(stepAt([null, 300, 900], line)).toBe(2)
  })
})

describe('ScrollStage — 정적 렌더는 마지막 단계다', () => {
  const markup = renderStage(3)
  const open = stageOpenTag(markup)

  it('래퍼에 is-step-1 … is-step-N 이 전부 있다', () => {
    expect(open).not.toBe('')
    for (const step of [1, 2, 3]) expect(open).toContain(`is-step-${step}`)
    expect(open).toContain('is-current-3')
  })

  it('정적 렌더에는 is-live 가 없다 — 마지막 단계의 강조가 눌어붙지 않는다', () => {
    expect(open).not.toContain('is-live')
  })

  it('항목이 전부 켜져 있다', () => {
    const items = markup.match(/<li class="[^"]*about-stage-point[^"]*"/g) ?? []
    expect(items).toHaveLength(3)
    for (const item of items) expect(item).toContain('is-on')
  })

  it('지금 항목(is-active)은 마지막 하나 · 나머지는 지나온 항목(is-past)이다', () => {
    const items = markup.match(/<li class="[^"]*about-stage-point[^"]*"/g) ?? []
    expect(items.map((item) => /\bis-active\b/.test(item))).toEqual([false, false, true])
    expect(items.map((item) => /\bis-past\b/.test(item))).toEqual([true, true, false])
  })

  it('항목 문장이 순서대로 li 안에 있다 — 읽는 순서가 끝 상태다', () => {
    const order = ['항목 1', '항목 2', '항목 3'].map((text) => markup.indexOf(text))
    expect(order.every((position) => position > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('예시 열에 about-stage-visual 이 있다 — sticky 는 CSS 가 준다', () => {
    expect(markup).toMatch(/<div class="about-stage-visual[ "]/)
  })

  it('예시는 sticky 틀 안의 덩어리(about-stage-frame)에 선다 (#940)', () => {
    expect(markup).toMatch(
      /<div class="about-stage-visual[^"]*"><div class="about-stage-frame[^"]*"><div class="relative">/,
    )
  })

  it('카피 열이 about-stage-copy 다 — 꼬리 여백은 CSS 가 준다 (#940)', () => {
    expect(markup).toMatch(/<div class="about-stage-copy[ "]/)
  })

  it('맥락 줄은 context 를 줄 때만 선다 — 예시보다 앞, 같은 덩어리 안 (#940)', () => {
    expect(markup).not.toContain('about-stage-context')
    const withContext = renderStage(3, '맥락')
    expect(withContext).toMatch(
      /<div class="relative"><div class="about-stage-context"><span>맥락<\/span><\/div><p>예시<\/p>/,
    )
  })

  it('무대 밖의 ScrollStagePoint 도 켜진 채로 선다', () => {
    const alone = renderToStaticMarkup(
      createElement(ScrollStagePoint, { index: 2, children: createElement('p', null, 'x') }),
    )
    expect(alone).toMatch(/<li class="[^"]*\bis-on\b/)
  })
})

describe('useActiveStep — 소스 가드', () => {
  /*
    node 환경이라 스크롤을 돌릴 수 없다 — 동작은 브라우저 실측 몫이고(세부명세 D7), 여기서는
    그 동작을 이루는 조각이 소스에 있는지만 본다 (`reveal.test.ts` 와 같다).
  */
  const source = readSourceWithoutComments('src/features/about/use-active-step.ts')

  it('첫 상태가 count 다 — 정적 렌더가 끝 상태', () => {
    expect(source).toMatch(/useState\(count\)/)
  })

  it('감속 모션이면 재지 않는다', () => {
    expect(source).toContain('prefers-reduced-motion: reduce')
  })

  it('기준선은 헤더 아래 화면의 가운데이고 헤더 높이는 토큰에서 읽는다 (#940)', () => {
    expect(source).toContain('activeStepLine(window.innerHeight, headerHeight)')
    expect(source).toContain("getPropertyValue('--header-h')")
  })

  it('항목의 윗변이 아니라 중심을 잰다 (#940) — 58vh 칸의 가운데 문장이 기준선에서 켜진다', () => {
    expect(source).toContain('rect.top + rect.height / 2')
  })

  it('헤더 높이 토큰은 px 이다 — parseFloat 로 읽는 전제 (#940)', () => {
    const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
    const values = [...tokens.matchAll(/--header-h:\s*([^;]+);/g)].map((match) => match[1]?.trim())
    expect(values.length).toBeGreaterThan(0)
    for (const value of values) expect(value, value).toMatch(/^\d+px$/)
  })

  it('본문 크기가 바뀌어도 다시 잰다 — 스크롤 없이 문서 높이가 바뀌면 아래 무대가 어긋났다 (#940 검토)', () => {
    expect(source).toContain('new ResizeObserver(schedule)')
    expect(source).toContain('layout.observe(document.body)')
    expect(source).toContain('layout.disconnect()')
  })

  it('절 제목이 헤더 밑으로 들어갔는지 같은 프레임에 잰다 — 맥락 줄 (#940)', () => {
    expect(source).toContain("querySelector('h2')")
    expect(source).toMatch(/getBoundingClientRect\(\)\.bottom <= headerHeight/)
  })

  it('스크롤은 passive 이고 한 프레임에 한 번만 잰다', () => {
    expect(source).toMatch(/addEventListener\('scroll', schedule, \{ passive: true \}\)/)
    expect(source).toContain('requestAnimationFrame')
    expect(source).toMatch(/if \(frame !== 0\) return/)
  })

  it('cleanup 이 리스너 둘을 떼고 남은 프레임을 취소한다', () => {
    expect(source).toContain("removeEventListener('scroll', schedule)")
    expect(source).toContain("removeEventListener('resize', onResize)")
    expect(source).toContain('cancelAnimationFrame(frame)')
    expect(source).toContain('cancelAnimationFrame(settle)')
  })

  it('첫 맞춤은 두 프레임 동안 settling 이다 — 되감기가 "지우기" 로 재생되지 않게', () => {
    expect(source).toMatch(/setSettling\(true\)\s*measure\(\)/)
    expect(source).toContain('requestAnimationFrame(() => setSettling(false))')
  })

  it('관측 사건에 기대지 않는다 — 빠른 스크롤에서 단계를 건너뛰었다 (#914 실측)', () => {
    expect(source).not.toContain('IntersectionObserver(')
  })

  it('최대값으로 누적하지 않는다 — 뒤로 스크롤하면 내려간다', () => {
    expect(source).not.toMatch(/Math\.max/)
  })
})

/** CSS 조각에서 `@media … { … }` 덩어리를 중괄호 짝을 세어 걷어 낸다 */
function stripMediaBlocks(css: string): string {
  let out = ''
  let index = 0
  while (index < css.length) {
    const start = css.indexOf('@media', index)
    if (start === -1) {
      out += css.slice(index)
      break
    }
    out += css.slice(index, start)
    let depth = 0
    let cursor = css.indexOf('{', start)
    for (; cursor < css.length; cursor += 1) {
      if (css[cursor] === '{') depth += 1
      if (css[cursor] === '}') depth -= 1
      if (depth === 0) break
    }
    index = cursor + 1
  }
  return out
}

describe('globals.css 소개 페이지 무대 블록', () => {
  const css = readGlobalsCss()
  /* 블록을 여는 주석의 `/*` 부터 자른다 — 중간부터 자르면 주석이 걷히지 않아 `#914` 가 색으로 읽힌다 */
  const start = css.lastIndexOf('/*', css.indexOf('소개 페이지 스크롤 무대'))
  // 다음 블록(캐릭터, #917)이 끝 — 캐릭터 블록은 자기 테스트(`about-character.test.ts`)가 본다
  const end = css.lastIndexOf('/*', css.indexOf('소개 페이지 캐릭터'))
  const block = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = [...block.matchAll(/([^{}]+)\{/g)].map((match) => (match[1] ?? '').trim())

  it('블록이 캐릭터 블록(과 감속 모션 블록) 위에 있다', () => {
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
  })

  it('강조(is-current · is-active · is-past · is-on)는 전부 is-live 아래에서만 칠한다', () => {
    const emphasis = selectors
      .flatMap((selector) => selector.split(',').map((part) => part.trim()))
      .filter((selector) => /is-current-|\.is-active|\.is-past|\.is-on\b/.test(selector))
    expect(emphasis.length).toBeGreaterThan(0)
    for (const selector of emphasis) expect(selector, selector).toContain('.is-live')
  })

  it('1024 미만은 항목 문장을 흐리지 않는다 — 예시가 아래에 있어 흐린 문장이 가리킬 그림이 없다 (#940)', () => {
    /* 블록에서 `@media` 덩어리를 전부 걷어 낸 나머지 — 첫 `@media` 앞만 보면 뒤의 최상위 규칙을 놓친다 */
    const outside = stripMediaBlocks(block)
    expect(outside).toContain('.about-stage-mark')
    expect(outside).not.toMatch(/about-stage-text \{[^}]*\bcolor: var/)
    expect(outside).not.toMatch(/:not\(\.is-on\) \.about-stage-text/)
    expect(outside).not.toMatch(/about-stage-point:not\(\.is-on\) \{/)
  })

  it('흐림은 불투명도가 아니라 --fg-muted 글자색이다 — --fg-subtle 은 읽는 텍스트에 쓰지 않는다 (#940 · DESIGN §2-2)', () => {
    const rule = block.match(/:not\(\.is-on\) \.about-stage-text \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toContain('color: var(--fg-muted);')
    expect(block).not.toContain('--fg-subtle')
    expect(block).not.toMatch(/about-stage-point:not\(\.is-on\) \{[^}]*opacity/)
  })

  it('지금 항목을 그림자로 두르지 않는다 — 그림자는 뜬 것에만 (DESIGN §6) · 연녹 밴드에서 사라졌다', () => {
    expect(block).not.toContain('box-shadow')
  })

  it('번호 선의 기본색은 브랜드(끝 상태)이고 회색은 is-live 아래에서만 칠한다', () => {
    expect(block).toMatch(
      /\.about-stage-point:not\(:last-child\)::after \{[^}]*background-color: var\(--brand-700\);/,
    )
    expect(block).toMatch(
      /\.about-stage\.is-live \.about-stage-point:not\(\.is-past\)::after \{\s*background-color: var\(--border\);/,
    )
  })

  it('틀의 위아래 여백이 같다 — 덩어리가 가운데 서면 카드 중심이 기준선에 온다 (#940)', () => {
    expect(block).toMatch(/\.about-stage-frame \{[^}]*padding-block: 3\.25rem;/)
  })

  it('예시 열은 헤더 아래 화면 높이의 sticky 틀이고 덩어리는 그 안 가운데다 (#940)', () => {
    const visual = block.match(/\.about-stage-visual \{([^}]*)\}/)?.[1] ?? ''
    expect(visual).toContain('position: sticky;')
    expect(visual).toContain('inset-block-start: var(--header-h);')
    expect(visual).toContain('block-size: calc(100dvh - var(--header-h));')
    // justify-content 가 아니라 auto 여백 — 창이 낮으면 위가 아니라 아래로 넘친다
    expect(visual).not.toContain('justify-content')
    expect(block).toMatch(/\.about-stage-frame \{[^}]*margin: auto;/)
  })

  it('꼬리 여백이 항목 칸 높이의 절반과 짝이다 — 마지막 항목이 켜지는 순간 예시가 풀린다 (#940)', () => {
    const point = block.match(/\.about-stage-point \{\s*min-block-size: (\d+)vh;/)?.[1]
    expect(point).toBe('58')
    expect(block).toMatch(
      /\.about-stage-copy \{\s*padding-block-end: calc\(50dvh - 29vh - var\(--header-h\) \/ 2\);/,
    )
  })

  it('항목 흐림도 is-live 아래에서만 — 정적 렌더의 항목은 흐리지 않다', () => {
    const dim = selectors.filter((selector) => selector.includes(':not(.is-on)'))
    expect(dim.length).toBeGreaterThan(0)
    for (const selector of dim) expect(selector).toContain('.is-live')
  })

  it('내용을 숨기는 규칙은 :not(.is-step-N) 뿐이다 — 플래그가 전부 붙으면 아무것도 숨지 않는다', () => {
    /*
      `opacity: 0` 을 주는 규칙의 선택자를 본다. 허용은 셋 — "아직 안 온 단계"
      (`:not(.is-step-N)`), 내용이 아닌 장식 의사 요소(강조 면 `::before` · 울림 `::after`),
      그리고 맥락 줄 제목의 `.is-live:not(.is-heading-gone)`(#940)이다. 맥락 줄 제목은 `h2` 를
      되풀이한 `aria-hidden` 이고 `is-live` 가 없는 정적 렌더에서는 숨지 않는다.
      무대 밖에서도 내용이 숨는 규칙이 생기면 정적 렌더가 끝 상태가 아니게 된다.
    */
    const hidingSelectors = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((match) => /opacity:\s*0\s*;/.test(match[2] ?? ''))
      .flatMap((match) => (match[1] ?? '').split(',').map((part) => part.trim()))
      .filter((selector) => selector !== 'from' && selector !== 'to')
    expect(hidingSelectors.length).toBeGreaterThan(0)
    for (const selector of hidingSelectors) {
      expect(
        /:not\(\.is-step-\d\)|::before|::after|\.is-live:not\(\.is-heading-gone\)/.test(selector),
        selector,
      ).toBe(true)
    }
  })

  it('색은 토큰만 쓴다 — hex 리터럴 · !important 가 없다', () => {
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(block).not.toContain('!important')
  })

  it('단계 0 의 칩은 누를 수도 포커스할 수도 없다 — 투명하기만 하면 켠 줄 모르는 필터가 생긴다 (#916)', () => {
    const rule =
      block.match(/\.about-stage:not\(\.is-step-1\) \.about-stage-chip \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toContain('visibility: hidden;')
    expect(rule).toContain('pointer-events: none;')
    expect(rule).toMatch(/visibility 0s 200ms/)
  })

  it('첫 맞춤(is-settling) 동안 무대 안 전환을 전부 끈다', () => {
    expect(block).toMatch(/\.about-stage\.is-settling \*,[\s\S]*?\{\s*transition: none;/)
  })

  it('포커스 링 모양(2px 브랜드 outline)을 강조에 쓰지 않는다 — 누를 수 없는 태그다', () => {
    expect(block).not.toContain('outline')
  })

  it('새 duration 을 만들지 않는다 — 200 · 150 · 800(울림, 곡선 길이 재사용) 만', () => {
    const durations = new Set([...block.matchAll(/(\d+)ms/g)].map((match) => match[1]))
    for (const value of durations) expect(['150', '200', '800']).toContain(value)
  })
})
