import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MapSheet, nextStop } from '@/components/map-sheet'

function render(label: string) {
  return renderToStaticMarkup(
    createElement(MapSheet, {
      label,
      stop: 'mid' as const,
      onStopChange: () => undefined,
      header: createElement('p', null, '지도에 보이는 2곳'),
      children: createElement('ul', null),
    }),
  )
}

describe('MapSheet', () => {
  it('시트 이름을 호출부가 정한다 — 병원 목록이 "장소 목록" 으로 읽히면 안 된다', () => {
    expect(render('병원 · 약국 목록')).toContain('aria-label="병원 · 약국 목록"')
  })

  it('다른 화면은 다른 이름을 준다', () => {
    expect(render('장소 목록')).toContain('aria-label="장소 목록"')
  })

  it('한 번에 한 단계씩만 움직인다 — 최소에서 크게 끌어도 최대로 뛰지 않는다', () => {
    expect(nextStop('min', -500)).toBe('mid')
  })
})

describe('nextStop', () => {
  it('살짝 끈 것은 단계를 바꾸지 않는다 — 스크롤하려다 단계가 바뀌면 목록을 못 읽는다', () => {
    expect(nextStop('mid', -10)).toBe('mid')
    expect(nextStop('mid', 10)).toBe('mid')
  })

  it('위로 끌면(음수) 한 단계 올라간다', () => {
    expect(nextStop('min', -60)).toBe('mid')
    expect(nextStop('mid', -60)).toBe('max')
  })

  it('아래로 끌면 한 단계 내려간다', () => {
    expect(nextStop('max', 60)).toBe('mid')
    expect(nextStop('mid', 60)).toBe('min')
  })

  it('크게 끌어도 한 단계씩만 움직인다 — 지도를 잃지 않게 한다', () => {
    expect(nextStop('min', -2000)).toBe('mid')
    expect(nextStop('max', 2000)).toBe('mid')
  })

  it('양 끝에서 더 끌어도 넘어가지 않는다', () => {
    expect(nextStop('max', -2000)).toBe('max')
    expect(nextStop('min', 2000)).toBe('min')
  })
})
