import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

/**
 * 재검색 알약의 세로 자리가 하단 시트와 어긋나지 않는지 — 이슈 #396.
 *
 * 알약은 모바일에서 **시트 최소 단계 위**에 앉는데, 시트 높이는 `map-sheet.tsx` 의
 * `STOP_RATIO.min` 이 정하고 알약 자리는 `globals.css` 가 정한다. **두 값이 다른 파일에
 * 따로 적혀 있어** 한쪽만 고치면 알약이 시트에 반쯤 잠긴다 — 화면에서는 "버튼이 잘렸다"
 * 로만 보이고 원인이 어디인지 알 수 없다.
 */

const globals = readGlobalsCss()

function repoSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

describe('재검색 알약 세로 자리 (#396)', () => {
  it('알약의 dvh 값이 시트 최소 단계 비율과 같다', () => {
    const sheet = repoSource('src/components/map-sheet.tsx')
    const minRatio = /min:\s*(0?\.\d+)/.exec(sheet)?.[1]

    expect(minRatio).toBeDefined()

    // 0.2 → 20dvh
    const expectedDvh = Math.round(Number(minRatio) * 100)
    const rule = /\.map-research-offset\s*\{[^}]*\}/.exec(globals)?.[0]

    expect(rule).toBeDefined()
    expect(rule).toContain(`${expectedDvh}dvh`)
  })

  it('모바일에서는 탭바 높이도 함께 뺀다 — 최소 단계 시트가 탭바 위에 앉는다', () => {
    const rule = /\.map-research-offset\s*\{[^}]*\}/.exec(globals)?.[0]

    expect(rule).toContain('var(--tabbar-h)')
  })

  /*
    `lg` 는 시트가 없고(`lg:hidden`) 좌측 패널이 `bottom-8` 로 카카오 축척·로고 막대를
    피한다. 알약이 그보다 아래로 내려가면 축척 위에 겹친다.
  */
  it('lg 에서는 좌측 패널과 같은 바닥(32px)에 선다', () => {
    const lgRule = /@media \(width >= 64rem\) \{\s*\.map-research-offset\s*\{[^}]*\}/.exec(
      globals,
    )?.[0]

    expect(lgRule).toBeDefined()
    expect(lgRule).toContain('bottom: 32px')
  })
})
