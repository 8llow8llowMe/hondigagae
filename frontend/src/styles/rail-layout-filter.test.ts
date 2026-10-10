import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

/**
 * 목록 2단의 높이 규칙 회귀 검사 — 이슈 #598 (#553 · #556 을 잇는다).
 *
 * **이 규칙은 브라우저에서만 증상이 보이고, 깨져도 조용하다.** 네 화면
 * (`/places?view=list` · `/plans` · `/emergency?view=list` · 일정 담기)이 한 규칙을
 * 공유하는데, 값 하나만 되돌아가도 화면은 그럴듯하게 그려지면서 다음 셋 중 하나가
 * 소리 없이 사라진다.
 *
 *  ① **레일이 다시 자기 스크롤을 든다** — 카드 안 좁은 홈에서 굴러야 한다
 *     (1280×900 `/places` 레일 1088 / 가용 786).
 *  ② **목록 카드 머리가 페이지와 함께 밀린다** — 302px 밀리면 제목도 검색도 사라진다
 *     (#556 이 고친 자리).
 *  ③ **무한 스크롤이 20행에서 멈춘다** — 목록 열 바닥이 접힘 아래로 내려가면
 *     `InfiniteScrollSentinel`(root = 뷰포트)이 화면에 못 들어온다. 휠로 굴리면
 *     연쇄로 결국 발동해서 **개발 중에는 멀쩡해 보인다** — 스크롤바를 끌거나
 *     PageDown 하는 사람에게만 멈춘다.
 *
 * ③ 이 이 파일이 있는 이유다. e2e 는 휠 대신 실제 제스처를 쓰지 않으면 재현되지 않고,
 * 소스 단언은 **값이 왜 그 값인지**를 근거와 함께 붙들어 둘 수 있다.
 */

const globals = readGlobalsCss()

function repoSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

/**
 * `<selector> { ... }` 규칙 하나를 집어 **주석을 걷고** 선언만 돌려준다.
 *
 * 이 저장소의 CSS 는 규칙 안에 결정 근거를 길게 적는다 — 주석을 남기면
 * `not.toContain('overflow')` 같은 단언이 *"overflow 를 걷었다"* 라고 적힌 주석에
 * 걸려 **고쳐도 실패한다.**
 */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const found = new RegExp(`(^|\\n)[^\\n{}]*${escaped}(?=[\\s,{])[^{]*\\{[^}]*\\}`).exec(globals)

  expect(found, `${selector} 규칙을 찾지 못했다`).not.toBeNull()

  return (found?.[0] ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('.rail-layout-filter — 높이는 레일이 정한다 (#598)', () => {
  const grid = rule('.rail-layout-filter')

  /*
    #553 의 `block-size` + `max-block-size` 두 줄이다. 되돌아오면 레일이 뷰포트보다 길 때
    다시 카드 안에서 굴러야 한다 — `.rail-layout` 의 `min-block-size` 가 아래쪽을 받치므로
    레일이 짧을 때의 모양은 그대로다.
  */
  it('묶음 높이를 뷰포트로 못박지 않는다', () => {
    expect(grid).not.toMatch(/[^-]block-size:/)
    expect(grid).not.toContain('max-block-size:')
  })

  it('두 열이 한 행을 나눠 쓴다', () => {
    expect(grid).toContain('grid-template-rows: minmax(0, 1fr)')
  })
})

describe('.rail-column — 아무도 스크롤하지 않는다 (#598)', () => {
  const column = rule('.rail-layout-filter > .rail-column')

  it('열이 클리핑도 스크롤도 하지 않는다', () => {
    expect(column).not.toContain('overflow')
  })

  /* 위아래 24 는 우측 열 `SurfaceStack` 의 `md:p-6` 과 같은 값이다 */
  it('위아래 여백 24 를 유지한다 — 우측 첫 카드와 같은 자리에 선다', () => {
    expect(column).toContain('padding-block: 24px')
  })

  /*
    #553 이 레일 카드에 얹었던 `max-block-size: 100%` + `overflow-y: auto` 다.
    이것이 살아 있으면 ① 이 그대로 돌아온다.
  */
  it('레일 카드에 스크롤을 주는 규칙이 없다', () => {
    expect(globals).not.toMatch(/\.rail-column > \.filter-rail[^{]*\{[^}]*overflow/)
  })
})

describe('.list-column — 행 높이를 정하지 않고 접힘 안에 남는다 (#598)', () => {
  const list = rule('.rail-layout-filter > .list-column')

  /*
    **`block-size` 가 확정값이어야 한다.** grid 는 그때만 내용(목록 전체)을 보지 않는다 —
    `auto` 로 돌아가면 행이 목록을 따라 자라 #553 ①(무한 스크롤이 페이지 스크롤을 먹는 것)이
    되돌아온다.
  */
  it('높이가 확정값이다 — 목록 길이를 따라가지 않는다', () => {
    expect(list).toContain('block-size: calc(100dvh - var(--header-h))')
  })

  /*
    **sticky 셋은 함께 있어야 뜻이 된다.** `align-self: start` 가 빠지면 기본 `stretch` 가
    열을 행 전체로 늘려 sticky 가 움직일 여지를 잃고, `top` 이 빠지면 헤더 뒤로 들어간다.
  */
  it('접힘 안에 남는다 — sticky · top · align-self 가 함께 있다', () => {
    expect(list).toContain('position: sticky')
    expect(list).toContain('top: var(--header-h)')
    expect(list).toContain('align-self: start')
  })

  it('카드가 열 밖으로 비어져 나오지 않게 클립한다', () => {
    expect(list).toContain('overflow: hidden')
  })
})

/*
  **규칙이 잡는 클래스 이름을 네 화면이 계속 달고 있는지 본다.** 이름이 바뀌면 CSS 가
  조용히 안 걸리고 위 단언은 그대로 통과한다 — `filter-rail-inset.test.ts` 와 같은 처방이다.
*/
describe('네 화면이 같은 규칙에 가입해 있다', () => {
  /*
    **두 클래스가 같은 파일에 있지 않다.** 담기 화면은 레일을 페이지가 달고 목록 열은
    뷰 컴포넌트가 단다 — 한 경로만 보면 그 화면의 절반을 놓친다.
  */
  const screens = [
    ['장소 찾기', 'app/(main)/places/(list)/page.tsx', 'app/(main)/places/(list)/page.tsx'],
    ['일정 목록', 'src/features/plan/plan-list-view.tsx', 'src/features/plan/plan-list-view.tsx'],
    [
      '병원 · 약국',
      'src/features/emergency/emergency-list-view.tsx',
      'src/features/emergency/emergency-list-view.tsx',
    ],
    [
      '일정 담기',
      'app/(main)/plans/[planId]/days/[day]/add/page.tsx',
      'src/features/plan/plan-add-place-view.tsx',
    ],
  ] as const

  for (const [name, railPath, listPath] of screens) {
    it(`${name} 이 rail-column 과 list-column 을 단다`, () => {
      expect(repoSource(railPath)).toContain('rail-column')
      expect(repoSource(listPath)).toContain('list-column')
    })
  }
})
