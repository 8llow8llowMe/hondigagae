import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { BackLink } from '@/components/back-link'
import { classesOf } from '@/test/markup'

/**
 * 돌아가기 링크의 두 모습 — 이슈 #539.
 *
 * `titleRow` 는 **일정 세 화면**(장소 담기 · 응급 · 하루 재생성)만 쓴다. 그 셋은 `h1` 이
 * 보이는 화면이라 제목 줄이 실재한다. 마이페이지 하위 두 화면(`h1` 이 `sr-only`, 뒤로가기가
 * L0)과 장소 상세(breadcrumb 의 첫 조각)는 제목 줄 자체가 없어 기본 모습을 그대로 쓴다.
 *
 * **여기서 보는 것은 계약이지 클래스 목록이 아니다.** `md:basis-full` 이 실제로 줄바꿈을
 * 만드는지, 44px 가 실제로 44px 인지 같은 것은 이 환경(문자열 단언)이 알 수 없다 —
 * `e2e/back-link-title-row.spec.ts` 가 잰다. 클래스 단언을 여기 늘리면 구현을 두 번 적을 뿐
 * 잡는 것은 없다.
 */

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

  /*
    화살표가 둘(모바일 아이콘 · 데스크톱 글리프)이어도 **이름은 하나**여야 한다. 둘 중
    하나라도 `aria-hidden` 을 잃으면 스크린리더가 `← 일정으로 돌아가기 일정으로 돌아가기`
    같은 소리를 낸다. `icons/index.tsx` 의 `Svg` 가 `aria-hidden` 을 기본으로 주므로
    **글리프 쪽 `span` 이 진짜 검사 대상이다** — 마크업 전체를 훑으면 svg 때문에 항상 통과한다.
  */
  it('데스크톱 글리프가 이름을 만들지 않는다', () => {
    expect(render({ ...BASE, variant: 'titleRow' })).toContain('<span aria-hidden')
  })
})

describe('BackLink — 기본 모습 (variant 미지정)', () => {
  /*
    **손대지 않기로 한 네 호출부를 잠근다** (#539) — 장소 상세 ×3 + `not-found`, 마이페이지
    `password`/`withdraw`. `BackLink` 는 공용이라 모습을 바꾸면 전부 따라온다. breadcrumb 에서
    `장소 목록으로` 가 아이콘만 되면 `› 제목` 앞에 화살표만 남아 경로가 말이 안 된다.

    **이 describe 가 이 파일에서 가장 값이 나가는 자리다.** 아래 넷이 그 네 화면의 유일한
    안전망이다.
  */
  it('라벨을 감추지 않는다', () => {
    expect(classesOf(render(BASE))).not.toContain('sr-only')
  })

  it('아이콘을 쓰지 않는다 — 글리프 화살표 그대로다', () => {
    const markup = render(BASE)

    expect(markup).toContain('←')
    expect(markup).not.toContain('<svg')
  })

  /*
    **빈 `class=""` 도 출력 변화다.** `cn(false)` 는 `''` 를 내고 React 는 그것을
    `class=""` 로 렌더한다 — `|| undefined` 가 없으면 네 호출부의 DOM 이 조용히 바뀐다.
  */
  it('빈 class 속성을 남기지 않는다', () => {
    expect(render(BASE)).not.toContain('class=""')
  })

  it('레이아웃을 건드리지 않는다 — 제목 줄 배치는 titleRow 만의 일이다', () => {
    const classes = classesOf(render(BASE))

    expect(classes).not.toContain('-ml-4')
    expect(classes).not.toContain('-my-2')
  })
})

describe('BackLink — titleRow 모습', () => {
  /*
    **데스크톱은 `inline` 과 같은 모습이어야 한다** (#539 검토). 처음에는 `titleRow` 전체를
    아이콘으로 뒀는데, 그러면 데스크톱에서 일정 세 화면만 `‹` 가 되고 마이페이지·장소
    상세는 `←` 로 남아 **바꾸지 않기로 한 곳과의 불일치를 새로 만든다.**
  */
  it('아이콘은 모바일에서만 — 데스크톱에는 글리프가 함께 있다', () => {
    const markup = render({ ...BASE, variant: 'titleRow' })
    const classes = classesOf(markup)

    expect(markup).toContain('<svg')
    expect(markup).toContain('←')
    expect(classes).toContain('md:hidden')
  })

  it('모바일에서만 라벨을 감춘다', () => {
    const classes = classesOf(render({ ...BASE, variant: 'titleRow' }))

    expect(classes).toContain('sr-only')
    expect(classes).toContain('md:not-sr-only')
  })
})
