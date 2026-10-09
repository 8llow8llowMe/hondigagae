'use client'

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react'

import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * MapSheet — 지도 위 하단 시트 3단.
 *
 * 아트보드 `혼디가개 장소 찾기` 06절. **`BottomSheet` 와 다른 컴포넌트다.**
 * 저쪽은 모달(배경 덮개 + `aria-modal` + Esc 로 닫힘)이라 지도를 가리고 제스처를
 * 막는다. 여기는 반대여야 한다:
 *
 *  - **배경 덮개가 없다.** 시트가 열려 있어도 지도 이동·확대가 계속 먹는다
 *  - **모달이 아니다.** 포커스를 가두지 않는다 — 지도와 시트를 오가야 한다
 *  - 단계는 **최소 / 중간 / 최대** 3단이고 손을 떼면 가장 가까운 단계로 붙는다(스냅)
 *  - **어느 단계에서도 탭바를 덮지 않는다** (#883). 시트 바닥은 언제나 탭바 위다
 *
 * 드래그는 Pointer Events 하나로 처리한다 — 마우스·터치·펜이 같은 코드로 돌고,
 * `setPointerCapture` 가 손가락이 시트 밖으로 나가도 추적을 유지한다.
 */

export const SHEET_STOPS = ['min', 'mid', 'max'] as const
export type SheetStop = (typeof SHEET_STOPS)[number]

/** 뷰포트 높이 대비 비율. 최대는 검색 헤더가 보이도록 85% 에서 멈춘다 */
const STOP_RATIO: Record<SheetStop, number> = { min: 0.2, mid: 0.45, max: 0.85 }

/** 이보다 적게 끌면 단계를 바꾸지 않는다 — 스크롤하려다 단계가 바뀌면 목록을 못 읽는다 */
const DRAG_THRESHOLD_PX = 24

/**
 * **헤더 띠가 있는 지도**의 플로팅 컨트롤을 비켜 가는 `maxTopInset` — 이슈
 * [#901](https://github.com/8llow8llowMe/hondigagae/issues/901) **D2**.
 *
 * 지도 화면 둘(`/places` · `/emergency`)은 검색·보기 전환을 지도 위에 띄운다. 그 바닥은
 * **고정 px** 다:
 *
 * | 폭 | 헤더 | `top-5` | 컨트롤 | 바닥 |
 * | --- | ---: | ---: | ---: | ---: |
 * | < 768 | 56 | 20 | 44 | **120** |
 * | ≥ 768 | 64 | 20 | 44 | **128** |
 *
 * 그런데 `STOP_RATIO.max`(85dvh)는 **비율**이라 윗변이 기기 높이를 따라간다 — 812 에서
 * 2px 차로 비껴가도록 튜닝됐지만 **800 에서 딱 붙고 640 에서 24px 덮는다**(실측). 짧은
 * 기기일수록 더 덮는 구조다.
 *
 * `136` 은 `128 + 8` 이다. 아래 `maxTopInset` 주석이 *"비율은 기기가 작을수록 더 덮는다"*
 * 고 적어 둔 바로 그 함정을 지도 화면도 px 로 피한다 — 담기 화면이 이미 쓰던 길이다.
 */
export const MAP_TOP_CONTROLS_INSET = 136

/**
 * **지도 아일랜드**의 플로팅 컨트롤을 비켜 가는 `maxTopInset` — 이슈 #1287
 * (`docs/features/place/지도-아일랜드헤더-세부명세.md` D2-1).
 *
 * `/places` 지도 보기는 흰 헤더 띠가 없고 지도가 y 0 부터다. 헤더는 지도 위 알약이고, 조작 줄이
 * 그 아래 모든 폭에서 같은 y 68 에 선다 — 폭으로 갈리는 값이 없다.
 *
 * | 위 | 알약 | 간격 | 검색 · 보기 전환 | 여유 | 합 |
 * | ---: | ---: | ---: | ---: | ---: | ---: |
 * | 8 | 48 | 12 | 44 | 8 | **120** |
 *
 * `.map-island .map-preview-sheet`(`app/globals.css`)가 같은 `120px` 을 쓴다. 136 은 `/emergency` ·
 * 담기 지도가 계속 쓴다 — 그 화면들이 옮겨지면(명세 D7-3) 136 이 사라진다.
 */
export const MAP_ISLAND_TOP_CONTROLS_INSET = 120

/**
 * 여기서 시작한 제스처는 드래그로 치지 않는다 — **입력칸과 표식(`data-sheet-no-drag`)뿐이다.**
 *
 * **칩 · 버튼 · 링크는 뺐다** (#1278, 사용자 결정 2026-10-08). 2026-10-07 에 "칩을 누르려다 시트가
 * 끌린다" 를 막으려고 버튼과 필터 줄 전체를 뺐더니, 머리의 대부분이 손잡이가 아니어서 칩을 잡고
 * 올리면 시트가 움직이지 않았다. 이제 **누를 때 정하지 않고 움직임이 가른다**(`sheetDragIntent`) —
 * 세로로 충분히 끌어야 드래그고, 그랬으면 뒤따르는 click 을 삼켜 칩이 눌리지 않는다. 10-07 의 사고는
 * 손 떨림이 드래그로 잡혀서였으므로 문턱(`DRAG_SLOP_PX`)이 막는다.
 *
 * 입력칸은 그대로 뺀다 — 거기서 끄는 것은 글자 선택 · 커서 이동이라 그 칸의 일이다.
 */
const DRAG_IGNORED_SELECTOR = 'input, select, textarea, [data-sheet-no-drag]'

/**
 * 이 자리에서 시트 드래그 **후보**를 시작해도 되는가 ([#901](https://github.com/8llow8llowMe/hondigagae/issues/901) **D3** · #1278).
 *
 * 머리 전체(그래버 · 필터 줄 · 개수 줄)가 손잡이다. 후보일 뿐이고, 드래그인지는 움직임이 정한다.
 * **목록은 여전히 드래그를 안 받는다** — 그쪽이 먹으면 스크롤이 죽는다(아래 주석).
 */
export function shouldStartSheetDrag(target: { closest(selector: string): unknown } | null) {
  if (target === null) return false

  return target.closest(DRAG_IGNORED_SELECTOR) === null
}

/** 이만큼 움직이기 전에는 누르기인지 끌기인지 모른다 — 손 떨림을 드래그로 잡지 않는다 (#1278) */
const DRAG_SLOP_PX = 8

/**
 * 누른 자리에서 `(dx, dy)` 만큼 움직였을 때의 판정 (#1278).
 *
 * - `pending` — 아직 문턱 안이다. 손을 떼면 그냥 누르기(click)다
 * - `sheet` — 세로가 문턱을 넘고 가로보다 크다. 시트를 끈다
 * - `none` — 가로가 우세하다. 칩 줄 가로 스크롤의 것이다(터치는 `touch-pan-x` 라 브라우저가 가져간다)
 */
export function sheetDragIntent(dx: number, dy: number): 'pending' | 'sheet' | 'none' {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < DRAG_SLOP_PX && ay < DRAG_SLOP_PX) return 'pending'

  return ay > ax ? 'sheet' : 'none'
}

export function MapSheet({
  label,
  stop,
  onStopChange,
  toolbar,
  header,
  children,
  className,
  maxTopInset = 0,
}: {
  /**
   * 시트의 접근성 이름. **화면마다 다르다** — 장소 찾기는 "장소 목록", 긴급 시설은
   * "병원 · 약국 목록" 이다. 문구를 이 컴포넌트가 들고 있던 시절에는 병원 목록이
   * "장소 목록" 으로 읽혔다.
   */
  label: string
  stop: SheetStop
  onStopChange: (stop: SheetStop) => void
  /**
   * 전폭 컨트롤 줄 — 필터가 여기 온다. **`header` 와 한 줄에 두지 않는다.**
   * 단계 이동 버튼과 나란히 두면 375 에서 폭이 300 도 안 남아 필터 칩이 두 개만 보였다.
   */
  toolbar?: ReactNode
  /** 항상 보이는 줄 — 개수와 정렬. 최소 단계에서도 남는다 */
  header: ReactNode
  children: ReactNode
  className?: string
  /**
   * `max` 단계에서 **비워 둘 상단 높이**(px). 기본 `0` 이면 지금까지처럼 `85dvh` 다.
   *
   * **비율이 아니라 px 로 받는다.** `STOP_RATIO.max`(0.85dvh)는 상단 컨트롤이
   * `absolute` 로 떠 있는 `/places` 기준으로 튜닝된 값이라, 헤더가 **정상 흐름**인
   * 화면에서는 헤더를 덮는다 — 375×812 실측으로 시트 상단이 y=122 인데 담기 화면
   * 헤더는 y=56~189 를 쓴다(제목·보기 전환·부제가 전부 가려지고 지도 가시 영역이 0).
   *
   * 그리고 비율은 **기기가 작을수록 더 덮는다**: 667px 기기라면 `85dvh` 의 상단이
   * y=100 으로 내려가 지금보다 나빠진다. 헤더 높이는 기기 높이와 무관하게 거의
   * 일정하므로 px 이 안정적이다.
   */
  maxTopInset?: number | undefined
}) {
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  /**
   * 누른 포인터. `intent` 가 `sheet` 가 되기 전에는 아무것도 잡지 않는다 — 누르는 순간 캡처하면
   * click 대상이 칩이 아니라 머리로 바뀐다(#1264 캐러셀과 같은 함정).
   */
  const press = useRef<{
    id: number
    x: number
    y: number
    intent: 'pending' | 'sheet' | 'none'
  } | null>(null)
  /** 직전 제스처가 시트 드래그였다 — 뒤따르는 click 을 삼킨다 */
  const dragged = useRef(false)

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    /*
      **포털에서 올라온 이벤트는 받지 않는다.** React 포인터 이벤트는 포털을 지나 React 조상으로
      버블한다 — 필터 줄이 연 지역 · 더보기 시트(`BottomSheet`, body 포털)에서 시작한 제스처가 이
      머리까지 와서, DOM 조상에 표식이 없으니 드래그로 잡혔다(리뷰 지적). DOM 으로 이 머리 안인지 본다.
    */
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return
    // 마우스는 왼쪽 버튼만 — 우클릭 메뉴는 pointerup 을 빠뜨릴 수 있다
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!shouldStartSheetDrag(event.target as HTMLElement | null)) return

    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, intent: 'pending' }
    dragged.current = false
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = press.current
    if (state === null || state.id !== event.pointerId) return

    const dy = event.clientY - state.y
    if (state.intent === 'pending') {
      state.intent = sheetDragIntent(event.clientX - state.x, dy)
      if (state.intent !== 'sheet') return

      // 끌기로 확정됐다 — 이제부터 손가락이 머리 밖으로 나가도 따라간다
      event.currentTarget.setPointerCapture(event.pointerId)
      dragged.current = true
      setDragging(true)
    }
    if (state.intent !== 'sheet') return

    /*
      **시작점 대비 `clientY` 차다 — `movementY` 누적이 아니다** (#1278). 터치 포인터의 `movementY` 는
      브라우저마다 믿을 수 없고, 누적은 빠진 이벤트만큼 어긋난다. 위로 끌면 음수 → 시트가 커진다.
    */
    setDragOffset(dy)
  }, [])

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = press.current
      if (state === null || state.id !== event.pointerId) return
      press.current = null

      if (state.intent !== 'sheet') return

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setDragging(false)
      onStopChange(nextStop(stop, event.clientY - state.y))
      setDragOffset(0)
    },
    [stop, onStopChange],
  )

  /**
   * 브라우저가 제스처를 가져갔다(`pointercancel`) — **단계를 바꾸지 않고 제자리로 돌린다** (#1278).
   * 예전에는 `onPointerUp` 과 같은 함수라 놓은 것으로 셌는데, 취소 이벤트의 `clientY` 가 0 이라
   * 아래로 끌다 취소되면 시트가 오히려 한 단계 올라갔다(실측).
   */
  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = press.current
    if (state === null || state.id !== event.pointerId) return
    press.current = null
    if (state.intent !== 'sheet') return

    setDragging(false)
    setDragOffset(0)
  }, [])

  /** 시트를 끌었으면 손을 뗄 때 오는 click 을 캡처 단계에서 삼킨다 — 칩이 눌리지 않게 (#1278) */
  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragged.current) return

    dragged.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  /*
    끄는 동안의 오프셋은 두 갈래 모두 같은 방식으로 빼진다 — 위로 끌면 음수라 커진다.
    `maxTopInset` 은 **`max` 에만** 걸린다. `min`·`mid` 는 헤더와 부딪히지 않으므로
    비율 그대로 두는 편이 화면 크기에 잘 따라간다.

    **`mid` 비율이 하한이다.** 인셋은 px 이라 `100dvh - inset` 은 뷰포트 높이에 선형인데
    `mid` 는 비율이라, 화면이 짧아지면 max 가 mid 아래로 내려간다 — 가로 모드 폰
    (812×375)에서 max = 375 − 240 = **135px**, mid = 45dvh = **169px** 다. 시트는
    `lg:hidden` 이라 폭 812 에서도 뜨므로 실제로 `목록 더 보기` 를 누르면 시트가 오히려
    줄어드는 뒤집힘이 난다(그래버 + 필터 툴바 + 개수 줄이 대략 120px 이라 목록 영역이
    사실상 0 이 된다). 비율끼리인 기존 경로는 `0.2 < 0.45 < 0.85` 로 단조성이 구조적으로
    보장됐지만 이 갈래는 보장하지 않으므로 CSS `max()` 로 클램프한다.
  */
  const base =
    stop === 'max' && maxTopInset > 0
      ? `max(${String(STOP_RATIO.mid * 100)}dvh, 100dvh - ${String(maxTopInset)}px)`
      : `${String(STOP_RATIO[stop] * 100)}dvh`

  /*
    **탭바 몫을 높이에서 뺀다 — `min` 만 빼지 않는다** (#883).

    시트 바닥은 이제 어느 단계에서도 `--tabbar-h` 위다(`.map-sheet-clears-tabbar`). 바닥만
    올리고 높이를 그대로 두면 **윗변이 탭바 높이만큼 함께 올라간다** — 812 기기의 `max` 는
    y=122 에서 y=58 로 올라가 `/places` 의 상단 컨트롤(`absolute top-5`, 아래 `maxTopInset`
    주석의 "2px 차로 비껴간다")을 덮는다. 빼 두면 **윗변이 지금 자리 그대로**이고 돌려주는
    것은 바닥 64px 뿐이다.

    `min` 은 예외가 아니라 **이미 탭바 위에 있었다** — 그 단계만 옛 규칙에서도 바닥이
    `--tabbar-h` 였다. 여기서 또 빼면 최소 단계 본문이 98px 로 줄어, 이 이슈가 늘리려는
    바로 그 높이를 깎는다.

    `--map-sheet-tabbar` 는 `.map-sheet-clears-tabbar` 가 주는 값이다 — 탭바가 없는
    768 이상에서 `0px` 이 되어야 하는데, 그 분기는 CSS 미디어 쿼리가 갖는다.
  */
  const clearsTabbar = stop === 'min' ? '' : ' - var(--map-sheet-tabbar, 0px)'
  const height = `calc(${base} - ${String(Math.round(dragOffset))}px${clearsTabbar})`

  return (
    <section
      aria-label={label}
      style={{ height }}
      className={cn(
        // **`z-30` 이다 — 탭바(`z-40`) 아래다** (#883). 예전에는 `z-50`(오버레이 층)이었고
        // 그 근거가 "시트가 탭바 위에 선다" 하나였는데, 그 결정 자체를 되받았다: 탭바는
        // 어느 단계에서도 보이고 시트에 가리지 않는다. 남은 자리는 DESIGN.md z 스케일의
        // "sticky 표면 · 지도 위 플로팅 컨트롤"(`z-30`)이고, 실제로 이 시트가 그것이다 —
        // 배경 덮개도 `aria-modal` 도 포커스 트랩도 없어 `Modal`·`Toast` 와 같은 층에
        // 있을 이유가 애초에 없었다. 층을 내려도 겹칠 것이 없다: 바닥이 늘 탭바 위라
        // 탭바와 면이 만나지 않고, 헤더(`z-40`)는 시트 윗변보다 위에 있다.
        'bg-bg border-border fixed inset-x-0 z-30 flex flex-col rounded-t-xl border-t shadow-lg lg:hidden',
        // 어느 단계에서도 탭바 자리를 비운다 (위 `clearsTabbar` 주석)
        'map-sheet-clears-tabbar',
        // 내용 기반 하한 — 머리 + 목록 한 줄 몫 아래로는 안 줄어든다 (아래 목록 주석, #901 D1)
        'min-h-min',
        // 끄는 동안에는 전환을 끈다 — 손가락을 따라오지 못하고 끈적여 보인다
        !dragging && 'transition-[height] duration-200',
        className,
      )}
    >
      {/*
        **시트 머리 전체가 손잡이다** (#901 D3). 예전에는 그래버 줄(세로 16px)만 드래그를
        받아 *"어딜 잡고 올려야 하는지"* 가 읽히지 않았다 — 조금 아래를 잡으면 목록이
        스크롤됐다. 이제 그래버 · 개수 줄이 드래그를 받고, **컨트롤에서 시작한 제스처와
        필터 줄 전체**는 빠진다(`shouldStartSheetDrag` — 칩 사이 틈을 잡아 끌리던 사고, 2026-10-07).

        **`touch-pan-x` 다.** `touch-none` 으로 덮으면 필터 레일의 가로 스크롤이 죽는다 —
        가로는 브라우저에 넘기고 세로만 이 핸들러가 받는다. 그래버 줄만 `touch-none` 이라
        거기서는 가로로 끌어도 단계가 움직인다.

        **목록은 여전히 받지 않는다.** 그쪽이 드래그를 먹으면 스크롤이 죽는다.
      */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
        /*
          `select-none` — 끄는 동안 칩 글자가 선택됐다 (#1278).

          **`map-sheet-head` 가 안쪽 요소까지 `touch-pan-x` 로 맞춘다** (globals.css, #1278). `touch-action`
          은 가장 가까운 스크롤 컨테이너에서 끊긴다 — 칩 줄은 가로 스크롤 영역이라 이 머리의 `touch-pan-x`
          가 거기까지 닿지 않았고, 칩 위에서 아래로 끌면 브라우저가 세로 제스처를 가져가
          `pointercancel` 이 났다(실측). 실기기에서 "잘 안 잡힌다" 의 원인이다.
        */
        className="map-sheet-head cursor-grab touch-pan-x select-none active:cursor-grabbing"
      >
        {/*
          그래버 — 보이는 손잡이. **막대 밑에 12px 여유를 둔다**(24px 띠, 사용자 지적 2026-10-07) — `pt-2 pb-1`
          이던 때는 막대 바로 밑 4px 에 칩이 붙어 잡기 어려웠다. 필터 줄이 손잡이에서 빠졌으므로 이 띠와
          개수 줄이 잡는 자리다. **위는 8 그대로다** — 머리가 커질수록 최소 단계 하한(아래 #901 D1)이 올라가
          `mid` 와의 차이가 줄어든다. 12/12 면 360×640 에서 그 차이가 3px 이었다(리뷰 계산).
        */}
        <div className="flex touch-none justify-center pt-2 pb-3">
          <span aria-hidden className="bg-border-strong h-1 w-9 rounded-full" />
        </div>

        {/* 필터 같은 전폭 컨트롤. 최소 단계에서도 남으므로 지도를 보면서 조건을 바꿀 수 있다 */}
        {toolbar !== undefined && (
          // 필터 줄도 손잡이다 — 칩을 잡고 위아래로 끌면 시트가 움직인다 (#1278, `sheetDragIntent`)
          <div className="px-3 pb-2">{toolbar}</div>
        )}

        {/**
         * 드래그를 못 쓰는 입력(키보드·스위치)을 위한 단계 이동. 아이콘 없이 글자로 둔다 —
         * 드래그 힌트를 흉내 낸 버튼은 무엇을 하는지 읽히지 않는다.
         *
         * **한 단계씩이 아니라 양 끝을 왕복한다 — 의도다** (#901 D4). 드래그는 `nextStop`
         * 이 한 번에 한 단계만 움직이는데 이 버튼은 `max ↔ min` 을 건넌다. 두 규칙이 다른
         * 이유는 **하는 일이 다르기 때문**이다: 드래그는 연속 동작이라 지나친 만큼 되돌릴
         * 수 있지만, 버튼은 그 연속 동작을 **못 쓰는 입력**의 유일한 길이다. 한 단계씩으로
         * 바꾸면 `min`(지도를 보는 단계)에 **키보드로 갈 방법이 사라진다** — 버튼 하나로
         * 세 단계를 왕복시키려면 라벨이 무엇을 할지 말하지 못한다.
         */}
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={() => onStopChange(stop === 'max' ? 'min' : 'max')}
            className="text-caption text-fg-muted hover:text-fg focus-visible:ring-brand-500 shrink-0 rounded-md px-2 py-2 font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {stop === 'max' ? messages.map.collapseSheet : messages.map.expandSheet}
          </button>
        </div>
      </div>

      {/*
        **최소 단계에도 목록이 한 줄은 보인다 — 시트의 계약이다** (#901 D1).

        단계 높이는 **비율**(`STOP_RATIO`)인데 머리는 **고정 px** 라, 기기가 짧을수록 목록이
        사라졌다. 360×640 실측으로 `/places` 는 머리가 160 인데 `min` 이 20dvh = 128 이라
        **목록 0행**이었다(개수 줄까지 잘렸다). 칩을 한 줄 레일로 합치는 안은 #883 이 유형
        9종 때문에 보류한 판단이라 되받지 않고, 시트 쪽에 하한을 건다. (그래버 막대 밑 여백을 4 → 12 로
        넓힌 2026-10-07 뒤로 머리는 약 8px 더 크다 — 그래서 그래버 위 여백은 늘리지 않았다)

         - 시트가 `min-h-min` — 제 min-content 아래로 줄지 않는다. 비율 높이는 그대로 두고
           그보다 작아질 때만 이 하한이 이긴다. **JS 로 머리를 재지 않으므로 SSR 마크업과
           첫 화면이 같다**(로드 뒤 한 번 튀는 일이 없다)
         - 목록이 그 min-content 에 **`min-h-12`(48px)만** 보탠다 — 첫 행의 배지 줄과 제목
           첫머리가 보여 "여기 목록이 있다" 가 읽히는 높이다. 한 행을 통째로(`/places` 카드
           125px) 요구하면 640 에서 `min` 이 `mid`(224)를 넘어 단계가 뒤집힌다
         - **`contain-size` 가 목록의 내용 높이를 min-content 에서 뺀다.** 없으면 스크롤
           컨테이너의 내용(목록 전체)을 min-content 로 치는 엔진에서 시트가 목록 길이만큼
           커진다. Chrome 은 없어도 48 로 셌지만 엔진 해석에 기대지 않는다

        하한은 **세 단계 모두**에 걸린다 — 가로 모드처럼 아주 짧은 화면에서 `mid` 까지 머리보다
        작아지면 단계끼리 같은 높이로 붙을 뿐 뒤집히지는 않는다.
      */}
      <div className="min-h-12 flex-1 overflow-y-auto overscroll-contain contain-size">
        {children}
      </div>
    </section>
  )
}

/**
 * 끈 거리로 다음 단계를 고른다.
 *
 * **한 번에 한 단계씩만 움직인다.** 최소에서 크게 끌었다고 최대로 보내면 목록이
 * 갑자기 화면을 덮어 지도를 잃는다 — 카카오맵도 한 단계씩 붙는다.
 */
export function nextStop(current: SheetStop, dragOffset: number): SheetStop {
  if (Math.abs(dragOffset) < DRAG_THRESHOLD_PX) return current

  const index = SHEET_STOPS.indexOf(current)
  // 위로 끌면 음수다 → 한 단계 올린다
  const next = dragOffset < 0 ? index + 1 : index - 1

  return SHEET_STOPS[Math.min(SHEET_STOPS.length - 1, Math.max(0, next))] ?? current
}
