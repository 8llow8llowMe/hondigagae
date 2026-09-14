import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { BackLink } from '@/components/back-link'

/**
 * 돌아가기 링크의 두 모습 — 이슈 #539.
 *
 * `titleRow` 는 **일정 세 화면**(장소 담기 · 응급 · 하루 재생성)만 쓴다. 그 셋은 `h1` 이
 * 보이는 화면이라 제목 줄이 실재한다. 마이페이지 하위 두 화면(`h1` 이 `sr-only`, 뒤로가기가
 * L0)과 장소 상세(breadcrumb 의 첫 조각)는 제목 줄 자체가 없어 기본 모습을 그대로 쓴다.
 */

/**
 * 클래스를 토큰으로 쪼갠다.
 *
 * **`toContain` 으로 클래스를 보면 안 된다** — `min-w-11` 이 `w-11` 을, `not-sr-only` 가
 * `sr-only` 를 부분 문자열로 품어 오탐한다. `surface.test.ts` 가 같은 함정에 걸린 적이 있다.
 */
function classesOf(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) =>
    (match[1] ?? '').split(/\s+/).filter((name) => name !== ''),
  )
}

function render(props: Parameters<typeof BackLink>[0]): string {
  return renderToStaticMarkup(createElement(BackLink, props))
}

const BASE = { href: '/plans/1', label: '일정으로 돌아가기' } as const

describe('BackLink — 접근성 이름', () => {
  /*
    **이름의 출처를 하나로 둔다.** 이슈 #539 는 `aria-label="..."` 을 달라고 했지만,
    라벨 텍스트를 DOM 에 두고 시각적으로만 감추는 쪽을 골랐다 — `aria-label` 을 따로 두면
    문구를 고칠 때 한쪽만 고치는 사고가 나고, 그때 **보이는 말과 읽히는 말이 갈린다**.
  */
  it('두 모습 모두 라벨 텍스트를 DOM 에 남긴다 — 브레이크포인트가 이름을 바꾸지 않는다', () => {
    expect(render(BASE)).toContain(BASE.label)
    expect(render({ ...BASE, variant: 'titleRow' })).toContain(BASE.label)
  })

  it('aria-label 을 쓰지 않는다 — 이름은 보이는 문구와 같은 출처에서 나온다', () => {
    expect(render({ ...BASE, variant: 'titleRow' })).not.toContain('aria-label')
  })
})

describe('BackLink — 기본 모습 (variant 미지정)', () => {
  /*
    **손대지 않기로 한 호출부를 잠근다** (#539). `BackLink` 는 공용이라 모습을 바꾸면
    장소 상세 breadcrumb 과 마이페이지 L0 까지 따라온다. breadcrumb 에서 `장소 목록으로` 가
    아이콘만 되면 `› 제목` 앞에 화살표만 남아 경로가 말이 안 된다 — 그래서 기본값이
    옛 모습이어야 하고, 그 사실을 여기서 지킨다.
  */
  it('라벨을 감추지 않는다', () => {
    const classes = classesOf(render(BASE))

    expect(classes).not.toContain('sr-only')
    expect(classes).not.toContain('md:not-sr-only')
  })

  it('제 줄을 차지하지 않는다 — 제목 줄 배치는 titleRow 만의 일이다', () => {
    expect(classesOf(render(BASE))).not.toContain('md:basis-full')
  })

  /*
    **화살표 모습까지 그대로다.** 이 잠금이 없으면 `titleRow` 를 손보다가 아이콘을 공통으로
    올려 네 호출부(장소 상세 ×3 + `not-found`, 마이페이지 ×2)의 모습이 조용히 바뀐다 —
    실제로 이 이슈 구현 중 한 번 그렇게 됐다.
  */
  it('글리프 화살표를 유지한다 — 손대지 않기로 한 호출부의 모습이 바뀌지 않는다', () => {
    expect(render(BASE)).toContain('←')
  })
})

describe('BackLink — titleRow 모습', () => {
  it('모바일에서만 라벨을 시각적으로 감춘다', () => {
    const classes = classesOf(render({ ...BASE, variant: 'titleRow' }))

    expect(classes).toContain('sr-only')
    expect(classes).toContain('md:not-sr-only')
  })

  /*
    **자리 이동을 노드 하나로 한다.** `md:hidden` / `hidden md:block` 으로 두 벌을 두면
    라벨 문구가 두 곳이 되어 위의 "이름의 출처는 하나" 가 무너진다. `flex-wrap` 부모에서
    `basis-full` 이 한 줄을 통째로 차지하므로, 데스크톱에서는 지금처럼 제목 **위**에 선다.
  */
  it('데스크톱에서 제 줄을 갖는다 — 모바일에서는 제목 옆에 붙는다', () => {
    expect(classesOf(render({ ...BASE, variant: 'titleRow' }))).toContain('md:basis-full')
  })

  /*
    아이콘만 남는 모바일에서도 44px 를 지킨다 (DESIGN.md §7). 세로는 `h-11` 이 원래
    갖고 있었지만, 라벨이 빠지면 **가로가 아이콘 폭으로 쪼그라든다** — 그쪽은 새로 막는다.
  */
  it('아이콘만 남아도 44x44 를 지킨다', () => {
    const classes = classesOf(render({ ...BASE, variant: 'titleRow' }))

    expect(classes).toContain('h-11')
    expect(classes).toContain('min-w-11')
    // 라벨이 돌아오는 데스크톱에서는 최소 폭이 자리를 낭비하므로 푼다
    expect(classes).toContain('md:min-w-0')
  })

  it('화살표는 이름을 만들지 않는다 — 라벨 텍스트가 그 일을 한다', () => {
    expect(render({ ...BASE, variant: 'titleRow' })).toContain('aria-hidden')
  })
})
