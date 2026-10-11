import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { HomeShortcuts } from '@/features/home/home-shortcuts'
import { messages } from '@/lib/messages'

function render(
  aiPlanHref: string = '/ai-plans/new',
  hospitalCaption: string = messages.home.emergencyDesc,
) {
  return renderToStaticMarkup(createElement(HomeShortcuts, { aiPlanHref, hospitalCaption }))
}

/** `href` 로 집은 칸 하나의 `<li>…</li>` */
function item(markup: string, href: string): string {
  const at = markup.indexOf(`href="${href}"`)
  if (at < 0) throw new Error(`칸이 없다: ${href}`)
  return markup.slice(markup.lastIndexOf('<li', at), markup.indexOf('</li>', at))
}

/*
  #1356 — 예전 좌측 레일 끝의 전폭 배너 셋(AI 일정 · 제주올레 · 동물병원)이 한 줄 세 칸이 됐다.
  375 에서 약 250px 이던 면적이 한 줄이 되고, 자리는 장소 추천 뒤로 옮겼다(`home-view.tsx`).
*/
describe('HomeShortcuts', () => {
  it('세 칸이 이 순서로 선다 — AI 일정 · 제주올레 · 동물병원', () => {
    const markup = render()
    const order = ['/ai-plans/new', '/olle', '/emergency'].map((href) =>
      markup.indexOf(`href="${href}"`),
    )

    expect(order.every((at) => at > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(markup.split('<li').length - 1).toBe(3)
  })

  /* 게스트는 홈이 `toLoginHref` 로 감싼 값을 넘긴다 — 칸은 받은 그대로 쓴다 */
  it('AI 칸은 넘겨받은 주소로 간다', () => {
    const guest = '/login?returnTo=%2Fai-plans%2Fnew'

    expect(render(guest)).toContain(`href="${guest.replace(/&/g, '&amp;')}"`)
  })

  it('칸마다 이름과 설명줄이 선다', () => {
    const markup = render('/ai-plans/new', '24시간 · 480m')

    expect(item(markup, '/ai-plans/new')).toContain(messages.home.aiPlanBannerTitle)
    expect(item(markup, '/ai-plans/new')).toContain(messages.home.aiPlanBannerDescription)
    expect(item(markup, '/olle')).toContain(messages.walkCourse.bannerTitle)
    expect(item(markup, '/olle')).toContain(messages.walkCourse.bannerDescription)
    expect(item(markup, '/emergency')).toContain(messages.home.emergencyTitle)
    expect(item(markup, '/emergency')).toContain('24시간 · 480m')
  })

  /*
    **danger 색은 병원 칸 하나다** — 배너 시절 `leading` 자리의 규칙 그대로. AI · 올레 칸까지
    칠하면 상시 진입점이 경보처럼 읽힌다.
  */
  it('병원 칸만 danger 색이다', () => {
    const markup = render()

    expect(item(markup, '/emergency')).toContain('text-danger-500')
    expect(item(markup, '/ai-plans/new')).not.toContain('danger')
    expect(item(markup, '/olle')).not.toContain('danger')
  })

  /* 셸의 랜드마크는 헤더 1 · nav 2 로 정해져 있다 (`(main)/layout.tsx`) */
  it('랜드마크를 늘리지 않는다 — 이름 붙은 목록이다', () => {
    const markup = render()

    expect(markup).not.toContain('<nav')
    expect(markup).toContain(`<ul aria-label="${messages.home.shortcutsLabel}"`)
  })

  /* 아이콘은 장식이다 — 이름은 글자가 말한다 */
  it('아이콘은 접근성 트리에서 빠진다', () => {
    for (const svg of render().match(/<svg[^>]*>/g) ?? []) {
      expect(svg).toContain('aria-hidden')
    }
  })

  /* 칸 하나가 44 를 넘는 누르는 자리다 (DESIGN.md 터치 타깃) */
  it('링크가 칸 전체를 채운다', () => {
    const link = /<a[^>]*href="\/olle"[^>]*>/.exec(render())?.[0] ?? ''

    expect(link).toContain('w-full')
    expect(link).toContain('min-h-11')
  })
})
