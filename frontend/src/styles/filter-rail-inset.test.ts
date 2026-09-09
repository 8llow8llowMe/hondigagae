import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

/**
 * 필터 레일의 왼쪽 기준선 회귀 검사 — 이슈 #389.
 *
 * **왼쪽 인셋 40 은 페이지 전체가 하나로 쓴다** (`DESIGN.md` §7-1 · #386). 맥락 레일(400)은
 * #386 에서 맞췄고 필터 레일(280)이 이 검사의 대상이다.
 *
 * 여기서 지키는 것은 두 가지다.
 *  (1) `목록 여백 + 행 여백 = 40` 이라는 **산술** — 둘 중 하나만 고치면 컨트롤이 기준선에서
 *      벗어나는데, 값이 두 규칙에 나뉘어 있어 눈으로는 알아채기 어렵다.
 *  (2) 컴포넌트가 그 규칙이 잡는 **클래스 이름을 계속 달고 있는지** — 이름이 바뀌면
 *      CSS 가 조용히 안 걸리고 레일만 옛 자리로 돌아간다.
 */

const globals = readGlobalsCss()

function repoSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

/**
 * `.filter-rail ...{ ... }` 규칙 하나를 통째로 집는다.
 *
 * **선택자 뒤를 `[\\s,{]` 로 닫는다** — 닫지 않으면 `.filter-list` 가
 * `.filter-list-heading` 규칙에도 걸려 엉뚱한 규칙의 값을 읽는다.
 */
function railRule(selector: string): string | undefined {
  const pattern = new RegExp(
    `(^|\\n)[^\\n{}]*\\.filter-rail ${selector}(?=[\\s,{])[^{]*\\{[^}]*\\}`,
  )

  return pattern.exec(globals)?.[0]
}

function pxIn(rule: string | undefined, property: string): number | null {
  const match = new RegExp(`${property}:\\s*(\\d+)px`).exec(rule ?? '')

  return match?.[1] === undefined ? null : Number(match[1])
}

describe('필터 레일 인셋 — 산술 (#389)', () => {
  const list = railRule('\\.filter-list')
  const option = railRule('\\.filter-option')

  it('목록과 행의 여백이 규칙으로 선언돼 있다', () => {
    expect(list).toBeDefined()
    expect(option).toBeDefined()
  })

  /*
    **이 합이 곧 컨트롤이 서는 자리다.** 24 + 16 = 40 — 헤더 로고 · 맥락 레일 · 본문과
    같은 세로선이다. 한쪽만 고치면 합이 깨진다.
  */
  it('목록 여백 + 행 여백 = 40 이다', () => {
    const listPadding = pxIn(list, 'padding-inline')
    const optionPadding = pxIn(option, 'padding-inline')

    expect(listPadding).not.toBeNull()
    expect(optionPadding).not.toBeNull()
    expect((listPadding as number) + (optionPadding as number)).toBe(40)
  })

  /*
    24 · 16 은 `DESIGN.md` §4 스케일 안이다. 행 여백을 12 로 둔 채 목록만 28 로 올리면
    합은 같지만 **28 이 스케일 밖**이다 (4·6·8·12·16·20·24·32·40·48·64).
  */
  it('두 값이 §4 스페이싱 스케일 안이다', () => {
    const scale = [4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64]

    expect(scale).toContain(pxIn(list, 'padding-inline'))
    expect(scale).toContain(pxIn(option, 'padding-inline'))
  })

  it('제목과 축 제목은 왼쪽 40 에 선다', () => {
    const heading = railRule('\\.filter-list-heading')

    expect(pxIn(heading, 'padding-inline-start')).toBe(40)
  })
})

describe('필터 레일 인셋 — 걸리는 자리 (#389)', () => {
  const filterList = repoSource('src/components/filter-list.tsx')

  it.each(['filter-list', 'filter-list-heading', 'filter-option'])(
    '%s 클래스를 컴포넌트가 달고 있다',
    (className) => {
      expect(filterList).toContain(className)
    },
  )

  it.each([
    ['src/features/place/place-filter-rail.tsx', '장소 찾기'],
    ['src/features/plan/plan-filter-controls.tsx', '여행 일정'],
  ])('%s 가 filter-rail 로 규칙에 가입한다', (path) => {
    const source = repoSource(path)

    expect(source).toContain('filter-rail')
    expect(source).toContain('filter-rail-title')
  })

  /*
    **모바일 시트는 가입하지 않는다.** 고정 폭 컨테이너라 40 이 틀린 값이다
    (`INSET_CLASS.panel` 이 끝까지 평평한 것과 같은 이유). 규칙이 `.filter-rail` 자손으로
    한정돼 있어야 시트가 손대지 않고 그대로 남는다.
  */
  it('규칙이 전부 .filter-rail 자손으로 한정돼 있다', () => {
    for (const className of ['filter-list', 'filter-list-heading', 'filter-option']) {
      const unscoped = new RegExp(`(^|\\n)\\.${className}\\s*[,{]`).exec(globals)

      expect(unscoped).toBeNull()
    }
  })
})
