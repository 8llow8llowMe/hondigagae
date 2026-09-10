import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * 값이 **두 곳에 나뉘어 있어 눈으로는 못 잡는** 산술 두 건의 회귀 검사 — 이슈 #412.
 *
 *  (1) 권역 칸 폭 ↔ 숫자 자리 폭. 둘 중 하나만 고치면 값 줄이 조용히 접힌다.
 *  (2) `BottomSheet` 데스크톱 폭 ↔ `Modal` 기본 폭. 갈리면 같은 화면에서 뜨는 오버레이
 *      두 계열의 폭이 달라진다.
 */

function repoSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

/** Tailwind 스페이싱 스케일: `w-44` 의 `44` → 176px */
function px(step: string | undefined): number {
  return step === undefined ? Number.NaN : Number(step) * 4
}

/**
 * **주석을 걷어낸 소스만 본다.** 이 파일의 검사는 "이 클래스가 붙어 있나" 를 묻는데,
 * 근거 주석이 같은 클래스 이름을 인용하고 있어서(그것이 이 저장소의 주석 방식이다)
 * 원문 그대로 훑으면 걷어낸 클래스가 여전히 있는 것처럼 잡힌다.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('권역 칸 — 폭 산식 (#412)', () => {
  const source = withoutComments(repoSource('src/features/home/regional-weather-section.tsx'))

  /*
    **152 가 틀렸던 이유가 여기 있다.** `lg:pl-3` + `lg:border-l` 는 첫 칸을 뺀 네 칸에만
    붙는데(`lg:first:pl-0` · `lg:first:border-l-0`), 예전 산식은 인셋을 한 번만 세고
    "4px 여유" 라고 적었다. 실제로 둘째 칸부터 값 자리가 65.6px 이라 `최고 31.0℃`(62.9px)
    옆에 2.7px 만 남았고, 폰트 렌더링이 조금만 달라져도 접혔다.
  */
  /**
   * 점수 배지 폭 = 좌우 여백 + 나머지.
   *
   * **나머지 17.4px 은 글자(`100`, `tabular-nums`) + 투명 테두리 2px 을 합친 값이다.**
   * 실측으로 잡았다 — `px-2` 33.4 · `px-3` 41.4 · `px-4` 49.4 로 여백 4px 마다 정확히
   * 8px 씩 움직인다. 테두리를 따로 더하면 이중으로 세게 된다.
   */
  function scoreBadgeWidth(): number {
    const metric = withoutComments(repoSource('src/components/metric.tsx'))
    const pad = px(/score:\s*'px-(\d+)/.exec(metric)?.[1])

    return 17.4 + pad * 2
  }

  /*
    **배지 여백과 칸 폭은 함께 움직여야 한다** (#412 후속). `lg:w-22` 는 하한이 아니라
    상한이라, 배지가 넓어지면 숫자 자리가 88 아래로 **조용히** 눌린다 — 화면은 한동안
    멀쩡해 보이다가 폰트가 달라지는 환경에서 접힌다. 그래서 배지 쪽 값을
    `metric.tsx` 에서 읽어 와 검사한다.
  */
  it('칸 폭이 인셋·아이콘·숫자 자리·배지의 합을 담는다', () => {
    const cellPx = px(/lg:w-(\d+) lg:shrink-0/.exec(source)?.[1])
    const numsPx = px(/flex flex-col items-start lg:w-(\d+)/.exec(source)?.[1])

    expect(cellPx).not.toBeNaN()
    expect(numsPx).not.toBeNaN()

    // 인셋 13(pl-3 + border-l) + 아이콘 24 + gap 8 + 숫자 + gap 8 + 배지
    const required = 13 + 24 + 8 + numsPx + 8 + scoreBadgeWidth()

    expect(cellPx).toBeGreaterThanOrEqual(required)
  })

  /*
    **1440 에서 화살표가 남지 않아야 한다.** 우측 열 가용폭이 953 이고 칸 5개 + gap 4×4
    이므로 칸 상한은 `(953 − 16) / 5 = 187.4` 다. 1280(가용 793)은 어떤 폭으로도 못
    지키지만(155 이하가 필요한데 그 폭으로는 값이 접힌다) 1440 은 지킬 수 있다.
  */
  it('칸 폭이 1440 상한을 넘지 않는다', () => {
    const cellPx = px(/lg:w-(\d+) lg:shrink-0/.exec(source)?.[1])

    expect(cellPx).toBeLessThanOrEqual((953 - 16) / 5)
  })

  /* 숫자만 담는 배지라 낱말용 `md`(8px)와 갈랐다 — 갈라 둔 것이 되돌려지지 않게 잡는다 */
  it('점수 배지가 score 크기를 쓴다', () => {
    expect(source).toContain('size="score"')
  })

  /* 가장 넓은 줄이 `최고 31.0℃` = 62.9px 이다. 폰트가 달라져도 접히지 않을 몫을 남긴다 */
  it('숫자 자리가 가장 넓은 줄보다 넉넉하다', () => {
    expect(px(/flex flex-col items-start lg:w-(\d+)/.exec(source)?.[1])).toBeGreaterThanOrEqual(80)
  })

  /*
    **`ml-auto` 는 배지 열을 세우는 유일한 장치다.** 아이콘도 숫자도 없는 칸(`한라산권`)
    에서는 배지가 곧 첫 자식이라, 걷으면 그 칸만 100px 앞으로 나온다.
  */
  it('배지가 lg:ml-auto 로 열을 이룬다', () => {
    expect(source).toContain('lg:ml-auto')
  })

  /*
    **`ml-auto` 가 남는 공간을 전부 먹으므로 `justify-between` 은 발동할 자리가 없다.**
    같은 일을 두 규칙이 하면 나중에 어느 쪽을 고쳐야 하는지 알 수 없어 걷었다.
  */
  it('값 묶음에 lg:justify-between 을 되살리지 않는다', () => {
    expect(source).not.toContain('lg:justify-between')
  })
})

describe('오버레이 폭 — BottomSheet 와 Modal 이 같은 값을 쓴다 (#412)', () => {
  const sheet = withoutComments(repoSource('src/components/bottom-sheet.tsx'))
  const modal = withoutComments(repoSource('src/components/modal.tsx'))

  it('시트의 데스크톱 폭이 Modal 기본 크기와 같다', () => {
    // Modal 은 size 기본값이 sm 이다 — `size === 'md' ? 'max-w-md' : 'max-w-sm'`
    expect(modal).toContain("'max-w-sm'")
    expect(sheet).toContain('md:max-w-sm')
    expect(sheet).not.toContain('md:max-w-md')
  })
})
