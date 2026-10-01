import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ViewToggle } from '@/components/view-toggle'
import { messages } from '@/lib/messages'
import { readSourceWithoutComments as source } from '@/test/source'

function render(overrides: Partial<Parameters<typeof ViewToggle>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(ViewToggle, {
      current: 'map' as const,
      listHref: '/places?view=list',
      mapHref: '/places',
      ...overrides,
    }),
  )
}

/** 여는 `<a …>` 태그 하나 — 마크업 전체에 단언하면 아이콘 `svg` 의 속성에 속는다 */
function anchorTag(markup: string): string {
  return markup.slice(markup.indexOf('<a '), markup.indexOf('>', markup.indexOf('<a ')) + 1)
}

/**
 * 링크의 클래스 **낱말** 목록. `toContain('bg-bg')` 는 `bg-bg-sunken` 에도,
 * `toContain('before:-inset-y-1')` 은 `-inset-y-1.5` 에도 통과한다 — 낱말 단위로 대조한다.
 */
function classTokens(markup: string): string[] {
  return (/class="([^"]*)"/.exec(anchorTag(markup))?.[1] ?? '').split(/\s+/)
}

describe('ViewToggle — 갈 곳 하나만 말하는 글자 버튼 (#1125)', () => {
  /*
    예전에는 아이콘 두 칸 세그먼트였다(#240). 지금 상태와 갈 곳을 함께 말하느라 무겁고,
    아이콘만으로는 무엇을 하는지 바로 읽히지 않았다. 지금 보기는 화면이 말한다.
  */
  it('지도에서는 목록으로 가는 링크 하나다', () => {
    const markup = render({ current: 'map' })

    expect(markup.match(/<a /g)).toHaveLength(1)
    expect(anchorTag(markup)).toContain('href="/places?view=list"')
    expect(markup).toContain(`>${messages.map.showList}</a>`)
    expect(markup).not.toContain(messages.map.showMap)
  })

  it('목록에서는 지도로 가는 링크 하나다', () => {
    const markup = render({ current: 'list' })

    expect(markup.match(/<a /g)).toHaveLength(1)
    expect(anchorTag(markup)).toContain('href="/places"')
    expect(markup).toContain(`>${messages.map.showMap}</a>`)
    expect(markup).not.toContain(messages.map.showList)
  })

  /* 보이는 글자가 곧 이름이다 — `aria-label` 로 덮으면 읽는 이름과 보이는 이름이 갈린다 */
  it('이름을 따로 덮지 않는다 — 세그먼트 시절의 그룹·현재 표시도 없다', () => {
    const markup = render()

    expect(markup).not.toContain('aria-label=')
    expect(markup).not.toContain('role="group"')
    expect(markup).not.toContain('aria-current')
  })

  it('라벨이 "○○ 보기" 다', () => {
    expect(messages.map.showList).toBe('목록 보기')
    expect(messages.map.showMap).toBe('지도 보기')
  })
})

describe('ViewToggle — 크기는 자리가 정한다 (#1125)', () => {
  /* 지도 위 줄의 검색(44) · `내 위치`(44)와 높이가 맞아야 한다 */
  it('기본 md 는 44 이고 지도 위에 뜨는 그림자를 스스로 갖는다', () => {
    const tokens = classTokens(render())

    expect(tokens).toContain('h-11')
    expect(tokens).not.toContain('h-9')
    // 호출부가 `className` 으로 그림자를 덮지 않게 컴포넌트가 갖는다 (component-guide §3)
    expect(tokens).toContain('shadow-md')
  })

  /*
    카드 제목 줄에서 44 는 제목보다 무거웠다. 시각은 36 이고 누르는 자리는 `::before` 로
    위아래 6px 씩 넓힌다 (DESIGN §7 #905 R3). **기준 상자가 패딩 상자**라 36 − 테두리 2 = 34 에서
    시작한다 — 4px 이면 42 로 하한에 못 미친다. 6px 이면 46 이고 `Chip` `sm` 과 같은 값이다.
    `relative` 가 없으면 가상 요소가 링크가 아니라 바깥 상자에 붙는다.
  */
  it('sm 은 시각 36 이고 히트 영역을 46 으로 되찾는다', () => {
    const tokens = classTokens(render({ size: 'sm' }))

    expect(tokens).toContain('h-9')
    expect(tokens).not.toContain('h-11')
    expect(tokens).toContain('relative')
    expect(tokens).toContain('before:-inset-y-1.5')
    // 카드 제목 줄은 떠 있지 않다
    expect(tokens).not.toContain('shadow-md')
  })

  /* 바로 아래 `내 위치` 와 한 벌이다 — `ButtonLink secondary` 의 strong 테두리 · md 곡률이 아니다 */
  it('지도 위 떠 있는 컨트롤과 같은 표면이다', () => {
    const tokens = classTokens(render())

    expect(tokens).toContain('bg-bg')
    expect(tokens).toContain('border-border')
    expect(tokens).toContain('rounded-lg')
    expect(tokens).not.toContain('border-border-strong')
  })
})

/*
  **크기는 호출부가 고른다** — 빠뜨리면 기본 `md`(44 + 그림자)가 카드 제목 줄에 선다.
  여는 태그 하나로 범위를 좁힌다 (`readSourceWithoutComments` — 주석 속 낱말에 속지 않게).
*/
describe('ViewToggle — 호출부의 크기 (#1125)', () => {
  function toggleTags(path: string): string[] {
    const code = source(path)
    const tags: string[] = []
    let at = code.indexOf('<ViewToggle')
    while (at !== -1) {
      tags.push(code.slice(at, code.indexOf('/>', at)))
      at = code.indexOf('<ViewToggle', at + 1)
    }
    return tags
  }

  it.each([
    'app/(main)/places/(list)/page.tsx',
    'src/features/emergency/emergency-list-view.tsx',
    'src/features/plan/plan-add-place-view.tsx',
  ])('카드 제목 줄은 sm 이다 — %s', (path) => {
    const tags = toggleTags(path)

    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) expect(tag).toContain('size="sm"')
  })

  it.each([
    'src/features/place/place-map-view.tsx',
    'src/features/emergency/emergency-map-view.tsx',
  ])('지도 위는 기본 md 이고 그림자를 덮지 않는다 — %s', (path) => {
    const tags = toggleTags(path)

    expect(tags).toHaveLength(1)
    expect(tags[0]).not.toContain('size=')
    expect(tags[0]).not.toContain('className=')
  })
})
