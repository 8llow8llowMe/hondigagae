'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import {
  centerScrollLeft,
  isDragGesture,
  pageScrollLeft,
  type ScrollFade,
  scrollFadeSide,
  swipeTarget,
} from '@/lib/ui/scroll'
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
 * **오버레이 화살표는 마우스 환경에만 둔다** (`app/globals.css` `.scroll-rail-arrow`). 터치는
 * 밀어서 넘기는 것이 자연스럽고, 390px 폭에서 좌우 버튼은 항목 하나씩을 가린다.
 * **레일 밖에 세우는 `placement="inline"` 은 그 제약이 없다** (#730) — 가릴 칸이 없고
 * 44×44 라 터치에서도 남는다 (§7 하한이 아니라 이 자리에서 고른 값이다 · #883).
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

/**
 * **마운트 시 한 번 옮길 `scrollLeft`** — `null` 이면 옮기지 않는다
 * ([#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **F-1**).
 *
 * 레일은 여태 언제나 `scrollLeft: 0` 이라 **가장 이른 = 가장 나쁜 시각**에서 시작했다.
 * 1280 실측(창 17–21시)에서 보이는 것은 `14·15·16`(면 없음) + `17시`(황갈) + `18시` 21px
 * 뿐이고 전부 안전인 `19·20·21시` 는 화면 밖이었다. 면이 한 톤이던 때는 문제가 아니었지만,
 * 칸마다 등급이 실린 뒤로는 **접힘이 사용자가 보는 것을 나쁜 쪽으로 치우치게 한다.**
 *
 * **`aligned` 가 빗장이다.** 이 함수가 결정을 갖는 이유가 그것이다 — 한 번 옮긴 뒤에는
 * 무슨 일이 있어도 `null` 이라, 사용자가 스크롤한 다음 레일이 다시 튀지 않는다. 훅의
 * 지역 변수로만 두면 규칙을 테스트할 수 없어 여기로 뺐다 (node 환경에는 레이아웃이 없다).
 *
 * **폭이 0 이면 아직 옮기지 않는다.** 레이아웃 전에 재면 `centerScrollLeft` 의 clamp 가
 * 0 을 내는데, 그것으로 빗장을 걸면 **영영 0 에 고정**된다 — 옮길 수 없는 것과 옮기지
 * 않기로 한 것은 다르다.
 *
 * **가운데로 놓는다(`centerScrollLeft`).** 대상을 왼쪽 끝에 붙이면 창 전체가 들어오지만
 * **창이 시작하는 경계가 화면 밖으로 밀린다** — "면이 있다/없다" 는 등급 색과 달리 흑백에서도
 * 살아남는 채널이고(#671 C-1), 그 경계가 안 보이면 남은 것은 tint 한 덩어리다. 가운데로
 * 놓으면 앞선 칸 몇과 좋은 쪽이 함께 선다. 스크롤 셈은 `lib/ui/scroll.ts` 가 갖는다 —
 * 여기서 다시 계산하지 않는다.
 */
export function railAlignScrollLeft(params: {
  /** 이미 한 번 옮겼는가 */
  aligned: boolean
  containerWidth: number
  scrollWidth: number
  /** 대상의 **스크롤러 내용 좌표** x. 대상이 없으면 `null` */
  targetLeft: number | null
  targetWidth: number
}): number | null {
  const { aligned, containerWidth, scrollWidth, targetLeft, targetWidth } = params

  if (aligned) return null
  if (targetLeft === null) return null
  if (containerWidth === 0) return null

  return centerScrollLeft({
    containerWidth,
    scrollWidth,
    itemOffsetLeft: targetLeft,
    itemWidth: targetWidth,
  })
}

export function useScrollRail<T extends HTMLElement>(options?: {
  /**
   * 마운트 뒤 **한 번만** 이 요소가 보이도록 레일을 옮긴다 (#671 F-1). 주지 않으면 예전처럼
   * `scrollLeft: 0` 에서 시작한다 — 기존 다섯 호출처의 동작은 한 글자도 바뀌지 않는다.
   *
   * **대상이 늦게 서도 된다.** 데이터가 오기 전에는 `current` 가 `null` 이라 아무 일도
   * 하지 않고, 칸이 선 뒤 렌더에서 옮긴다 (이 훅의 효과에는 의존성 배열이 없다).
   */
  focusRef?: React.RefObject<HTMLElement | null>
}): ScrollRail & {
  ref: React.RefObject<T | null>
} {
  const ref = useRef<T>(null)
  const [fade, setFade] = useState<ScrollFade>('none')
  const focusRef = options?.focusRef
  const aligned = useRef(false)

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

  /*
    **초기 위치 (#671 F-1).** `measure` 와 같은 이유로 의존성 배열이 없다 — 대상 칸은
    데이터가 온 뒤에야 서므로, 마운트 직후 한 번만 보면 `focusRef.current` 가 아직 `null` 이다.

    **결정은 `railAlignScrollLeft` 가 갖는다** (빗장 · 레이아웃 전 가드 · 셈). 여기 남은 것은
    DOM 을 읽어 넘기고 결과를 쓰는 일뿐이다.

    **`getBoundingClientRect` 차로 잰다.** `offsetLeft` 는 `offsetParent` 기준이라 스크롤러가
    그 기준이 아닐 때(`.scroll-rail` 이 `position: relative` 다) 값이 미묘하게 어긋난다.
    두 사각형의 차 + `scrollLeft` 는 배치와 무관하게 **스크롤러 내용 좌표**다.

    **`scrollLeft` 를 직접 넣는다** — `scrollTo({behavior:'smooth'})` 로 하면 첫 화면이
    움직이는 것으로 보여 사용자가 건드리지 않은 스크롤이 애니메이션으로 읽힌다.
  */
  useEffect(() => {
    const el = ref.current
    if (el === null) return

    const target = focusRef?.current ?? null
    const box = target === null ? null : target.getBoundingClientRect()
    const next = railAlignScrollLeft({
      aligned: aligned.current,
      containerWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      targetLeft: box === null ? null : box.left - el.getBoundingClientRect().left + el.scrollLeft,
      targetWidth: box === null ? 0 : box.width,
    })
    if (next === null) return

    aligned.current = true
    el.scrollLeft = next
    // 옮긴 자리에서 fade 를 다시 잰다 — 왼쪽에도 갈 곳이 생겼다
    measure()
  })

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

/** 놓기 직전 이만큼(ms) 멈춰 있었으면 튕긴 것이 아니다 — 속도를 버린다 */
const DRAG_FLING_IDLE_MS = 80

/** `scrollend` 를 못 내는 브라우저에서 스냅을 되돌리는 안전망(ms) — 부드러운 스크롤 한 번보다 길다 */
const DRAG_SETTLE_FALLBACK_MS = 600

/**
 * **마우스로 항목을 잡고 끌어 레일을 넘긴다** (#1404). 터치 · 펜은 건드리지 않는다 — 네이티브 스와이프가 이미 한다.
 *
 * - **끌기와 클릭을 거리로 가른다**(`isDragGesture`, 6px). 그 아래면 아무것도 하지 않아 카드 링크가 그대로 열린다.
 * - **끄는 동안 스냅을 끈다**(`[data-dragging]`, `app/globals.css`). 켜 둔 채 `scrollLeft` 를 쓰면 브라우저가
 *   매 프레임 가장 가까운 칸으로 되돌려 레일이 손을 따라오지 않는다. **클래스가 아니라 data 속성이다** — 끌면
 *   fade 방향이 바뀌어 리렌더되고, React 가 `className` 을 통째로 다시 써 붙인 클래스가 사라졌다(스냅이 돌아와 0 으로
 *   튕겼다, 헤드리스 실측). React 가 모르는 속성은 건드리지 않는다.
 * - **놓으면 칸을 직접 고른다** — `swipeTarget`(갤러리와 같은 규칙: 지나친 칸 · 튕긴 방향 · 15%). 스냅을 다시 켜는
 *   것만으로는 브라우저마다 다시 스냅하는 시점이 달라 놓은 자리에 멈추기도 한다.
 * - **끈 직후의 클릭을 삼킨다.** 카드 위에서 누르고 끌다 놓으면 브라우저가 그 카드에 `click` 을 낸다 — 그대로 두면
 *   넘기려다 상세로 간다. 캡처 단계에서 한 번만 막고, 다음 누르기에서 푼다.
 * - **네이티브 드래그(`dragstart`)를 막는다** — 링크 · 사진은 기본으로 끌려 나가 레일 대신 유령 이미지가 따라온다.
 *
 * 칸 폭은 첫 두 항목의 `offsetLeft` 차로 잰다 — 폭 토큰(82% · 44% · 30%)과 간격이 폭마다 달라 상수로 둘 수 없다.
 */
export function useDragScroll<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current
    if (el === null) return

    let start: { x: number; scrollLeft: number; pointerId: number } | null = null
    let dragging = false
    let suppressClick = false
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let settleTimer: ReturnType<typeof setTimeout> | null = null

    /*
      **스냅은 옮기기가 끝난 뒤에 되돌린다.** 놓자마자 켜면 브라우저가 그 순간 가장 가까운 칸으로 먼저 붙어, 이어 보낸
      `scrollTo` 가 덮였다 — 1.3 칸을 끌고 놓았는데 한 칸에 멈췄다(헤드리스 실측). `scrollend` 를 기다리고, 그 이벤트가
      없는 브라우저를 위해 시간 안전망을 둔다. 다시 누르면 즉시 푼다.
    */
    const releaseSnap = () => {
      if (settleTimer !== null) clearTimeout(settleTimer)
      settleTimer = null
      el.removeEventListener('scrollend', releaseSnap)
      delete el.dataset.dragging
    }

    const finish = (event: PointerEvent, settle: boolean) => {
      if (start === null || event.pointerId !== start.pointerId) return
      const from = start
      start = null
      if (!dragging) return

      dragging = false
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
      if (!settle) {
        releaseSnap()
        return
      }

      suppressClick = true
      const items = el.children
      const first = items[0] as HTMLElement | undefined
      const second = items[1] as HTMLElement | undefined
      if (first === undefined) {
        releaseSnap()
        return
      }

      const step = second === undefined ? first.offsetWidth : second.offsetLeft - first.offsetLeft
      const fling = event.timeStamp - lastT > DRAG_FLING_IDLE_MS ? 0 : velocity
      const index = swipeTarget({
        dragPx: el.scrollLeft - from.scrollLeft,
        velocity: fling,
        step,
        index: Math.round(from.scrollLeft / step),
        count: items.length,
      })
      const left = Math.min(index * step, el.scrollWidth - el.clientWidth)
      if (Math.abs(left - el.scrollLeft) < 1) {
        releaseSnap()
        return
      }

      el.addEventListener('scrollend', releaseSnap)
      settleTimer = setTimeout(releaseSnap, DRAG_SETTLE_FALLBACK_MS)
      el.scrollTo({ left, behavior: 'smooth' })
    }

    const onDown = (event: PointerEvent) => {
      suppressClick = false
      // 옮기던 중에 다시 잡으면 그 자리에서 이어 끈다 — 남은 스냅 되돌리기를 정리한다
      if (settleTimer !== null) releaseSnap()
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      start = { x: event.clientX, scrollLeft: el.scrollLeft, pointerId: event.pointerId }
      lastX = event.clientX
      lastT = event.timeStamp
      velocity = 0
    }

    const onMove = (event: PointerEvent) => {
      if (start === null || event.pointerId !== start.pointerId) return
      const dx = event.clientX - start.x
      if (!dragging) {
        if (!isDragGesture(dx)) return
        dragging = true
        el.setPointerCapture(event.pointerId)
        el.dataset.dragging = ''
      }

      const dt = event.timeStamp - lastT
      // 스크롤 방향 속도 — 포인터가 왼쪽으로 가면 양수(다음 칸 쪽)다 (`swipeTarget` 부호)
      if (dt > 0) velocity = (lastX - event.clientX) / dt
      lastX = event.clientX
      lastT = event.timeStamp
      el.scrollLeft = start.scrollLeft - dx
    }

    const onUp = (event: PointerEvent) => finish(event, true)
    const onCancel = (event: PointerEvent) => finish(event, false)

    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    }

    const onDragStart = (event: DragEvent) => event.preventDefault()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('click', onClick, true)
    el.addEventListener('dragstart', onDragStart)
    return () => {
      releaseSnap()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('dragstart', onDragStart)
    }
  }, [ref])
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
  placement = 'overlay',
}: {
  rail: ScrollRail
  prevLabel: string
  nextLabel: string
  /**
   * `overlay`(기본) — 스크롤러 위에 떠서 좌우 끝에 앉는다. `.scroll-rail` 인 부모가 필요하다.
   *
   * `inline` — **제목 줄처럼 보통의 흐름에 선다** ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
   * 골든타임 곡선에서 오버레이 화살표가 **값 위에 불투명하게 앉는 것**이 실측으로 잡혔다
   * (`elementsFromPoint(346, 702)` → `BUTTON.scroll-rail-arrow` ▸ `SPAN "기온 26.0℃"`).
   * 레일 밖으로 나오면 가릴 값이 없다.
   */
  placement?: 'overlay' | 'inline'
}) {
  const canPrev = rail.fade === 'left' || rail.fade === 'both'
  const canNext = rail.fade === 'right' || rail.fade === 'both'

  return (
    <>
      {canPrev && (
        <Arrow
          side="left"
          placement={placement}
          label={prevLabel}
          onClick={() => rail.page('left')}
        >
          <ChevronLeftIcon size={16} />
        </Arrow>
      )}
      {canNext && (
        <Arrow
          side="right"
          placement={placement}
          label={nextLabel}
          onClick={() => rail.page('right')}
        >
          <ChevronRightIcon size={16} />
        </Arrow>
      )}
    </>
  )
}

/**
 * 테두리 버튼. 모양이 `placement` 로 갈린다.
 *
 * ### `overlay` — 원형 32px
 *
 * **`rounded-full` 을 쓰는 유일한 컨트롤이다.** DESIGN.md §5 의 원형은 사진·아바타 몫이고
 * 칩·버튼은 8이다. 여기서 비켜나는 이유는 이것이 **면 위에 떠 있는 오버레이**이기
 * 때문이다 — 스크롤되는 내용 위에 얹히는 것이라 아래 내용의 사각 격자와 같은 모양이면
 * 셀의 일부로 읽힌다. 이 예외를 다른 자리로 흘리지 않는다.
 *
 * **그림자를 주지 않는다.** 띄우는 일은 옆의 fade 가 이미 한다 (마스크가 아래 내용을
 * 지운 자리에 얹힌다). 둘을 겹치면 계측면이 대시보드처럼 보인다 (DESIGN.md §0).
 *
 * 32px 이라 44 에 못 미치지만(그 하한은 #883 으로 지도 타깃만 남았다), `.scroll-rail-arrow` 가
 * `pointer: coarse` 에서 이 버튼을 숨기므로 손가락이 닿는 일이 없다.
 *
 * ### `inline` — 44×44, 곡률 8 (#730)
 *
 * **원형 예외를 가져오지 않는다.** 예외의 근거가 "면 위에 떠 있다" 였는데 이쪽은 제목 줄에
 * 그냥 서 있는 보통의 아이콘 버튼이다 — §5 의 버튼 값(8)이 그대로 맞는다.
 *
 * **`.scroll-rail-arrow` 도 붙이지 않는다.** 그 클래스가 터치에서 숨기는 근거 둘
 * (*"좌우 버튼이 항목을 하나씩 가린다"* · *"32px 이 44 에 못 미친다"*)이 여기서는 둘 다
 * 성립하지 않는다 — 레일 밖이라 가릴 칸이 없고 44×44 다. 터치에서도 남는다.
 */
function Arrow({
  side,
  placement,
  label,
  onClick,
  children,
}: {
  side: 'left' | 'right'
  placement: 'overlay' | 'inline'
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
        'border-border bg-bg text-fg-muted hover:text-fg hover:border-border-strong focus-visible:ring-brand-500 flex items-center justify-center border transition-colors focus-visible:ring-2 focus-visible:outline-none',
        placement === 'overlay'
          ? cn(
              'scroll-rail-arrow absolute top-1/2 size-8 -translate-y-1/2 rounded-full',
              side === 'left' ? 'left-0' : 'right-0',
            )
          : 'size-11 rounded-md',
      )}
    >
      {children}
    </button>
  )
}
