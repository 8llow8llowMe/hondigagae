import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ProfileCard } from '@/features/home/profile-card'
import { pet } from '@/test/fixtures/plan'

/**
 * 홈 좌측 레일의 프로필 블록.
 *
 * **이 파일이 생긴 이유는 세로 여백 하나다** (#428). `py-10`(40)은 로그인 + 반려견이
 * 선택된 상태에서만 렌더되는 갈래라 로컬 mock(게스트)에서는 브라우저로 볼 수 없다.
 * 값이 조용히 되돌아가지 않게 여기서 잠근다.
 */

function classesOf(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) =>
    (match[1] ?? '').split(/\s+/).filter((name) => name !== ''),
  )
}

describe('ProfileCard — 반려견이 선택된 갈래', () => {
  const markup = renderToStaticMarkup(createElement(ProfileCard, { pets: [pet], totalCount: 1 }))

  it('세로 여백이 py-10(40)이다', () => {
    /*
      **32 → 40** (#428). 예전 근거는 "위아래가 각각 날짜 줄·판정 줄과 맞닿아 있어서"
      였는데, 3a 에서 날짜 줄이 판정 카드로 옮겨 가 위쪽이 카드 경계가 됐다. 위가 여백이
      아니라 선이 되면 같은 32 라도 더 조여 보인다.

      40 은 `DESIGN.md` §4 스케일 안 값이다 (4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 …).
    */
    const classes = classesOf(markup)

    expect(classes).toContain('py-10')
    expect(classes).not.toContain('py-8')
  })

  it('카드 안 인셋(16/20)을 쓴다 — 페이지 인셋 40 을 쓰면 내용이 두 번 밀린다', () => {
    const classes = classesOf(markup)

    expect(classes).toContain('px-4')
    expect(classes).toContain('md:px-5')
    expect(classes).not.toContain('md:px-10')
  })

  it('블록 자체는 배경을 칠하지 않는다 — 각진 면이 감싸는 카드의 모서리를 덮는다', () => {
    /*
      배너에서 실제로 났다 (#428). 카드 안 면은 `Surface` 가 소유한다.

      **폭을 꽉 채우는 요소만 본다** — 루트와 그 안 트리거 두 개다. 안쪽 특성 태그
      (`bg-band` · `bg-metric-high-100`)는 inline pill 이라 모서리에 닿지 않는다.
      전체 마크업에서 `bg-` 를 싹 금지하면 그 태그들까지 잡혀 오탐이 난다.
    */
    const blockClasses = [...markup.matchAll(/class="([^"]*)"/g)]
      .slice(0, 2)
      .flatMap((match) => (match[1] ?? '').split(/\s+/))

    expect(blockClasses.filter((name) => /^bg-/.test(name))).toEqual([])
  })

  it('반려견이 없으면 등록 유도 행으로 떨어진다', () => {
    const empty = renderToStaticMarkup(createElement(ProfileCard, { pets: [], totalCount: 0 }))

    expect(empty).toContain('href="/pets/new"')
    expect(empty).not.toContain('py-10')
  })
})
