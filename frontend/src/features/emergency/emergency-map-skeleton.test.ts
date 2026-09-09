import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyMapSkeleton } from '@/features/emergency/emergency-map-skeleton'

describe('EmergencyMapSkeleton', () => {
  it('칩·캡션 자리를 다시 그리지 않는다 — 지도 갈래는 실제 필터바·캡션이 이미 패널 머리에 있다', () => {
    const markup = renderToStaticMarkup(createElement(EmergencyMapSkeleton))

    // EmergencySkeleton(목록 갈래) 의 칩 폭 클래스들 — 지도 패널 스켈레톤에는 없어야 한다
    expect(markup).not.toContain('w-20')
    expect(markup).not.toContain('w-24')
    expect(markup).not.toContain('w-28')
  })

  it('패널 자신의 16px 한 축이다 — md:/lg: 로 뷰포트 기준 여백을 주지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(EmergencyMapSkeleton))

    expect(markup).toContain('px-4')
    expect(markup).not.toContain('md:px-')
    expect(markup).not.toContain('lg:px-')
  })

  it('행 자리(스켈레톤 블록)를 그린다', () => {
    const markup = renderToStaticMarkup(createElement(EmergencyMapSkeleton))

    expect(markup).toContain('animate-pulse')
  })
})
