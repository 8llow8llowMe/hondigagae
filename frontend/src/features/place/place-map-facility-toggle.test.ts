import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import type { FacilityLayerStatus } from '@/features/place/facility-layer-status'
import {
  facilityStatusText,
  hasFacilityNotice,
  PlaceMapFacilityNotice,
  PlaceMapFacilityToggle,
} from '@/features/place/place-map-facility-toggle'
import { messages } from '@/lib/messages'

/**
 * 병원 · 약국 토글 · 안내 카드 (#1286 D4-1 · D5 · D6).
 *
 * **클래스는 여는 태그로 범위를 좁혀 본다** — 마크업 전체에서 찾으면 `text-fg` 가 `text-fg-inverse` 에,
 * 다른 요소의 클래스가 버튼의 것으로 잡혀 false-green 이 된다.
 */
const noop = () => undefined

function toggle(on: boolean, status: FacilityLayerStatus) {
  return renderToStaticMarkup(createElement(PlaceMapFacilityToggle, { on, status, onToggle: noop }))
}

/** 첫 `<button …>` 여는 태그 */
function buttonTag(markup: string): string {
  return /<button[^>]*>/.exec(markup)?.[0] ?? ''
}

function classTokens(tag: string): string[] {
  return (/class="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/).filter((name) => name !== '')
}

function notice(status: FacilityLayerStatus) {
  return renderToStaticMarkup(createElement(PlaceMapFacilityNotice, { status, onRetry: noop }))
}

describe('PlaceMapFacilityToggle', () => {
  it('끔 — aria-pressed=false 이고 반전 면이 아니다 · 낮춘 톤이다', () => {
    const tag = buttonTag(toggle(false, { kind: 'off' }))

    expect(tag).toContain('aria-pressed="false"')
    expect(tag).toContain('type="button"')
    expect(classTokens(tag)).toContain('text-fg-muted')
    expect(classTokens(tag)).not.toContain('bg-fg')
  })

  it('켬 — aria-pressed=true 이고 명도로 반전한다', () => {
    const tag = buttonTag(toggle(true, { kind: 'shown', count: 3, truncated: false }))

    expect(tag).toContain('aria-pressed="true"')
    expect(classTokens(tag)).toEqual(expect.arrayContaining(['bg-fg', 'text-fg-inverse']))
    expect(classTokens(tag)).not.toContain('text-fg-muted')
  })

  it('불러오는 동안만 aria-busy 다', () => {
    expect(buttonTag(toggle(true, { kind: 'loading' }))).toContain('aria-busy="true"')
    expect(buttonTag(toggle(true, { kind: 'shown', count: 3, truncated: false }))).toContain(
      'aria-busy="false"',
    )
  })

  /*
    상태는 aria-pressed 가 말한다 — 이름이 바뀌면 "지금 무엇" 과 "누르면 무엇" 이 섞인다.
    #1300 — 캡션이 모든 폭에서 보이고 그대로 접근 이름이 된다(예전 `max-md:sr-only` 를 걷었다).
  */
  it('접근 이름은 보이는 캡션이고 켬 · 끔에 따라 바뀌지 않는다', () => {
    for (const markup of [toggle(false, { kind: 'off' }), toggle(true, { kind: 'loading' })]) {
      expect(buttonTag(markup)).toContain(`title="${messages.map.facilityToggle}"`)
      expect(markup).toContain(
        `<span class="map-tool-caption whitespace-nowrap">${messages.map.facilityToggle}</span>`,
      )
      // 버튼 안에 숨은 글자가 없다 — 숨은 상태 알림(버튼 밖 형제)은 따로다
      expect(markup.slice(0, markup.indexOf('</button>'))).not.toContain('sr-only')
      expect(buttonTag(markup)).not.toContain('aria-label')
    }
  })

  /* #1300 D1-2 — 지도 도구 카드의 한 칸. 테두리 · 그림자 · 곡률은 카드가 갖는다 */
  it('카드 칸이다 — 46 × 48 세로 쌓기 · 안쪽 포커스 링 · 자기 테두리 · 그림자 · 곡률이 없다', () => {
    const tokens = classTokens(buttonTag(toggle(false, { kind: 'off' })))

    expect(tokens).toEqual(
      expect.arrayContaining(['h-12', 'w-full', 'flex-col', 'focus-visible:ring-inset']),
    )
    for (const name of ['border', 'shadow-md', 'rounded-lg', 'max-md:w-11', 'h-11'])
      expect(tokens).not.toContain(name)
  })

  it('숨은 상태 알림이 늘 있다 — 끔에서도 자리는 남고 글자만 빈다', () => {
    const off = toggle(false, { kind: 'off' })

    expect(off).toContain('<span role="status" aria-live="polite" class="sr-only"></span>')
    expect(toggle(true, { kind: 'loading' })).toContain(messages.map.facilityLoading)
    expect(toggle(true, { kind: 'shown', count: 213, truncated: false })).toContain(
      '병원·약국 213곳을 지도에 표시했어요',
    )
  })
})

describe('facilityStatusText', () => {
  it('실패는 안내 카드가 말하므로 숨은 알림은 비운다', () => {
    expect(facilityStatusText({ kind: 'failed', retry: true, message: 'x' })).toBe('')
    expect(facilityStatusText({ kind: 'off' })).toBe('')
  })
})

describe('PlaceMapFacilityNotice', () => {
  it('꺼짐 · 불러오는 중 · 잘리지 않은 받음에는 카드가 없다', () => {
    expect(notice({ kind: 'off' })).toBe('')
    expect(notice({ kind: 'loading' })).toBe('')
    expect(notice({ kind: 'shown', count: 213, truncated: false })).toBe('')
  })

  it('잘렸으면 받은 만큼 그렸다고 말한다 — 닫기 · 재시도 없음', () => {
    const markup = notice({ kind: 'shown', count: 250, truncated: true })

    expect(markup).toContain('병원·약국이 많아 250곳만 지도에 표시했어요')
    expect(markup).not.toContain('<button')
  })

  it('5xx · 무응답 — 실패 문구 + 다시 시도', () => {
    const markup = notice({ kind: 'failed', retry: true, message: messages.map.facilityLoadFailed })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.map.facilityLoadFailed)
    expect(markup).toContain(`>${messages.common.retry}</button>`)
  })

  it('4xx — 서버 문구를 그대로 · 재시도 버튼 없음', () => {
    const markup = notice({ kind: 'failed', retry: false, message: '반경은 50000 이하여야 해요' })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('반경은 50000 이하여야 해요')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain(messages.common.retry)
  })

  it('카드는 지도 위에서 다시 누를 수 있다 — 묶음이 pointer-events-none 이다', () => {
    const tag = /<p[^>]*>/.exec(notice({ kind: 'shown', count: 1, truncated: true }))?.[0] ?? ''

    expect(classTokens(tag)).toEqual(
      expect.arrayContaining(['pointer-events-auto', 'max-w-xs', 'shadow-md', 'rounded-lg']),
    )
  })
})

/*
  **카드가 없으면 줄도 없다** (리뷰 7). 래퍼(`pt-2`)가 늘 서면 카드가 없을 때도 모바일 재검색 알약이 8px 내려간다 —
  호출부는 이 판정으로 래퍼째 그리지 않는다. 판정과 렌더가 갈리지 않게 카드가 그려지는 상태와 맞춘다.
*/
describe('hasFacilityNotice', () => {
  const statuses: FacilityLayerStatus[] = [
    { kind: 'off' },
    { kind: 'loading' },
    { kind: 'shown', count: 213, truncated: false },
    { kind: 'shown', count: 250, truncated: true },
    { kind: 'failed', retry: true, message: messages.map.facilityLoadFailed },
    { kind: 'failed', retry: false, message: '반경은 50000 이하여야 해요' },
  ]

  it('잘림 · 실패에만 참이다', () => {
    expect(statuses.map(hasFacilityNotice)).toEqual([false, false, false, true, true, true])
  })

  it('참일 때만 카드가 그려진다 — 판정과 렌더가 같은 말을 한다', () => {
    for (const status of statuses) expect(notice(status) !== '').toBe(hasFacilityNotice(status))
  })
})
