import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { OfflineBanner, OfflineBannerView } from '@/features/nav/offline-banner'
import { messages } from '@/lib/messages'
import { readSourceWithoutComments } from '@/test/source'

/** 오프라인 띠 — 이슈 #912 */
describe('OfflineBannerView', () => {
  it('온라인이면 빈 라이브 영역만 남는다 — 높이 0, 끊기는 순간 읽힐 자리', () => {
    const markup = renderToStaticMarkup(createElement(OfflineBannerView, { offline: false }))

    expect(markup).toMatch(/^<div role="status"[^>]*><\/div>$/)
    expect(markup).not.toContain(messages.common.offlineBanner)
  })

  it('오프라인이면 같은 라이브 영역 안에 문구 한 줄이 선다', () => {
    const markup = renderToStaticMarkup(createElement(OfflineBannerView, { offline: true }))

    expect(markup).toMatch(/^<div role="status"[^>]*><p[^>]*>/)
    expect(markup).toContain(messages.common.offlineBanner)
  })

  it('헤더 바로 아래에 붙어 따라온다 — 헤더 높이와 같은 top, 헤더보다 한 단 아래 z', () => {
    const markup = renderToStaticMarkup(createElement(OfflineBannerView, { offline: true }))
    const root = markup.slice(0, markup.indexOf('>') + 1)

    expect(root).toContain('sticky top-14 z-30 md:top-16')
    // 헤더의 높이·z 와 짝이다 — 한쪽만 바뀌면 띠가 헤더 밑으로 숨거나 틈이 난다
    const header = readSourceWithoutComments('src/features/nav/global-header.tsx')
    expect(header).toContain('sticky top-0 z-40 box-border h-14')
    expect(header).toContain('md:h-16')
  })

  it('반전 띠다 — 등급(metric)·장애(danger) 색이 아니다', () => {
    const markup = renderToStaticMarkup(createElement(OfflineBannerView, { offline: true }))

    expect(markup).toContain('bg-fg text-fg-inverse')
    expect(markup).not.toMatch(/metric-|danger-/)
  })

  it('서버 렌더(첫 페인트)에서는 온라인으로 그린다 — 모든 화면에 띠가 번쩍이지 않는다', () => {
    expect(renderToStaticMarkup(createElement(OfflineBanner))).not.toContain(
      messages.common.offlineBanner,
    )
  })

  it('AppShell 이 헤더 바로 다음에 그린다', () => {
    const shell = readSourceWithoutComments('src/features/nav/app-shell.tsx')
    const header = shell.indexOf('<GlobalHeader')
    const banner = shell.indexOf('<OfflineBanner />')
    const main = shell.indexOf('id="main"')

    expect(header).toBeGreaterThan(-1)
    expect(banner).toBeGreaterThan(header)
    expect(banner).toBeLessThan(main)
  })
})
