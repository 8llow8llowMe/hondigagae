import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

/**
 * 필터 레일 카드 회귀 검사 — 이슈 #535 (#389 를 대체).
 *
 * **레일은 L1 카드다** (`DESIGN.md` §0 · §7-1). 그래서 지키는 것이 #389 때와 달라졌다.
 * #389 는 모서리가 없는 레일에서 **글자**를 왼쪽 기준선 40 에 세웠고, 지금은 **카드
 * 모서리**가 40 에 서고 글자는 카드 인셋 20 만큼 안쪽에 선다.
 *
 * 여기서 지키는 것은 셋이다.
 *  (1) 카드의 세 채널(면 · 1px 테두리 · radius 12)과 모서리가 서는 자리 40.
 *  (2) `목록 여백 + 행 여백 = 20` 이라는 **산술** — 둘 중 하나만 고치면 알약 라벨이
 *      축 제목과 어긋나는데, 값이 두 규칙에 나뉘어 있어 눈으로는 알아채기 어렵다.
 *  (3) 컴포넌트가 그 규칙이 잡는 **클래스 이름을 계속 달고 있는지** — 이름이 바뀌면
 *      CSS 가 조용히 안 걸리고 레일만 바닥 위로 돌아간다.
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

/** 자손이 아니라 `.filter-rail` 자신에게 걸린 규칙 — 카드의 세 채널이 여기 있다. */
function railSelfRule(): string | undefined {
  return /(^|\n)\.filter-rail\s*\{[^}]*\}/.exec(globals)?.[0]
}

function pxIn(rule: string | undefined, property: string): number | null {
  const match = new RegExp(`${property}:\\s*(\\d+)px`).exec(rule ?? '')

  return match?.[1] === undefined ? null : Number(match[1])
}

describe('필터 레일 카드 (#535)', () => {
  const self = railSelfRule()

  it('레일 자신에게 걸린 규칙이 있다', () => {
    expect(self).toBeDefined()
  })

  /*
    **§0 의 L1 은 면 + 1px 테두리 + radius 12 다.** 셋 중 하나가 빠지면 카드가 아니라
    그냥 흰 덩어리가 된다 — 오른쪽 목록 카드와 무게가 갈린다.
  */
  it('면 · 1px 테두리 · radius 를 토큰으로 갖는다', () => {
    expect(self).toMatch(/background:\s*var\(--bg\)/)
    expect(self).toMatch(/border:\s*1px solid var\(--border\)/)
    expect(self).toMatch(/border-radius:\s*var\(--radius-lg\)/)
  })

  /*
    **그림자를 주지 않는다.** §0 — 섹션은 페이지 위에 눕지 뜨지 않는다. 그림자가 붙으면
    레일만 팝오버처럼 떠 보이고 오른쪽 목록과 층이 갈린다.
  */
  it('그림자를 갖지 않는다', () => {
    expect(self).not.toMatch(/box-shadow/)
  })

  /*
    **카드 모서리가 왼쪽 기준선 40 에 선다.** 헤더 로고 · 맥락 레일 · 본문과 같은 세로선이다
    (1280 실측: 로고 40 · 카드 40). 이 값이 빠지면 카드가 뷰포트 왼쪽 끝에 붙는다.
  */
  it('왼쪽 모서리가 40 에 선다', () => {
    expect(pxIn(self, 'margin-inline-start')).toBe(40)
  })

  /*
    **오른쪽에는 margin 을 주지 않는다.** 카드 오른쪽 끝이 곧 열의 끝이고 열 사이 24 가
    §0 의 카드 간격이다 — 여기에 또 주면 간격이 48 이 되어 두 기둥이 갈라져 보인다.
  */
  it('오른쪽 모서리에는 margin 을 주지 않는다', () => {
    expect(pxIn(self, 'margin-inline-end')).toBeNull()
  })
})

describe('필터 레일 인셋 — 산술 (#535)', () => {
  const list = railRule('\\.filter-list')
  const option = railRule('\\.filter-option')

  it('목록과 행의 여백이 규칙으로 선언돼 있다', () => {
    expect(list).toBeDefined()
    expect(option).toBeDefined()
  })

  /*
    **이 합이 곧 알약 라벨이 서는 자리다.** 8 + 12 = 20 — 축 제목과 같은 세로선이고,
    그 20 이 §0 의 카드 인셋(`INSET_CLASS.card` 데스크톱 값)이다. 한쪽만 고치면 합이
    깨져 라벨만 축 제목에서 밀린다.
  */
  it('목록 여백 + 행 여백 = 20 이다', () => {
    const listPadding = pxIn(list, 'padding-inline')
    const optionPadding = pxIn(option, 'padding-inline')

    expect(listPadding).not.toBeNull()
    expect(optionPadding).not.toBeNull()
    expect((listPadding as number) + (optionPadding as number)).toBe(20)
  })

  /*
    8 · 12 는 `DESIGN.md` §4 스케일 안이다. 20 을 만드는 다른 짝 `4+16` 은 알약 배경이
    카드 테두리에 4px 까지 붙어 두 선이 한 겹으로 읽힌다.
  */
  it('두 값이 §4 스페이싱 스케일 안이다', () => {
    const scale = [4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64]

    expect(scale).toContain(pxIn(list, 'padding-inline'))
    expect(scale).toContain(pxIn(option, 'padding-inline'))
  })

  /*
    **제목과 축 제목은 카드 인셋 20 에 선다** — 양쪽이 같다. #389 때는 왼쪽 40 · 오른쪽 24
    로 갈랐는데, 그건 모서리가 없어 왼쪽만 페이지 기준선을 져야 했기 때문이다. 카드가
    서면 양쪽 다 카드 안쪽 여백이라 갈릴 이유가 없다.
  */
  it('제목과 축 제목이 좌우 20 에 선다', () => {
    const heading = railRule('\\.filter-list-heading')

    expect(pxIn(heading, 'padding-inline')).toBe(20)
  })
})

describe('필터 레일 인셋 — 걸리는 자리 (#535)', () => {
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
    ['src/features/emergency/emergency-filter-rail.tsx', '병원 · 약국'],
  ])('%s 가 filter-rail 로 규칙에 가입한다', (path) => {
    const source = repoSource(path)

    expect(source).toContain('filter-rail')
    expect(source).toContain('filter-rail-title')
  })

  /*
    **아래 여백은 세 화면이 같다.** 바닥 위에 맨몸으로 서 있을 때는 pb 가 갈려도(16 · 24)
    카드 경계가 없어 눈에 걸리지 않았는데, 카드가 서면 마지막 축과 아래 테두리 사이가
    화면마다 다르게 보인다. 위쪽 `pt-5`(20) 와 같은 값으로 맞춘다.
  */
  it.each([
    'src/features/place/place-filter-rail.tsx',
    'src/features/plan/plan-filter-controls.tsx',
    'src/features/emergency/emergency-filter-rail.tsx',
  ])('%s 의 레일 아래 여백이 20 이다', (path) => {
    expect(repoSource(path)).toMatch(/className="filter-rail[^"]*\bpb-5\b/)
  })

  /*
    **모바일 시트는 가입하지 않는다.** 고정 폭 컨테이너라 카드 인셋과 모서리 margin 이
    둘 다 틀린 값이다 (`INSET_CLASS.panel` 이 평평한 것과 같은 이유). 규칙이 `.filter-rail`
    자손으로 한정돼 있어야 시트가 손대지 않고 그대로 남는다.
  */
  it('규칙이 전부 .filter-rail 자손으로 한정돼 있다', () => {
    for (const className of ['filter-list', 'filter-list-heading', 'filter-option']) {
      const unscoped = new RegExp(`(^|\\n)\\.${className}\\s*[,{]`).exec(globals)

      expect(unscoped).toBeNull()
    }
  })
})
