import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import type { FacilityLayerStatus } from '@/features/place/facility-layer-status'
import {
  facilityStatusText,
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
  it('끔 — aria-pressed=false 이고 반전 면이 아니다', () => {
    const tag = buttonTag(toggle(false, { kind: 'off' }))

    expect(tag).toContain('aria-pressed="false"')
    expect(tag).toContain('type="button"')
    expect(classTokens(tag)).toEqual(expect.arrayContaining(['bg-bg', 'border-border', 'text-fg']))
    expect(classTokens(tag)).not.toContain('bg-fg')
  })

  it('켬 — aria-pressed=true 이고 명도로 반전한다', () => {
    const tag = buttonTag(toggle(true, { kind: 'shown', count: 3, truncated: false }))

    expect(tag).toContain('aria-pressed="true"')
    expect(classTokens(tag)).toEqual(
      expect.arrayContaining(['bg-fg', 'text-fg-inverse', 'border-fg']),
    )
    expect(classTokens(tag)).not.toContain('bg-bg')
  })

  it('불러오는 동안만 aria-busy 다', () => {
    expect(buttonTag(toggle(true, { kind: 'loading' }))).toContain('aria-busy="true"')
    expect(buttonTag(toggle(true, { kind: 'shown', count: 3, truncated: false }))).toContain(
      'aria-busy="false"',
    )
  })

  /* 상태는 aria-pressed 가 말한다 — 이름이 바뀌면 "지금 무엇" 과 "누르면 무엇" 이 섞인다 */
  it('접근 이름은 켬 · 끔에 따라 바뀌지 않는다', () => {
    for (const markup of [toggle(false, { kind: 'off' }), toggle(true, { kind: 'loading' })]) {
      expect(buttonTag(markup)).toContain(`title="${messages.map.facilityToggle}"`)
      expect(markup).toContain(`<span class="max-md:sr-only">${messages.map.facilityToggle}</span>`)
      expect(buttonTag(markup)).not.toContain('aria-label')
    }
  })

  it('모바일은 44 정사각 아이콘이다 — 높이 44 · 폭 44', () => {
    const tokens = classTokens(buttonTag(toggle(false, { kind: 'off' })))

    expect(tokens).toEqual(expect.arrayContaining(['h-11', 'max-md:w-11', 'max-md:px-0']))
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
