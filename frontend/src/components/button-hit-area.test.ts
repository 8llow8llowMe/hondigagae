import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Button, ButtonLink, type ButtonSize } from '@/components/button'

/**
 * `sm` 의 누르는 자리 — 이슈 #905 R3 (`docs/ux-review-2026-09-25.md` §2).
 *
 * **보이는 크기는 32 그대로이고 누르는 자리만 44 다.** 투명한 `::before` 가 위아래로
 * 8px 씩 나간다(테두리 1px 를 뺀 실측 32 + 14 = 46). 계산된 박스는 여기서 볼 수 없어 클래스로만 잠근다
 * (`testing-guide.md` §1) — 여는 태그 하나로 범위를 좁혀 본다.
 */
const HIT = [
  'relative',
  'before:absolute',
  'before:inset-x-0',
  'before:-inset-y-2',
  "before:content-['']",
]

function openTag(markup: string, tag: 'button' | 'a'): string {
  return new RegExp(`<${tag}[^>]*>`).exec(markup)?.[0] ?? ''
}

function buttonTag(size: ButtonSize, iconOnly = false): string {
  const markup = renderToStaticMarkup(
    iconOnly
      ? createElement(Button, { size, iconOnly: true, 'aria-label': '닫기' })
      : createElement(Button, { size, children: '추가' }),
  )
  return openTag(markup, 'button')
}

// `renderToStaticMarkup` 이 속성 안의 `'` 를 `&#x27;` 로 내보낸다 — `content-['']` 를 읽으려 되돌린다
function classesOf(tag: string): string[] {
  return (/class="([^"]*)"/.exec(tag)?.[1] ?? '').replaceAll('&#x27;', "'").split(' ')
}

describe('Button — sm 의 누르는 자리 (#905 R3)', () => {
  it('글자 버튼 sm 은 보이는 높이 h-8 을 두고 세로 히트 영역을 넓힌다', () => {
    const classes = classesOf(buttonTag('sm'))

    expect(classes).toContain('h-8')
    for (const cls of HIT) expect(classes).toContain(cls)
  })

  it('아이콘 버튼 sm 도 같다 — 폭은 늘리지 않는다', () => {
    const classes = classesOf(buttonTag('sm', true))

    expect(classes).toContain('h-8')
    expect(classes).toContain('w-8')
    for (const cls of HIT) expect(classes).toContain(cls)
  })

  it('md · lg 는 이미 44 이상이라 손대지 않는다', () => {
    for (const size of ['md', 'lg'] as const) {
      for (const iconOnly of [false, true]) {
        expect(buttonTag(size, iconOnly)).not.toContain('before:')
      }
    }
  })

  it('ButtonLink 도 같은 SIZE 를 공유한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ButtonLink, { href: '/plans', size: 'sm', children: '추가' }),
    )
    const classes = classesOf(openTag(markup, 'a'))

    for (const cls of HIT) expect(classes).toContain(cls)
  })

  /*
    사용처가 배치로 `absolute` 를 주면 그것이 이긴다 — 둘 다 `::before` 의 기준 상자가
    되므로 히트 영역은 그대로다. `relative` 가 남아 사용처 배치를 덮으면 안 된다.
  */
  it('사용처의 position 이 relative 를 이긴다', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { size: 'sm', className: 'absolute', children: '추가' }),
    )
    const classes = classesOf(openTag(markup, 'button'))

    expect(classes).toContain('absolute')
    expect(classes).not.toContain('relative')
  })
})
