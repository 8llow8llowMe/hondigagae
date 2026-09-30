import { describe, expect, it } from 'vitest'

import { readSource as repoSource, stripComments as withoutComments } from '@/test/source'

/**
 * 값이 **두 곳에 나뉘어 있어 눈으로는 못 잡는** 산술 두 건의 회귀 검사 — 이슈 #412 · #530 · #1068.
 *
 *  (1) 권역 칸 폭 ↔ 칸 안에서 가장 넓은 줄. 칸 폭은 레일이 정하고 줄 폭은 글자가 정한다.
 *  (2) `BottomSheet` 데스크톱 폭 ↔ `Modal` 기본 폭. 갈리면 같은 화면에서 뜨는 오버레이
 *      두 계열의 폭이 달라진다.
 */

/** Tailwind 스페이싱 스케일: `w-44` 의 `44` → 176px */
function px(step: string | undefined): number {
  return step === undefined ? Number.NaN : Number(step) * 4
}

/**
 * **주석을 걷어낸 소스만 본다.** 이 파일의 검사는 "이 클래스가 붙어 있나" 를 묻는데,
 * 근거 주석이 같은 클래스 이름을 인용하고 있어서(그것이 이 저장소의 주석 방식이다)
 * 원문 그대로 훑으면 걷어낸 클래스가 여전히 있는 것처럼 잡힌다.
 */

describe('권역 칸 — 폭 산식 (#412 · #530 · #1068)', () => {
  const source = withoutComments(repoSource('src/features/home/regional-weather-section.tsx'))

  /*
    **#1068 이전의 산식은 가로 경쟁이었다.** `아이콘 | 숫자 세 줄 | 점수 배지` 가 한 줄에 서서
    칸 폭을 나눠 가졌고, 배지가 `100` → `100점`(#638) → `100/100`(#1065)으로 넓어질 때마다
    숫자 자리(`w-20`/`lg:w-22`, 하한이 아니라 상한)가 조용히 눌려 `최고 31.0℃` 가 접혔다.
    이 파일이 배지 여백과 칸 폭을 함께 읽어 그 관계를 잡았다.

    **#1068 에서 칸 안이 세로 줄 넷이 됐다** (`이름 [추천] · 점수 · 막대 · 날씨`). 줄마다 칸
    폭을 혼자 쓰므로 검사도 "가장 넓은 한 줄이 칸 안에 드는가" 로 바뀐다.
  */

  /**
   * 칸 안 글자 자리 = 칸 − 인셋 13.
   *
   * **인셋은 첫 칸에만 없다** (#412). 둘째 칸부터 `pl-3`(12) + `border-l`(1) 이 매번 들어간다 —
   * 예전 산식이 이것을 한 번만 세서 첫 칸만 멀쩡해 보였다.
   */
  function content(cell: number): number {
    return cell - 13
  }

  /** 기온 줄의 flex 간격 (`gap-N`). 날씨 아이콘 ↔ 기온 사이에 든다 */
  function skyGap(): number {
    return px(
      /text-body-2 flex items-center gap-(\d+) font-semibold tabular-nums/.exec(source)?.[1],
    )
  }

  /** 이름 줄의 flex 간격. 권역 이름 ↔ `추천` 사이에 든다 */
  function nameGap(): number {
    return px(
      /<span className="flex items-center gap-(\d+)">\s*<span className="text-body-2 min-w-0/.exec(
        source,
      )?.[1],
    )
  }

  /**
   * 가장 넓은 두 줄 — 전부 390 실측(2026-10-01, #1068)이다.
   *
   *  - **기온 줄**: 아이콘 24 + gap + 글자. 글자는 소수가 양쪽에 붙은 `27.5–31.5℃`(84.0px, 14/600)로
   *    잰다 — mock 의 `24–31℃` 는 58.5px 이지만 #1067 표기는 의미 있는 소수를 버리지 않으므로
   *    여름 날 두 값 모두 `.5` 가 되는 것이 이 줄의 최악이다. 영하(`-3.5–4.5℃` 72.3)보다 넓다.
   *  - **이름 줄**: 네 글자 이름(`제주시권` 48.4, 14/600) + gap + `추천` 배지 36.8. 서버 권역
   *    이름이 전부 네 글자 이하다(`제주시권` · `서귀포권` · `한라산권`).
   *
   * **글자 폭은 소스에 없다 — 폰트가 정한다.** 그래서 실측을 여기 적고, 실제 줄 수는
   * `e2e/region-score-badge.spec.ts` 가 `Range.getClientRects` 로 다시 잰다.
   */
  function widestLine(): number {
    const sky = 24 + skyGap() + 84.0
    const name = 48.4 + nameGap() + 36.8

    return Math.max(sky, name)
  }

  /**
   * 두 단계다 — 좁은 폭(`w-44`)과 `lg`(`lg:w-46`).
   *
   * **#530 에서 모든 폭이 가로 레일이 되면서 좁은 쪽이 새로 생겼다.** 그쪽이 더 빡빡하니
   * 검사도 그쪽이 먼저다.
   */
  function widths(): { narrow: number; wide: number } {
    const cell = /w-(\d+) shrink-0 snap-start flex-col[^"]*lg:w-(\d+)/.exec(source)

    return { narrow: px(cell?.[1]), wide: px(cell?.[2]) }
  }

  it('칸 안 글자 자리가 가장 넓은 줄을 담는다', () => {
    expect(skyGap()).not.toBeNaN()
    expect(nameGap()).not.toBeNaN()

    for (const cell of Object.values(widths())) {
      expect(cell).not.toBeNaN()

      // 폰트 렌더링이 달라져도 접히지 않을 몫 5px 을 남긴다
      expect(content(cell)).toBeGreaterThanOrEqual(widestLine() + 5)
    }
  })

  /*
    **1440 에서 화살표가 남지 않아야 한다.** 우측 열 가용폭이 953 이고 칸 5개 + gap 4×4
    이므로 칸 상한은 `(953 − 16) / 5 = 187.4` 다. 1280(가용 793)은 어떤 폭으로도 못
    지키지만(155 이하가 필요하다) 1440 은 지킬 수 있다.
  */
  it('칸 폭이 1440 상한을 넘지 않는다', () => {
    expect(widths().wide).toBeLessThanOrEqual((953 - 16) / 5)
  })

  /*
    **좁은 폭은 375 가 기준이다** (#530). 카드 인셋 16 을 뺀 가용폭이 343 이라, 칸이
    172 를 넘으면 둘째 칸이 절반 아래로 잘린다 — 레일은 "더 있다" 를 보여야 하고
    반쯤 잘린 칸은 "깨졌다" 로 읽힌다. 176 은 둘째 칸이 163/176(93%) 이라 살아 있다.
  */
  it('좁은 폭 칸이 375 에서 둘째 칸을 절반 넘게 보여 준다', () => {
    const { narrow } = widths()

    expect(343 - narrow - 4).toBeGreaterThanOrEqual(narrow / 2)
  })

  /*
    **#1068 에서 걷은 가로 배치가 되살아나지 않게 잡는다.** 숫자 자리(`w-20`)나 점수 배지
    (`size="score"`)가 칸에 돌아오면 폭 경쟁이 되살아나고, 위 산식은 그것을 보지 못한다.
  */
  it('칸에 고정 숫자 자리와 점수 배지를 되살리지 않는다', () => {
    expect(source).not.toMatch(/flex w-\d+ flex-col items-start/)
    expect(source).not.toContain('size="score"')
  })

  /*
    **`ml-auto` 가 `추천` 을 칸 오른쪽에 붙인다.** `lg:` 한정이 되살아나면 좁은 폭에서만
    이름 옆에 붙어 칸마다 자리가 갈린다 (#530).
  */
  it('추천 표시가 폭 분기 없이 ml-auto 로 붙는다', () => {
    expect(source).toContain('ml-auto')
    expect(source).not.toContain('lg:ml-auto')
  })

  /*
    **`ml-auto` 가 남는 공간을 전부 먹으므로 `justify-between` 은 발동할 자리가 없다** (#412).
    같은 일을 두 규칙이 하면 나중에 어느 쪽을 고쳐야 하는지 알 수 없어 걷었다.
  */
  it('칸에 justify-between 을 되살리지 않는다', () => {
    expect(source).not.toContain('justify-between')
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
