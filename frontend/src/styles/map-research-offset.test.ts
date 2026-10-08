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

/*
  **#1278 — 알약이 폭마다 다른 자리에 선다.** 데스크톱은 지도 하단 중앙(`.map-research-offset`), `lg` 미만은
  상단 컨트롤 묶음 맨 아래(흐름 안)다. 하단에 두면 시트 중간 · 최대 단계에 가려졌고, 고정 좌표(검색 줄 아래
  72)로 두면 `/emergency` 의 위치 안내와 겹쳤다(실측). 그래서 시트 비율과 묶이던 예전 계약(#396)은 없다.
*/
const SCREENS = [
  'src/features/place/place-map-view.tsx',
  'src/features/emergency/emergency-map-view.tsx',
]

describe('재검색 알약 자리 (#1278)', () => {
  it('하단 자리 클래스는 데스크톱 바닥(32px)만 갖는다 — 시트 비율 · 탭바와 묶이지 않는다', () => {
    const rule = /\.map-research-offset\s*\{[^}]*\}/.exec(globals)?.[0]

    expect(rule).toBeDefined()
    expect(rule).toContain('bottom: 32px')
    expect(rule).not.toContain('dvh')
    expect(rule).not.toContain('var(--tabbar-h)')
  })

  it('두 지도 화면 모두 하단 알약은 lg 부터, 상단 알약은 lg 미만에서만 선다', () => {
    for (const file of SCREENS) {
      const source = repoSource(file)

      expect(source).toMatch(
        /'map-research-offset absolute inset-x-0 z-30 hidden justify-center px-4 lg:flex'/,
      )
      expect(source).toMatch(
        /<div className="flex justify-center px-4 pt-2 lg:hidden">\s*<ResearchHereButton/,
      )
    }
  })

  it('두 화면이 같은 버튼 컴포넌트를 쓴다 — 같은 문구 · 같은 모양 (#396)', () => {
    for (const file of SCREENS) {
      expect(repoSource(file).match(/<ResearchHereButton /g)).toHaveLength(2)
    }
  })
})
