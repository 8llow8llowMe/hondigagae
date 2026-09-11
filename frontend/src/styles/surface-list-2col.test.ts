import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

/**
 * 2열 목록 규칙 회귀 검사 — 이슈 #462.
 *
 * `surface.test.ts` 는 컴포넌트가 **클래스를 달고 있는지**만 본다. 규칙 본문은
 * `app/globals.css` 에 있어 그쪽이 조용히 지워지거나 선택자가 어긋나도 컴포넌트
 * 테스트는 초록이다 — 그러면 **홀수 마지막 행 옆 허공에 열선이 다시 뜨고** 첫 시각적
 * 행의 오른쪽 칸에 위선이 생긴다. 그 두 규칙을 여기서 고정한다.
 *
 * `filter-rail-inset.test.ts`(#389)가 같은 이유로 세운 검사와 같은 형태다.
 *
 * 선택자를 Tailwind arbitrary variant 로 쓸 수 없어서 CSS 로 나간 것이기도 하다 —
 * 괄호가 든 arbitrary 는 eslint `noComplexArbitrary` 가 막는다.
 */

const globals = readGlobalsCss()

/** `.surface-list-2col` 규칙이 든 미디어 블록을 통째로 집는다 */
const block =
  /@media \(width >= 80rem\) \{(?:[^{}]|\{[^{}]*\})*\.surface-list-2col(?:[^{}]|\{[^{}]*\})*\}/.exec(
    globals,
  )?.[0]

describe('2열 목록 `.surface-list-2col` (#462)', () => {
  it('xl(80rem = 1280) 부터만 켜진다', () => {
    /*
      접는 지점은 아트보드의 1200 이 아니라 **토큰에 있는 축**이다 — 이 화면 하나
      때문에 breakpoint 를 늘리면 다음 사람이 어느 축을 써야 하는지 모른다
      (`features/favorite/저장한장소-세부명세.md` D1).
    */
    expect(block).toBeDefined()
  })

  it('2열 그리드의 트랙 바닥이 0 이다 — 긴 장소명이 칸을 밀어내지 못한다', () => {
    expect(block).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
  })

  it('첫 시각적 행의 오른쪽 칸은 위선을 갖지 않는다', () => {
    // `[&>li+li]:border-t` 가 2번째 항목에도 걸린다 — 2열에서는 그게 첫 행의 오른쪽 칸이다
    expect(block).toMatch(
      /\.surface-list-2col > li:nth-child\(2\)\s*\{\s*border-block-start-width:\s*0;/,
    )
  })

  it('열선은 오른쪽에 짝이 있을 때만 긋는다', () => {
    /*
      `:not(:last-child)` 가 없으면 홀수 개의 마지막 행에서 **아무것도 없는 공간 옆에
      선만 뜬다** (1건일 때 특히 눈에 띈다).
    */
    expect(block).toMatch(
      /\.surface-list-2col > li:nth-child\(odd\):not\(:last-child\)\s*\{\s*border-inline-end:\s*1px solid var\(--border\);/,
    )
  })

  it('선 색을 리터럴로 적지 않는다 — 토큰을 쓴다 (DESIGN.md §2)', () => {
    expect(block).toContain('var(--border)')
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})
