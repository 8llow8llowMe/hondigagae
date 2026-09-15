import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { readSource as repoSource, stripComments as withoutComments } from '@/test/source'

/**
 * 값이 **두 곳에 나뉘어 있어 눈으로는 못 잡는** 산술 두 건의 회귀 검사 — 이슈 #412 · #530.
 *
 *  (1) 권역 칸 폭 ↔ 숫자 자리 폭. 둘 중 하나만 고치면 값 줄이 조용히 접힌다.
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

describe('권역 칸 — 폭 산식 (#412 · #530)', () => {
  const source = withoutComments(repoSource('src/features/home/regional-weather-section.tsx'))

  /*
    **152 가 틀렸던 이유가 여기 있다.** `pl-3` + `border-l` 는 첫 칸을 뺀 네 칸에만
    붙는데(`first:pl-0` · `first:border-l-0`), 예전 산식은 인셋을 한 번만 세고
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

    return 17.4 + unitWidth() + pad * 2
  }

  /**
   * 배지가 숫자 뒤에 더 담는 글자의 폭 — `regionScoreUnit` 의 `{score}` 밖 (#638).
   *
   * **`100` 이던 배지가 `100점` 이 됐다.** 한글 한 글자는 `text-caption`(12px)에서 폭이
   * 글자 크기와 같다고 본다 — 390 실측은 10.4px 이라 12 는 **보수적인 쪽**이고, 이 모델은
   * 과대평가하는 방향으로만 틀린다.
   *
   * **문구에서 읽는다.** 단위가 두 글자로 늘면 산식이 따라 움직여야 하는데, 숫자를 여기
   * 박아 두면 그때 조용히 어긋난다.
   */
  function unitWidth(): number {
    return [...messages.home.regionScoreUnit.replace('{score}', '')].length * 12
  }

  /**
   * 숫자 자리에 **실제로** 남는 폭 = 칸 − 인셋 13 − 아이콘 24 − gap 8 − gap 8 − 배지.
   *
   * **`w-20`/`lg:w-22` 는 하한이 아니라 상한이다.** 이 값이 선언한 폭보다 작으면 숫자
   * 자리가 조용히 눌리고, 화면에 드러나는 것은 넘침이 아니라 **값 줄 접힘**이다 (#412).
   * 그래서 선언값이 아니라 **남는 폭**으로 잰다 — 선언값으로 재면 눌린 칸을 놓친다.
   */
  function effectiveNums(cell: number): number {
    return cell - 13 - 24 - 8 - 8 - scoreBadgeWidth()
  }

  /** 가장 넓은 값 줄 `최고 31.0℃` 의 실측 폭. `최저 24.0℃` 도 같다 */
  const WIDEST_LINE = 62.9

  /*
    **배지 여백과 칸 폭은 함께 움직여야 한다** (#412 후속). 숫자 자리 폭은 하한이 아니라
    상한이라, 배지가 넓어지면 그 값 아래로 **조용히** 눌린다 — 화면은 한동안
    멀쩡해 보이다가 폰트가 달라지는 환경에서 접힌다. 그래서 배지 쪽 값을
    `metric.tsx` 에서 읽어 와 검사한다.
  */
  /**
   * 두 단계다 — 좁은 폭(`w-44` + `w-20`)과 `lg`(`lg:w-46` + `lg:w-22`).
   *
   * **#530 에서 모든 폭이 가로 레일이 되면서 좁은 쪽이 새로 생겼다.** 그쪽이 더 빡빡하니
   * 검사도 그쪽이 먼저다 — 칸만 한 단 내리고 숫자 자리를 88 로 두면 174.4 를 요구해
   * 값 줄이 조용히 접힌다 (#412 의 재발이다).
   */
  function widths(): {
    narrow: { cell: number; nums: number }
    wide: { cell: number; nums: number }
  } {
    const cell = /w-(\d+) shrink-0 snap-start flex-col[^"]*lg:w-(\d+)/.exec(source)
    const nums = /flex w-(\d+) flex-col items-start lg:w-(\d+)/.exec(source)

    return {
      narrow: { cell: px(cell?.[1]), nums: px(nums?.[1]) },
      wide: { cell: px(cell?.[2]), nums: px(nums?.[2]) },
    }
  }

  /*
    **선언한 숫자 자리를 다 담지는 못한다** (#638). 배지가 `100점` 으로 늘면서 390 실측에서
    둘째 칸부터 80 → **71.2** 로 눌렸다 — 가장 넓은 줄 62.9 에 8.3px 이 남는다(`점` 이 붙기
    전에는 17.1px 이었다). 접히지는 않지만 여유가 절반으로 줄었고, 그 몫이 이 검사가 지키는
    전부다. 배지를 더 키우거나 값 줄이 길어지면 여기서 먼저 걸린다.
  */
  it('칸 폭이 눌린 뒤에도 가장 넓은 값 줄을 담는다', () => {
    for (const { cell, nums } of Object.values(widths())) {
      expect(cell).not.toBeNaN()
      expect(nums).not.toBeNaN()

      // 폰트 렌더링이 달라져도 접히지 않을 몫 5px 을 남긴다
      expect(effectiveNums(cell)).toBeGreaterThanOrEqual(WIDEST_LINE + 5)
    }
  })

  /*
    **1440 에서 화살표가 남지 않아야 한다.** 우측 열 가용폭이 953 이고 칸 5개 + gap 4×4
    이므로 칸 상한은 `(953 − 16) / 5 = 187.4` 다. 1280(가용 793)은 어떤 폭으로도 못
    지키지만(155 이하가 필요한데 그 폭으로는 값이 접힌다) 1440 은 지킬 수 있다.
  */
  it('칸 폭이 1440 상한을 넘지 않는다', () => {
    expect(widths().wide.cell).toBeLessThanOrEqual((953 - 16) / 5)
  })

  /*
    **좁은 폭은 375 가 기준이다** (#530). 카드 인셋 16 을 뺀 가용폭이 343 이라, 칸이
    172 를 넘으면 둘째 칸이 절반 아래로 잘린다 — 레일은 "더 있다" 를 보여야 하고
    반쯤 잘린 칸은 "깨졌다" 로 읽힌다. 176 은 둘째 칸이 163/176(93%) 이라 살아 있다.
  */
  it('좁은 폭 칸이 375 에서 둘째 칸을 절반 넘게 보여 준다', () => {
    const { cell } = widths().narrow

    expect(343 - cell - 4).toBeGreaterThanOrEqual(cell / 2)
  })

  /* 숫자만 담는 배지라 낱말용 `md`(8px)와 갈랐다 — 갈라 둔 것이 되돌려지지 않게 잡는다 */
  it('점수 배지가 score 크기를 쓴다', () => {
    expect(source).toContain('size="score"')
  })

  /* 가장 넓은 줄이 `최고 31.0℃` = 62.9px 이다. 폰트가 달라져도 접히지 않을 몫을 남긴다 */
  it('숫자 자리가 가장 넓은 줄보다 넉넉하다', () => {
    for (const { nums } of Object.values(widths())) {
      expect(nums).toBeGreaterThanOrEqual(80)
    }
  })

  /*
    **`ml-auto` 는 배지 열을 세우는 유일한 장치다.** 아이콘도 숫자도 없는 칸(`한라산권`)
    에서는 배지가 곧 첫 자식이라, 걷으면 그 칸만 100px 앞으로 나온다.
  */
  it('배지가 ml-auto 로 열을 이룬다', () => {
    expect(source).toContain('ml-auto')
    // `lg:` 한정이 되살아나면 좁은 폭에서 `한라산권` 배지만 100px 앞으로 나온다 (#530)
    expect(source).not.toContain('lg:ml-auto')
  })

  /*
    **`ml-auto` 가 남는 공간을 전부 먹으므로 `justify-between` 은 발동할 자리가 없다.**
    같은 일을 두 규칙이 하면 나중에 어느 쪽을 고쳐야 하는지 알 수 없어 걷었다.
  */
  it('값 묶음에 justify-between 을 되살리지 않는다', () => {
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
