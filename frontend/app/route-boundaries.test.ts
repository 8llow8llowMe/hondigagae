import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { readSourceWithoutComments as code } from '@/test/source'

import HomeLoading from './(main)/(home)/loading'
import EmergencyLoading from './(main)/emergency/loading'
import MainError from './(main)/error'
import WalkCoursesLoading from './(main)/olle/(list)/loading'
import PlansLoading from './(main)/plans/(list)/loading'
import RootError from './error'
import GlobalError from './global-error'

/**
 * 루트 오류 경계 셋과 로딩 골격 넷 — 이슈 #907.
 *
 * **여기서는 렌더한다.** 형제 계약 테스트(`route-state-surface.test.ts`)는 소스를 문자열로
 * 읽지만, 이 일곱은 `async` 도 훅도 없는 순수 컴포넌트라 `renderToStaticMarkup` 으로
 * 실제 마크업을 볼 수 있다 (`testing-guide.md` §1). `retry` 는 콜백이라 눌러 볼 수 없으므로
 * **배선만** 소스로 잠근다 (`onRetry={retry}`).
 *
 * **표면 계약은 나눠 잠근다.** 로딩 넷의 가로 배치는 `route-state-surface.test.ts` 의
 * `LOADING_FILES` 가, 경계 셋의 제목 레벨은 `state-heading-level.test.ts` 가 본다. 경계 셋은
 * `STATE_FILES` 에 넣지 않았다 — 그 표는 `onRetry={reset}` 을 단언하는데 새 경계는 `retry` 라서다.
 * 그래서 `(main)/error.tsx` 의 바닥·폭·인셋은 **여기서** 잠근다.
 */
const RETRY = messages.common.retry
const HOME = messages.common.notFoundHomeAction
const TITLE = messages.common.temporaryErrorTitle

type Boundary = (props: { error: Error; retry: () => void }) => React.ReactElement

function render(component: () => React.ReactElement): string {
  return renderToStaticMarkup(createElement(component))
}

function renderBoundary(component: Boundary): string {
  return renderToStaticMarkup(
    createElement(component, { error: new Error('boom'), retry: () => undefined }),
  )
}

describe('오류 경계 셋 — 어느 층이 죽어도 한국어 화면과 출구가 있다 (#907)', () => {
  it.each([
    ['app/(main)/error.tsx', MainError],
    ['app/error.tsx', RootError],
    ['app/global-error.tsx', GlobalError],
  ] as const)('%s — main 랜드마크 · sr-only h1 · 5xx 톤 제목 · 다시 시도', (path, component) => {
    const markup = renderBoundary(component)

    expect(markup).toMatch(/<main[^>]*id="main-content"/)
    expect(markup).toContain(`<h1 class="sr-only">${TITLE}</h1>`)
    // 보이는 제목은 상태 컴포넌트의 h2 다 — 카드가 없으니 한 단 내리지 않는다
    expect(markup).toContain(`>${TITLE}</h2>`)
    expect(markup).toContain(messages.common.temporaryErrorDescription)
    expect(markup).toMatch(new RegExp(`<button[^>]*>${RETRY}</button>`))

    const source = code(path)
    expect(source).toContain("'use client'")
    /* `reset` 은 받아 둔 RSC 응답으로 다시 그려 서버 예외를 못 되살린다 — `retry` 는 refresh 한다 */
    expect(source).toContain('onRetry={retry}')
    expect(source).not.toContain('reset')
  })

  it('(main)/error.tsx — 셸이 남으므로 홈 버튼을 두지 않고 카드도 그리지 않는다', () => {
    const markup = renderBoundary(MainError)

    expect(markup).not.toContain(HOME)
    expect(markup).not.toMatch(/<a\b/)

    const source = code('app/(main)/error.tsx')
    /* 바닥은 `Canvas` 가 `main` 으로 깔고, 폭은 전역 404 와 같은 1440 캡이다 */
    expect(source).toContain('<Canvas as="main" id="main-content">')
    expect(source).not.toMatch(/<main[\s>]/)
    expect(source).toContain('<SurfaceStack className="content-container">')
    expect(code('app/not-found.tsx')).toContain('<SurfaceStack className="content-container">')
    expect(source).toMatch(/<ErrorState\b[^>]*inset="card"/)
    expect(source).not.toMatch(/<Surface\b(?!Stack|List)/)
    expect(source).not.toContain('AppShell')
  })

  it.each([
    ['app/error.tsx', RootError],
    ['app/global-error.tsx', GlobalError],
  ] as const)('%s — 셸이 없으므로 홈으로 가는 출구를 둔다', (path, component) => {
    const markup = renderBoundary(component)

    // 재시도 옆 두 번째 출구 — `ErrorState` 의 `action` 슬롯
    expect(markup).toMatch(new RegExp(`<a[^>]*href="/"[^>]*>${HOME}</a>`))
    // 셸을 모르는 채 그리지 않는다 — 로그아웃된 nav 가 뜨는 것이 더 나쁘다 (락업의 `header` 는 nav 가 아니다)
    expect(markup).not.toContain('<nav')
    expect(code(path)).not.toContain('AppShell')
  })

  it('app/error.tsx — 브랜드 락업이 홈 링크다 ((auth) 셸과 같은 골격)', () => {
    const markup = renderBoundary(RootError)

    expect(markup).toMatch(/<a[^>]*href="\/"[^>]*>[\s\S]*<svg/)
    expect(markup).toMatch(/<svg[^>]*width="48"[^>]*height="48"/)
    expect(markup).toMatch(/<svg[^>]*height="40"[^>]*width="148"/)
    // 락업 링크 + 홈 버튼 — 둘 다 `/` 다. 그 밖의 링크는 없다
    expect(markup.match(/<a\b/g)).toHaveLength(2)
  })

  it('app/global-error.tsx — 루트 레이아웃을 대체하므로 html/body 와 전역 스타일을 스스로 갖는다', () => {
    const markup = renderBoundary(GlobalError)

    expect(markup).toMatch(/^<html lang="ko">/)
    expect(markup).toContain('<body class="font-sans antialiased">')
    // 루트 레이아웃이 없어 metadata 가 조립되지 않는다 — 탭 제목을 스스로 준다
    expect(markup).toContain(`<title>${TITLE} · 혼디가개</title>`)

    const layout = code('app/layout.tsx')
    const source = code('app/global-error.tsx')
    for (const stylesheet of [
      "import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'",
      "import './globals.css'",
    ]) {
      expect(layout).toContain(stylesheet)
      expect(source).toContain(stylesheet)
    }
  })
})

describe('로딩 골격 넷 — 폴백 중에도 랜드마크와 이름이 선다 (#907)', () => {
  it.each([
    ['홈', HomeLoading, '혼디가개 홈'],
    ['일정 목록', PlansLoading, messages.plan.pageTitle],
    ['올레 목록', WalkCoursesLoading, messages.walkCourse.pageTitle],
    ['병원·약국', EmergencyLoading, messages.emergency.pageTitle],
  ] as const)('%s — main · sr-only h1 · aria-busy · 골격', (_, component, title) => {
    const markup = render(component)

    expect(markup).toMatch(/<main[^>]*id="main-content"/)
    expect(markup).toContain(`<h1 class="sr-only">${title}</h1>`)
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('animate-pulse')
    // 데이터를 지어내지 않는다 — 골격에 실제 값처럼 보이는 것이 없다
    expect(markup).not.toContain('undefined')
    expect(markup).not.toContain('null')
  })

  it('일정 목록 — 실화면과 같은 카드 이름표와 2단 grid', () => {
    const markup = render(PlansLoading)

    expect(markup).toMatch(/<main[^>]*class="[^"]*rail-layout rail-layout-filter/)
    expect(markup).toContain('id="plan-list-heading"')
    expect(markup).toContain(`>${messages.plan.pageTitle}</h2>`)
  })

  it('올레 목록 — 설명 줄은 고정 문구라 실제로 그린다', () => {
    const markup = render(WalkCoursesLoading)

    expect(markup).toContain('id="walk-course-list-heading"')
    expect(markup).toContain(messages.walkCourse.listDescription)
  })

  it('병원·약국 — grid 는 Canvas 가 아니라 안쪽 div 에 있다 (실화면과 같은 자리)', () => {
    const markup = render(EmergencyLoading)

    expect(markup).not.toMatch(/<main[^>]*class="[^"]*rail-layout/)
    expect(markup).toContain('<div class="rail-layout rail-layout-filter">')
    expect(markup).toContain('id="emergency-list-heading"')
  })

  it('홈 — 좌측 레일의 sticky 클래스가 실화면과 같은 자리에 있다', () => {
    const markup = render(HomeLoading)

    expect(markup).toContain('<div class="rail-layout">')
    expect(markup).toMatch(/class="[^"]*lg:sticky lg:top-16 lg:self-start lg:pr-3/)
  })

  /*
    **폴백이 풀린 직후의 홈은 대기 골격 셋을 그린다** — 판정·골든타임·권역·적합도가 전부
    클라이언트 조회라서다. 골격이 두 벌이면 그 순간 카드 높이가 갈리므로 **같은 컴포넌트**
    를 양쪽이 쓰는지 잠근다. 한쪽이 인라인으로 되돌아가면 여기가 깨진다.
  */
  it.each([
    ['WalkTimesSkeleton', 'src/features/insight/walk-times-section.tsx'],
    ['RegionalWeatherSkeleton', 'src/features/home/regional-weather-section.tsx'],
    ['SuitabilityListSkeleton', 'src/features/home/home-view.tsx'],
  ] as const)('홈 — %s 를 실화면(%s)과 함께 쓴다', (name, realSource) => {
    expect(code('app/(main)/(home)/loading.tsx')).toContain(`<${name} />`)
    expect(code(realSource)).toContain(`<${name} />`)
  })

  it('홈 — 권역 카드는 응답 전이라 제목이 없다 (실화면 골격과 같다)', () => {
    expect(render(HomeLoading)).not.toContain(messages.home.regionHeading)
  })
})
