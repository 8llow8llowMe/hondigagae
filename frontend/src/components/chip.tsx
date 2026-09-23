'use client'

import type { ReactNode, Ref } from 'react'

import { handleRadioGroupKeyDown, radioTabIndex } from '@/lib/ui/radio-group-keys'
import { cn } from '@/lib/utils/cn'

/**
 * 필터 칩 — 디자인 가이드 §5 FilterControls.
 *
 * **축의 성격이 컨트롤 종류를 정한다.**
 * - 배타(하나만) → `exclusive` — `role="radio"` + `aria-checked`
 * - 다중(여러 개) → 기본 — `aria-pressed` 토글
 *
 * **배타 축을 `aria-pressed` 토글로 두지 않는다.** 같은 세로/가로 목록이 다중 선택으로
 * 읽힌다. 이것이 가이드가 명시적으로 금지한 형태다.
 *
 * radius 는 8(`rounded-md`)이다. **원형이 아니다** — 원형은 사진·아바타 전용이고
 * (DESIGN.md §5), 아트보드의 필터 컨트롤도 전부 8이다.
 * 선택 상태는 `--band` 배경 + `--fg` 텍스트로, **배경색만이 아니라** weight 도 함께 올린다.
 */
export type ChipProps = {
  selected: boolean
  onSelect: () => void
  /** 배타 축이면 true. 기본은 다중 축이다 */
  exclusive?: boolean
  /**
   * 칩이 **값을 고르는 것이 아니라 시트를 여는 트리거**일 때 준다 (아트보드 `01 목록 — 모바일`
   * 의 "유형" · "지역" · "더보기").
   *
   * 주면 `aria-expanded` 를 쓰고 토글/라디오 의미를 **버리며**, `selected` 는 tint 만 정한다.
   * 시트를 여는 버튼에 `aria-pressed` 를 붙이면 스크린리더가 "선택됨" 으로 읽어 값이 이미
   * 적용된 것처럼 들린다 — 여는 것과 고르는 것은 다른 일이다.
   */
  expanded?: boolean
  /**
   * 아이콘만 든 칩의 이름. 주면 `aria-label`(보조기기)과 `title`(마우스 호버 툴팁)
   * 양쪽에 남긴다 — `ViewToggle` 의 아이콘형과 같은 규칙이다.
   *
   * 글자가 든 칩에는 주지 않는다. `aria-label` 이 보이는 글자를 덮어써서
   * 스크린리더가 읽는 이름과 화면에 보이는 이름이 갈린다.
   */
  label?: string
  /**
   * 높이 축 — 기본 `md`(44)이고 `sm` 은 **모바일에서만 36**(`h-9`)으로 내려간다 (#883).
   *
   * **44 하한은 이제 지도 위 타깃에만 있다** (`DESIGN.md` §7). 지도 화면은 칩이 지도와
   * 시트를 함께 밀어내는 유일한 자리라 — 375 에서 여섯 칩이 44 로 서니 세 줄 약 150px 을
   * 먹었다 — 거기서만 작게 간다. **768 이상에서는 `md` 와 같다**: 폭이 남는 자리에서 칩만
   * 작아지면 같은 컨트롤이 화면마다 다른 크기가 된다.
   *
   * 나머지 화면의 칩은 아직 `md` 다. 옮기는 것은 화면별 후속이다 (#883 본문).
   */
  size?: 'md' | 'sm'
  children: ReactNode
  className?: string
}

const SIZE_CLASS: Record<NonNullable<ChipProps['size']>, string> = {
  md: 'h-11 px-3',
  sm: 'h-9 px-2 md:h-11 md:px-3',
}

export function Chip({
  selected,
  onSelect,
  exclusive = false,
  expanded,
  label,
  size = 'md',
  children,
  className,
}: ChipProps) {
  /*
    **roving `tabindex` 는 배타 칩에만 붙는다** (#825). `aria-pressed` 토글과 시트를 여는
    칩(`aria-expanded`)은 라디오 그룹이 아니라 각자 탭 스톱이 맞다 — 여기서 갈리는 것이
    `role` 하나뿐이라 분기도 한 곳에 둔다.
  */
  const a11y =
    expanded !== undefined
      ? ({ 'aria-expanded': expanded, 'aria-haspopup': 'dialog' } as const)
      : exclusive
        ? ({
            role: 'radio',
            'aria-checked': selected,
            tabIndex: radioTabIndex(selected),
            onKeyDown: handleRadioGroupKeyDown,
          } as const)
        : ({ 'aria-pressed': selected } as const)

  return (
    <button
      type="button"
      {...a11y}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        'text-body-2 inline-flex items-center gap-1.5 rounded-md border whitespace-nowrap transition-colors',
        // 높이·좌우 여백은 size 가 갖는다 — 44 하한은 지도 위 타깃에만 남았다 (DESIGN.md §7, #883)
        SIZE_CLASS[size],
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
        // **테두리는 선택 여부와 무관하게 항상 있다** — 없으면 칩이 그냥 글자로 보여
        // 누를 수 있다는 것을 알 수 없다 (아트보드 `01 목록 — 모바일`: 미선택도 1px 테두리).
        // 선택은 tint + 진한 테두리 + weight 셋으로 말한다. 색 하나에 기대지 않는다.
        selected
          ? 'bg-band border-border-strong text-fg font-semibold'
          : 'bg-bg border-border text-fg-muted hover:bg-band font-medium',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * 칩 묶음. 배타 축은 `radiogroup`, 다중 축은 `group` 으로 나간다.
 *
 * **`aria-label` 이 필수다.** 축 이름이 없으면 스크린리더가 "라디오 그룹" 만 읽고
 * 무엇을 고르는 축인지 말하지 못한다.
 */
export function ChipGroup({
  label,
  exclusive = false,
  children,
  className,
  ref,
  onScroll,
}: {
  label: string
  exclusive?: boolean
  children: ReactNode
  className?: string
  /**
   * 가로 스크롤 컨테이너를 사용처가 제어할 때 쓴다 (선택 칩 센터링 · `useScrollRail`).
   *
   * **묶음 자신이 스크롤러여야 한다.** 바깥 div 를 스크롤러로 삼고 안에 이 묶음을 넣으면
   * 넘치는 방향의 `padding-right` 가 무시돼 마지막 칩이 여백 없이 잘린다 —
   * flex 컨테이너가 직접 스크롤할 때만 끝 여백이 남는다 (`components/scroll-rail.tsx`).
   */
  ref?: Ref<HTMLDivElement>
  /** 스크롤 위치를 사용처가 재야 할 때 (`useScrollRail` 의 `onScroll`) */
  onScroll?: () => void
}) {
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      role={exclusive ? 'radiogroup' : 'group'}
      aria-label={label}
      className={className}
    >
      {children}
    </div>
  )
}
