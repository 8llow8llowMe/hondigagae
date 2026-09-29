import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ReasonList } from '@/components/reason-list'

const FIVE = [
  { description: '첫째 근거' },
  { description: '둘째 근거' },
  { description: '셋째 근거' },
  { description: '넷째 근거' },
  { description: '다섯째 근거' },
]

function render(
  reasons: { description: string; informational?: boolean }[],
  informationalLayout?: 'inline' | 'grouped',
) {
  return renderToStaticMarkup(
    createElement(
      ReasonList,
      informationalLayout === undefined ? { reasons } : { reasons, informationalLayout },
    ),
  )
}

/** `ul` 마다 그 안의 `li` 문장을 순서대로 */
function listsOf(html: string): string[][] {
  return [...html.matchAll(/<ul[^>]*>(.*?)<\/ul>/g)].map((match) =>
    [...(match[1] ?? '').matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((li) => li[1] ?? ''),
  )
}

/** 경고 2 · 정보성 3 이 섞여 온 응답 — 사용자 실측(#1016)의 모양이다 */
const MIXED = [
  { description: '정보 1', informational: true },
  { description: '경고 1' },
  { description: '정보 2', informational: true },
  { description: '경고 2' },
  { description: '정보 3', informational: true },
]

/* 접기를 걷었다 (#840) — 아끼는 것이 한 줄인데 버튼이 44px 이라 순손실이었다 */
describe('ReasonList — 근거를 접지 않는다', () => {
  it('다섯 개를 주면 다섯 개가 다 선다', () => {
    const html = render(FIVE)

    for (const reason of FIVE) {
      expect(html).toContain(reason.description)
    }
  })

  it('펼침·접기 버튼을 그리지 않는다', () => {
    const html = render(FIVE)

    expect(html).not.toContain('<button')
    expect(html).not.toContain('aria-expanded')
  })

  /*
    **항목별 마크업을 갈라서 본다.** `toContain('text-fg"')` 로 보면 `cn()` 이 내놓는
    클래스 **순서**에 기대게 되어, 외형이 그대로여도 정렬만 바뀌면 깨지는 단언이 된다.
    여기서 증명해야 하는 것은 "두 종류가 다르게 렌더된다" 하나다.
  */
  it('정보성 근거만 한 단계 흐리다', () => {
    const html = render([
      { description: '감점 근거' },
      { description: '정보 근거', informational: true },
    ])

    const items = html.match(/<li[^>]*>[^<]*<\/li>/g) ?? []

    expect(items).toHaveLength(2)

    expect(items[0]).toContain('감점 근거')
    expect(items[0]).not.toContain('text-fg-muted')

    expect(items[1]).toContain('정보 근거')
    expect(items[1]).toContain('text-fg-muted')
  })

  /*
    **글머리 목록이다** (#905 R9). 같은 무게의 문단이 줄지어 서면 항목 경계가 안 보인다 —
    작은 점과 들여쓰기로 가른다. 점은 `bg-current` 라 정보성 항목에서는 글자와 함께 흐려진다.
  */
  it('항목마다 점 마커와 들여쓰기를 둔다 — 정보성 항목도 같다', () => {
    const html = render([
      { description: '감점 근거' },
      { description: '정보 근거', informational: true },
    ])

    const items = html.match(/<li[^>]*>/g) ?? []

    expect(items).toHaveLength(2)

    for (const item of items) {
      const classes = (/class="([^"]*)"/.exec(item)?.[1] ?? '').replaceAll('&#x27;', "'").split(' ')

      for (const cls of [
        'relative',
        'pl-4',
        'before:absolute',
        'before:left-0',
        'before:top-2',
        'before:size-1.5',
        'before:rounded-full',
        'before:bg-current',
        "before:content-['']",
      ]) {
        expect(classes).toContain(cls)
      }
    }
  })

  it('근거가 없으면 아무것도 그리지 않는다', () => {
    expect(render([])).toBe('')
  })
})

/*
  **일정 일자 판정 하나가 켠다** (#1016). 정보성을 경고 아래 작은 글씨 묶음으로 내려 첫 화면을
  되찾는다 — 문장 · 접지 않음 · 서버 순서는 그대로다.
*/
describe('ReasonList — informationalLayout="grouped"', () => {
  it('정보성을 경고 아래 두 번째 목록으로 모은다 — 각 묶음의 서버 순서는 그대로다', () => {
    expect(listsOf(render(MIXED, 'grouped'))).toEqual([
      ['경고 1', '경고 2'],
      ['정보 1', '정보 2', '정보 3'],
    ])
  })

  it('보조 묶음은 caption 글씨 · 좁은 간격이고, 경고 묶음은 기본 모양 그대로다', () => {
    const html = render(MIXED, 'grouped')
    const lists = [...html.matchAll(/<ul class="([^"]*)"/g)].map((match) => match[1]?.split(' '))

    expect(lists[0]).toContain('gap-2')
    expect(lists[1]).toContain('gap-1')

    const items = html.match(/<li[^>]*>[^<]*<\/li>/g) ?? []
    const warning = items.find((item) => item.includes('경고 1')) ?? ''
    const info = items.find((item) => item.includes('정보 1')) ?? ''

    expect(warning).toContain('text-body-2')
    expect(warning).not.toContain('text-caption')
    expect(info).toContain('text-caption')
    expect(info).toContain('text-fg-muted')
    expect(info).not.toContain('text-body-2')
  })

  it('접지 않는다 — 다섯 문장이 다 서고 버튼이 없다', () => {
    const html = render(MIXED, 'grouped')

    for (const reason of MIXED) expect(html).toContain(reason.description)
    expect(html).not.toContain('<button')
  })

  it('정보성이 없으면 inline 과 같은 마크업이다 — 빈 보조 묶음을 만들지 않는다', () => {
    const plain = [{ description: '경고 1' }, { description: '경고 2' }]

    expect(render(plain, 'grouped')).toBe(render(plain))
  })

  it('정보성만 있으면 보조 묶음 하나뿐이다', () => {
    const html = render([{ description: '정보 1', informational: true }], 'grouped')

    expect(listsOf(html)).toEqual([['정보 1']])
  })

  it('기본값은 inline 이다 — 다른 네 사용처의 모양이 그대로다', () => {
    expect(listsOf(render(MIXED))).toEqual([['정보 1', '경고 1', '정보 2', '경고 2', '정보 3']])
  })
})
