import { describe, expect, it } from 'vitest'

import { MAP_PIN_ICONS, pinIconSvg } from '@/lib/map/pin-icons'

describe('pinIconSvg — 지도 핀 아이콘 (#1280)', () => {
  it('12종 모두 24 격자 · currentColor · 선 1.5 의 장식 svg 다', () => {
    expect(MAP_PIN_ICONS).toHaveLength(12)
    for (const icon of MAP_PIN_ICONS) {
      const svg = pinIconSvg(icon)

      expect(svg.startsWith('<svg ')).toBe(true)
      expect(svg).toContain('viewBox="0 0 24 24"')
      expect(svg).toContain('stroke="currentColor"')
      expect(svg).toContain('stroke-width="1.5"')
      expect(svg).toContain('aria-hidden="true"')
      expect(svg).toContain('focusable="false"')
    }
  })

  /* 크기는 상태(기본 14 · 선택 18)마다 CSS 가 준다 — 문자열에 박으면 두 벌이 필요하다 */
  it('width · height 를 박지 않는다', () => {
    for (const icon of MAP_PIN_ICONS) {
      expect(pinIconSvg(icon)).not.toMatch(/\s(width|height)=/)
    }
  })

  it('모양마다 그림이 다르다 — 같은 path 를 두 키가 쓰지 않는다', () => {
    const bodies = MAP_PIN_ICONS.map((icon) => pinIconSvg(icon))
    expect(new Set(bodies).size).toBe(MAP_PIN_ICONS.length)
  })

  /* 병원 · 약국 (#1286 D2-2) — 선 1.5 십자는 14px 에서 0.9px 이라 사라진다 */
  it('cross 는 채운 도형이다 — 선을 끄고 currentColor 로 칠한다', () => {
    const svg = pinIconSvg('cross')

    expect(svg).toContain('fill="currentColor" stroke="none"')
  })

  it('pill 은 선 그림이다 — 채움을 켜지 않는다', () => {
    expect(pinIconSvg('pill')).not.toContain('fill="currentColor"')
  })
})
