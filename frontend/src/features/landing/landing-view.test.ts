import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { LandingView, type LandingViewProps } from '@/features/landing/landing-view'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'

const base: LandingViewProps = {
  heading: '제주 애견동반 숙소',
  intro: ['첫 문단이에요.', '둘째 문단이에요.'],
  places: [placeSummary],
  nextHref: '/jeju/pet-friendly-stays?after=1',
  firstHref: null,
  explorerHref: '/places?contentType=LODGING',
  related: [{ href: '/olle', label: '제주올레 강아지 산책 코스' }],
}

const render = (props: Partial<LandingViewProps> = {}) =>
  renderToStaticMarkup(createElement(LandingView, { ...base, ...props }))

describe('LandingView (#1134)', () => {
  it('검색어 그대로의 h1 이 보인다 — sr-only 가 아니다', () => {
    const markup = render()

    expect(markup).toMatch(/<h1 class="[^"]*text-title-1[^"]*">제주 애견동반 숙소<\/h1>/)
    expect(markup).not.toContain('<h1 class="sr-only"')
  })

  it('안내 문단과 장소 찾기 링크', () => {
    const markup = render()

    expect(markup).toContain('첫 문단이에요.')
    expect(markup).toContain('href="/places?contentType=LODGING"')
  })

  it('장소 행이 상세로 가는 링크다', () => {
    expect(render()).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('다음 페이지는 크롤러가 따라가는 <a href> 다', () => {
    expect(render()).toContain('href="/jeju/pet-friendly-stays?after=1"')
  })

  it('마지막 첫 페이지면 페이지 링크 줄이 없다', () => {
    expect(render({ nextHref: null })).not.toContain(messages.landing.nextPage)
  })

  it('다음 페이지에서는 처음부터 보기가 있다', () => {
    expect(render({ firstHref: '/jeju/pet-friendly-stays' })).toContain(messages.landing.firstPage)
  })

  it('0건이면 빈 상태(h3)와 처음부터 보기', () => {
    const markup = render({ places: [], nextHref: null, firstHref: '/jeju/pet-friendly-stays' })

    expect(markup).toContain(
      `<h3 class="text-body-1 text-fg font-semibold">${messages.landing.emptyTitle}</h3>`,
    )
    expect(markup).toContain(messages.landing.firstPage)
  })

  it('자주 묻는 질문은 dl 이고 세 쌍이다', () => {
    const markup = render()

    expect(markup).toContain('<dl')
    expect(markup.match(/<dt /g)).toHaveLength(messages.landing.faq.length)
    expect(messages.landing.faq).toHaveLength(3)
  })

  it('관련 링크', () => {
    expect(render()).toContain('href="/olle"')
  })
})
