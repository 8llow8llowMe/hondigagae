import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'
import { readGlobalsCss } from '@/test/tokens'

/**
 * 코스 목록 표 트랙 회귀 검사 — 이슈 [#797](https://github.com/8llow8llowMe/hondigagae/issues/797).
 *
 * **이 이슈가 실제로 고친 것은 클래스 이름이 아니라 숫자다** — 코스 열 256 · 썸네일 트랙
 * 40 · 행 높이 72. 그런데 마크업 테스트는 클래스 문자열만 보므로, 누가 트랙 값을 되돌려도
 * 전부 초록불이 된다. `content-max.test.ts` · `reading-max.test.ts` 와 같은 축으로 여기서
 * 값을 못박는다.
 */

const globals = readGlobalsCss()
const row = readSourceWithoutComments('src/features/walk-course/walk-course-row.tsx')

const TRACKS = globals.match(/^\.walk-course-row-grid\s*\{[^}]*\}/m)?.[0]

describe('코스 목록 표 — 트랙 (#797)', () => {
  /**
   * **썸네일 트랙이 맨 앞이다** ([#767](https://github.com/8llow8llowMe/hondigagae/issues/767)).
   * 순서까지 한 문자열로 못박는다 — 폭 집합만 세면 자리가 바뀌어도 초록이다.
   */
  it('여섯 칸을 한 줄로 선언한다 — 폭마다 칸 수가 갈리지 않는다', () => {
    expect(TRACKS).toBeDefined()
    expect(TRACKS).toContain('2.5rem 16rem 5rem 6rem minmax(0, 1fr) 1.25rem')
  })

  /**
   * 예전에는 코스와 시종점에 `1fr` 을 똑같이 줘 두 칸이 484px 씩 됐고, 코스 이름 끝과
   * 거리 값이 417px 떨어졌다. **코스 열이 다시 `1fr` 이 되면 그 증상이 돌아온다.**
   */
  it('코스 열이 다시 1fr 이 되지 않는다', () => {
    expect(TRACKS).not.toMatch(/columns:\s*minmax\(0, 1fr\)/)
  })

  it('@media 로 칸 수를 가르지 않는다 — 트랙 선언이 하나다', () => {
    expect(globals.match(/\.walk-course-row-grid\s*\{/g)?.length).toBe(1)
  })
})

/*
  **트랙 폭과 실제 박스 크기는 같이 움직여야 한다.** 썸네일 트랙(2.5rem = 40px)과 행 안
  박스(`lg:size-10` = 40px)가 갈리면 칸이 남거나 넘친다 — 한쪽만 고치기 쉬운 자리다.
*/
describe('코스 목록 표 — 트랙과 박스가 같은 값이다 (#797)', () => {
  it('썸네일 트랙 2.5rem 과 lg:size-10 이 짝이다', () => {
    expect(TRACKS).toContain('2.5rem')
    expect(row).toContain('lg:size-10')
  })

  /** 썸네일 박스가 첫 칸에 선다 — 트랙 순서와 `col-start` 가 갈리면 사진이 코스 위에 겹친다 */
  it('썸네일 박스가 lg:col-start-1 이다', () => {
    expect(row).toMatch(/bg-band relative size-16[^"]*lg:col-start-1/)
  })

  /** 72 = 썸네일 40 + `lg:py-4` 16×2. 셋 중 하나를 바꾸면 나머지도 같이 본다 */
  it('행 최소 높이와 세로 여백이 썸네일 크기에서 나온다', () => {
    expect(row).toContain('lg:min-h-18')
    expect(row).toContain('lg:py-4')
  })

  /** 1024 미만 카드형 목록에서는 썸네일이 행의 주인공이라 예전 크기를 지킨다 */
  it('태블릿 이하 썸네일 크기는 그대로다', () => {
    expect(row).toContain('size-16')
    expect(row).toContain('md:size-20')
  })

  /**
   * `next/image` 의 `sizes` 는 srcset 선택 기준이다. 박스를 40px 로 줄이고 여기를 80px 로
   * 두면 1024 이상에서 필요한 것의 2배 소스를 받는다 — 실제로 그 상태였다.
   */
  it('sizes 가 표 안 박스 크기를 따라간다', () => {
    expect(row).toContain('(min-width: 1024px) 40px')
  })
})
