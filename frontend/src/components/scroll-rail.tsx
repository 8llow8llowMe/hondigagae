'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { pageScrollLeft, type ScrollFade, scrollFadeSide } from '@/lib/ui/scroll'
import { cn } from '@/lib/utils/cn'

/**
 * 가로 스크롤 줄의 **"더 있다" 신호** — fade 마스크 + 원형 화살표.
 *
 * 두 신호가 같은 사실을 말한다. 마스크는 **끊긴 것이 아니라 이어진다**는 것을 말하고
 * (잘린 셀이 흐려지면 화면 밖에 더 있다는 뜻으로 읽힌다), 화살표는 **그것을 만질 수 있다**는
 * 것을 말한다. 마스크만 두면 마우스 사용자는 밀 방법이 없다 — 트랙패드 가로 스크롤을
 * 아는 사람에게만 열린 기능이 된다.
 *
 * **`scrollbar-none` 과 짝이다.** 스크롤바를 상시 노출하면 활성 밑줄·진행 표시줄로
 * 오독된다 (`app/globals.css`). 그 자리를 이 둘이 대신한다.
 *
 * **화살표는 마우스 환경에만 둔다** (`app/globals.css` `.scroll-rail-arrow`). 터치는
 * 밀어서 넘기는 것이 자연스럽고, 390px 폭에서 좌우 버튼은 항목 하나씩을 가린다.
 *
 * 방향 판정(`scrollFadeSide`)과 이동 폭(`pageScrollLeft`)은 `lib/ui/scroll.ts` 의 순수
 * 함수가 갖는다 — 여기서 다시 계산하지 않는다.
 *
 * ```tsx
 * const rail = useScrollRail<HTMLUListElement>()
 *
 * <div className="scroll-rail">
 *   <ul ref={rail.ref} onScroll={rail.onScroll} className={cn('scrollbar-none overflow-x-auto', rail.fadeClassName)}>…</ul>
 *   <ScrollRailArrows rail={rail} prevLabel="이전" nextLabel="다음" />
 * </div>
 * ```
 *
 * **`<ul>` 자신이 스크롤러다.** 바깥 div 를 스크롤러로 삼고 안에 flex `<ul>` 을 넣으면
 * 넘치는 방향의 `padding-right` 가 무시돼 마지막 항목이 여백 없이 잘린다 — flex 컨테이너가
 * 직접 스크롤할 때만 끝 여백이 남는다. 그래서 이 훅은 컴포넌트가 아니라 ref 를 넘긴다.
 */
export type ScrollRail = {
  ref: React.RefObject<HTMLElement | null>
  fade: ScrollFade
  /** 스크롤러에 붙일 마스크 클래스 */
  fadeClassName: string
  onScroll: () => void
  page: (direction: 'left' | 'right') => void
}

const FADE_CLASS: Record<ScrollFade, string> = {
  none: '',
  left: 'scroll-fade-left',
  right: 'scroll-fade-right',
  both: 'scroll-fade-both',
}

export function useScrollRail<T extends HTMLElement>(): ScrollRail & {
  ref: React.RefObject<T | null>
} {
  const ref = useRef<T>(null)
  const [fade, setFade] = useState<ScrollFade>('none')

  const measure = useCallback(() => {
    const el = ref.current
    if (el === null) return

    setFade(
      scrollFadeSide({
        scrollLeft: el.scrollLeft,
        containerWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }),
    )
  }, [])

  /*
    **의존성 배열이 없다 — 매 렌더 뒤에 다시 잰다.** 항목이 늘거나 줄면 `scrollWidth` 만
    바뀌고 스크롤러의 박스 크기는 그대로라, `ResizeObserver` 는 그것을 알려 주지 않는다.
    골든타임 곡선이 실제로 그렇다: 시간이 지나며 셀이 하나씩 줄어든다.

    같은 값이면 `setFade` 가 리렌더를 내지 않으므로 루프가 되지 않는다.
  */
  useEffect(measure)

  useEffect(() => {
    const el = ref.current
    if (el === null) return

    // 창 크기 · 레일 폭이 바뀌면 스크롤 여지가 달라진다 (2단 ↔ 1단 전환이 대표적이다)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  const page = useCallback((direction: 'left' | 'right') => {
    const el = ref.current
    if (el === null) return

    /*
      `behavior: 'smooth'` 를 여기서 조건 분기하지 않는다 — `prefers-reduced-motion` 은
      `app/globals.css` 가 `scroll-behavior: auto !important` 로 전역에서 끈다.
    */
    el.scrollTo({
      left: pageScrollLeft({
        scrollLeft: el.scrollLeft,
        containerWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        direction,
      }),
      behavior: 'smooth',
    })
  }, [])

  return { ref, fade, fadeClassName: FADE_CLASS[fade], onScroll: measure, page }
}

/**
 * 좌우 화살표. **`.scroll-rail` 인 부모 안에 스크롤러와 형제로 둔다** — 스크롤러
 * 안에 넣으면 마스크가 화살표까지 흐리고, 같이 스크롤돼 제자리에 남지 않는다.
 *
 * **그 클래스는 `position: relative` 만이 아니다** (`app/globals.css`). `relative` 만 주면
 * 안쪽 스크롤러의 내용 폭이 조상의 `scrollWidth` 로 새어 페이지에 가로 스크롤이 생긴다 —
 * 390px 홈에서 `main` 이 390 → 630 이 됐다. 같이 걸린 `contain: layout` 이 그것을 끊는다.
 *
 * **갈 수 있는 쪽에만 그린다.** 비활성 버튼으로 남기면 누를 수 있는 것처럼 보이는 것이
 * 둘, 실제로 눌리는 것이 하나가 되어 어느 쪽이 끝인지 흐려진다. 나타나고 사라지는 것
 * 자체가 "여기가 끝" 이라는 신호다.
 */
export function ScrollRailArrows({
  rail,
  prevLabel,
  nextLabel,
}: {
  rail: ScrollRail
  prevLabel: string
  nextLabel: string
}) {
  const canPrev = rail.fade === 'left' || rail.fade === 'both'
  const canNext = rail.fade === 'right' || rail.fade === 'both'

  return (
    <>
      {canPrev && (
        <Arrow side="left" label={prevLabel} onClick={() => rail.page('left')}>
          <ChevronLeftIcon size={16} />
        </Arrow>
      )}
      {canNext && (
        <Arrow side="right" label={nextLabel} onClick={() => rail.page('right')}>
          <ChevronRightIcon size={16} />
        </Arrow>
      )}
    </>
  )
}

/**
 * 원형 테두리 버튼.
 *
 * **`rounded-full` 을 쓰는 유일한 컨트롤이다.** DESIGN.md §5 의 원형은 사진·아바타 몫이고
 * 칩·버튼은 8이다. 여기서 비켜나는 이유는 이것이 **면 위에 떠 있는 오버레이**이기
 * 때문이다 — 스크롤되는 내용 위에 얹히는 것이라 아래 내용의 사각 격자와 같은 모양이면
 * 셀의 일부로 읽힌다. 이 예외를 다른 자리로 흘리지 않는다.
 *
 * **그림자를 주지 않는다.** 띄우는 일은 옆의 fade 가 이미 한다 (마스크가 아래 내용을
 * 지운 자리에 얹힌다). 둘을 겹치면 계측면이 대시보드처럼 보인다 (DESIGN.md §0).
 *
 * 32px 이라 모바일 최소 터치 영역(44)에 못 미치지만, `.scroll-rail-arrow` 가
 * `pointer: coarse` 에서 이 버튼을 숨기므로 손가락이 닿는 일이 없다.
 */
function Arrow({
  side,
  label,
  onClick,
  children,
}: {
  side: 'left' | 'right'
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'scroll-rail-arrow border-border bg-bg text-fg-muted hover:text-fg hover:border-border-strong focus-visible:ring-brand-500 absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none',
        side === 'left' ? 'left-0' : 'right-0',
      )}
    >
      {children}
    </button>
  )
}
