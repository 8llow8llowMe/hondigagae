'use client'

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { PhotoViewer, type ViewerImage } from '@/features/place/photo-viewer'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { placeIllustration } from '@/lib/place/illustration'
import { INSET_CLASS } from '@/lib/ui/inset'
import { swipeTarget } from '@/lib/ui/scroll'
import { cn } from '@/lib/utils/cn'
import type { PlaceImage } from '@/types/place'

/**
 * PhotoGallery — 장소 상세 상단 (디자인 가이드 §5).
 *
 * **사진은 여기서만 말한다.** 상단 갤러리가 있으면 본문 아래 "사진" 섹션을 두지 않는다
 * — 같은 자료를 두 번 크롭해 보여주게 된다.
 *
 * **전폭 히어로를 쓰지 않는다.** TourAPI 이미지는 **가로 940px 가 대부분이라**(dev 실측
 * 2026-09-07 · 200장 중 189장, 최대 1080px) 1040·390 전폭으로 늘리면 업스케일이 드러난다.
 * 표시 폭 상한은 590(데스크톱) / 342(모바일)이고 **높이는 항상 고정**이다.
 *
 * 장수별로 배치가 다르다:
 * - **0장 → 카테고리 일러스트 한 장.** 자산이 없는 카테고리면 섹션을 렌더하지 않는다
 *   (아래 `IllustrationTile` 주석)
 * - 1장 → 전폭으로 늘리지 않고 660px 에서 멈춘다
 * - 2장 → 균등 2분할
 * - 3장 이상 → 대표 + 썸네일 2 + `+N`
 *
 * 모바일은 `scroll-snap` + 옆 사진 물림으로 넘길 수 있음을 알리고, 점 인디케이터 대신
 * **`1/8` 카운터**를 쓴다 — 장수가 8장까지 가면 점은 읽히지 않는다.
 *
 * **모든 타일이 뷰어를 여는 버튼이다** (`PhotoViewer`). 데스크톱은 대표 1 + 썸네일 2 만
 * 그리므로 `+N` 뒤의 사진들은 뷰어 말고는 화면에 도달할 경로가 없다.
 */
/** `next/image` 에 넘길 src 가 확정된 사진. 판정은 `PhotoGallery` 가 한 번만 한다 */
type GalleryImage = PlaceImage & { src: string }

export function PhotoGallery({
  images,
  title,
  /**
   * 사진이 한 장도 없을 때 고를 일러스트의 근거 (`lib/place/illustration.ts`).
   * `contentType.code` 다 — **한국어 `name` 으로 고르지 않는다.**
   */
  contentTypeCode = null,
  layout = 'responsive',
}: {
  images: PlaceImage[]
  title: string
  contentTypeCode?: string | null
  /**
   * `responsive`(기본) = 상세 — 모바일 캐러셀 · 데스크톱 모자이크가 **뷰포트 폭**으로 갈린다.
   * `carousel` = 지도 미리보기(#1230) — 폭과 상관없이 캐러셀만. 미리보기는 데스크톱에서도
   * 400 폭 패널이라, 뷰포트로 가르면 그 좁은 칸에 모자이크가 선다.
   */
  layout?: 'responsive' | 'carousel'
}) {
  // `next/image` 에 넘길 수 있는 것만 남긴다 (허용 호스트 + https 승격)
  const usable = images
    .map((image) => ({ ...image, src: imageSrc(image.originImgUrl) }))
    .filter((image): image is GalleryImage => image.src !== null)

  /** 뷰어가 보고 있는 사진의 위치. 닫혀 있으면 null */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const closeViewer = useCallback(() => setViewerIndex(null), [])

  /*
    사진이 없으면 카테고리 일러스트로 자리를 채운다.

    **예전에는 섹션 자체를 렌더하지 않았다.** 그 규칙의 근거는 "회색 `이미지 없음` 면이
    첫 화면을 덮는다" 였는데, 그것은 **회색 벽**의 문제였지 자리의 문제가 아니었다.
    #241 로 카테고리 일러스트가 들어와 그 벽이 사라졌으므로 자리를 되살린다 —
    갤러리가 통째로 빠지면 상세가 제목부터 시작해 목록·홈과 리듬이 어긋난다.

    **자산이 없는 카테고리는 여전히 렌더하지 않는다.** 회색 타일로 떨어뜨리면 없애려던
    바로 그 벽이 돌아온다 (DESIGN.md §7-3).
  */
  if (usable.length === 0) {
    const illustration = placeIllustration(contentTypeCode)
    if (illustration === null) return null

    return <IllustrationTile src={illustration} layout={layout} />
  }

  const viewerImages: ViewerImage[] = usable.map((image) => ({
    src: image.src,
    imgName: image.imgName,
  }))

  return (
    <div className="flex flex-col gap-2">
      <MobileCarousel
        images={usable}
        title={title}
        onOpen={setViewerIndex}
        always={layout === 'carousel'}
      />
      {layout === 'responsive' && (
        <DesktopStrip images={usable} title={title} onOpen={setViewerIndex} />
      )}

      {/*
        사진 출처는 갤러리 바로 아래. 정보 출처는 본문 끝 — 각각 자기 자료 옆에서 읽힌다.
        미리보기(`carousel`)는 사진 위 좌하단에 얹는다 — `MobileCarousel` (#1233 D3).
        인셋은 제목 줄과 같은 카드 값이다 — 갤러리는 L0 위의 전폭 미디어라 카드 가장자리에
        맞추고(`SurfaceStack` 의 24), 글줄은 카드 안 글줄과 같은 축에 선다 (#443).
      */}
      {layout === 'responsive' && (
        <p className={cn('text-caption text-fg-muted', INSET_CLASS.card)}>
          {messages.place.photoSource}
        </p>
      )}

      <PhotoViewer
        images={viewerImages}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={closeViewer}
        title={title}
      />
    </div>
  )
}

/**
 * 사진이 없는 장소의 자리 — 카테고리 일러스트 (`lib/place/illustration.ts`).
 *
 * **사진 출처 줄을 붙이지 않는다.** 이 그림은 한국관광공사가 준 사진이 아니라 우리가 그린
 * 도형이라, 출처를 달면 없는 사진의 출처를 표기하게 된다.
 *
 * **뷰어를 열지 않는다.** 확대해 봐야 같은 도형이고, 누를 수 있게 두면 "사진이 더 있다"
 * 로 읽힌다.
 *
 * **`next/image` 가 아니라 `<img>` 다** — 저장소 안의 정적 SVG 라 최적화할 것이 없고
 * (`unoptimized: true`), 원격 호스트 허용 목록과도 무관하다. `PlaceRow` 와 같은 판단이다.
 * **장식이므로 `alt=""`** — 카테고리는 바로 아래 메타 줄이 낱말로 말한다.
 */
function IllustrationTile({ src, layout }: { src: string; layout: 'responsive' | 'carousel' }) {
  return (
    <>
      <div className={cn('px-4', layout === 'responsive' && 'md:hidden')}>
        <div
          className="bg-band relative overflow-hidden rounded-md"
          style={{ height: 'var(--gallery-h-mobile)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        </div>
      </div>

      <div className={layout === 'responsive' ? 'hidden md:block' : 'hidden'}>
        <div
          className="bg-band relative overflow-hidden rounded-md"
          style={{
            height: 'var(--gallery-h-desktop)',
            // 사진 1장과 같은 상한에서 멈춘다 — 전폭으로 늘리면 도형이 뭉개진다
            maxWidth: 'var(--gallery-w-single-max)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        </div>
      </div>
    </>
  )
}

/**
 * 마우스·펜으로 가로 스크롤 컨테이너를 **잡아 끌게** 하고, 놓으면 **고른 칸으로 부드럽게** 보낸다.
 *
 * **터치에는 걸지 않는다.** 손가락 스크롤은 브라우저가 이미 관성·고무줄까지 붙여 처리하고,
 * 거기에 `scrollLeft` 를 직접 쓰면 두 힘이 겹쳐 끊긴다. `pointerType` 으로 갈라 터치는
 * 네이티브에 맡긴다 — 그래서 이 훅은 **실제 휴대폰의 동작을 바꾸지 않는다.**
 *
 * 그 대신 좁은 폭을 마우스로 보는 경우(반응형 확인·터치 없는 노트북 · 지도 미리보기 패널)를 연다.
 *
 * **놓을 때 갈 칸을 직접 고른다** (#1233 D3). 예전에는 스냅만 다시 켜서 브라우저가 가장 가까운 칸으로
 * **애니메이션 없이** 붙였다 — 툭 붙고, 30% 를 끌어도 되돌아갔다. 이제 끈 거리 · 속도로 칸을 고르고
 * (`swipeTarget`) 그 칸으로 `smooth` 스크롤한 뒤, **스크롤이 끝나면** 스냅을 다시 켠다. 스냅을 먼저
 * 켜면 브라우저가 애니메이션 도중에 가로채 다시 툭 붙인다.
 *
 * **끌고 난 직후의 클릭을 삼킨다.** 타일이 뷰어를 여는 버튼이라, 그러지 않으면 사진을
 * 넘기려고 끌 때마다 뷰어가 열린다. 임계값(`DRAG_SLOP_PX`) 아래로 움직였으면 누른 것으로
 * 보고 통과시킨다 — 손이 조금 흔들렸다고 클릭이 사라지면 안 된다.
 */
const DRAG_SLOP_PX = 6
/** 놓기 직전 속도를 재는 구간 — 그보다 오래된 움직임은 "튕김" 이 아니다 */
const VELOCITY_WINDOW_MS = 80
/** `scrollend` 가 없는 브라우저에서 스냅을 다시 켤 때까지 기다리는 시간 */
const SETTLE_FALLBACK_MS = 450
/** 사진 사이 간격 — `ul` 의 `gap-2` 와 같다 */
const ITEM_GAP_PX = 8

function useCarouselScroll(trackRef: React.RefObject<HTMLElement | null>, count: number) {
  /** 끄는 중인 포인터. 없으면 null */
  const drag = useRef<{
    startX: number
    startScrollLeft: number
    startIndex: number
    /** 최근 포인터 위치 — 놓기 직전 속도를 잰다 */
    samples: { x: number; t: number }[]
  } | null>(null)
  /** 직전 포인터 동작이 "끌기" 였나 — 뒤따르는 click 을 삼킬지 정한다 */
  const dragged = useRef(false)
  /** 진행 중인 부드러운 스크롤의 마무리(스냅 복구)를 걷는다. 새로 누르면 먼저 부른다 */
  const cancelSettle = useRef<(() => void) | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  useEffect(() => () => cancelSettle.current?.(), [])

  /** 칸 하나의 폭 + 간격. 칸이 없으면 0 */
  const step = useCallback(() => {
    const item = trackRef.current?.firstElementChild as HTMLElement | null | undefined
    return item == null ? 0 : item.clientWidth + ITEM_GAP_PX
  }, [trackRef])

  /**
   * `target` 칸으로 보낸다. 좌표는 **그 칸의 스냅 자리**다 — 칸의 왼쪽 끝을 스크롤 영역 왼쪽에
   * 맞춘 값(`snap-start`)이라, 끝나고 스냅을 다시 켜도 움직이지 않는다.
   */
  const goTo = useCallback(
    (target: number) => {
      const track = trackRef.current
      const item = track?.children[target] as HTMLElement | undefined
      if (track == null || item === undefined) return

      cancelSettle.current?.()

      const max = track.scrollWidth - track.clientWidth
      const left = Math.min(
        max,
        Math.max(
          0,
          track.scrollLeft +
            item.getBoundingClientRect().left -
            track.getBoundingClientRect().left -
            (Number.parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0),
        ),
      )

      const restore = () => {
        cancelSettle.current = null
        track.style.scrollSnapType = ''
      }

      // 이미 그 자리다 — 스크롤이 일어나지 않아 `scrollend` 도 오지 않는다
      if (Math.abs(track.scrollLeft - left) < 1) {
        restore()
        return
      }

      /*
        **`smooth` 를 JS 가 정하므로 `prefers-reduced-motion` 을 직접 본다.** 전역 CSS 규칙은
        `scroll-behavior` 속성만 덮고, `scrollTo` 의 `behavior: 'smooth'` 는 못 덮는다.
      */
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // 애니메이션 동안 스냅이 가로채지 않게 끈다
      track.style.scrollSnapType = 'none'
      track.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' })

      if (reduce) {
        restore()
      } else if ('onscrollend' in track) {
        track.addEventListener('scrollend', restore, { once: true })
        cancelSettle.current = () => track.removeEventListener('scrollend', restore)
      } else {
        const timer = window.setTimeout(restore, SETTLE_FALLBACK_MS)
        cancelSettle.current = () => window.clearTimeout(timer)
      }
    },
    [trackRef],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // 터치는 네이티브 스크롤에 맡긴다. 왼쪽 버튼만 끈다 — 우클릭 메뉴는 pointerup 을 빠뜨릴 수 있다
      if (event.pointerType === 'touch' || event.button !== 0) return

      const track = trackRef.current
      if (track === null) return

      // 넘어가던 중에 다시 잡았다 — 끝나고 스냅을 켜는 예약이 끄는 도중에 터지지 않게 걷는다
      cancelSettle.current?.()
      cancelSettle.current = null

      const width = step()
      drag.current = {
        startX: event.clientX,
        startScrollLeft: track.scrollLeft,
        startIndex: width > 0 ? Math.round(track.scrollLeft / width) : 0,
        samples: [{ x: event.clientX, t: event.timeStamp }],
      }
      dragged.current = false
      setGrabbing(true)
      // 포인터가 컨테이너 밖으로 나가도 계속 추적한다
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [trackRef, step],
  )

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = drag.current
      if (state === null) return

      drag.current = null
      setGrabbing(false)

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      // 누르기만 했다 — 손 떨림만큼 밀린 것은 원래 칸으로 돌린다
      if (!dragged.current) {
        goTo(state.startIndex)
        return
      }

      const first = state.samples[0]
      const elapsed = first === undefined ? 0 : event.timeStamp - first.t
      // 부호를 스크롤 방향으로 뒤집는다 — 포인터가 왼쪽으로 가면 다음 칸이다
      const velocity = first === undefined || elapsed <= 0 ? 0 : (first.x - event.clientX) / elapsed

      goTo(
        swipeTarget({
          dragPx: state.startX - event.clientX,
          velocity,
          step: step(),
          index: state.startIndex,
          count,
        }),
      )
    },
    [goTo, step, count],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = drag.current
      const track = trackRef.current
      if (state === null || track === null) return
      // 버튼이 이미 떨어졌다(pointerup 이 빠졌다) — 손을 뗀 것으로 마무리한다. 아니면 스냅이 꺼진 채 남는다
      if (event.buttons === 0) {
        endDrag(event)
        return
      }

      const moved = event.clientX - state.startX
      if (Math.abs(moved) > DRAG_SLOP_PX) dragged.current = true

      state.samples.push({ x: event.clientX, t: event.timeStamp })
      // 속도 구간보다 오래된 것은 버린다 — 하나는 남겨 구간의 시작점으로 쓴다
      while (
        state.samples.length > 2 &&
        event.timeStamp - (state.samples[1]?.t ?? event.timeStamp) > VELOCITY_WINDOW_MS
      ) {
        state.samples.shift()
      }

      /*
        `scroll-snap-type` 을 끄고 끈다. 켜 둔 채 `scrollLeft` 를 쓰면 브라우저가 매
        프레임 스냅 지점으로 되돌려 손을 따라오지 않는다.
      */
      track.style.scrollSnapType = 'none'
      track.scrollLeft = state.startScrollLeft - moved
    },
    [trackRef, endDrag],
  )

  /** 끌기였으면 뒤따르는 click 을 캡처 단계에서 삼킨다 (타일 버튼에 닿기 전이다) */
  const onClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!dragged.current) return

    dragged.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return {
    grabbing,
    goTo,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  }
}

function MobileCarousel({
  images,
  title,
  onOpen,
  always,
}: {
  images: GalleryImage[]
  title: string
  onOpen: (index: number) => void
  /**
   * 폭과 상관없이 선다 (`layout="carousel"` — 지도 미리보기). 아니면 `md` 부터 모자이크에 자리를
   * 내준다. 미리보기는 사진 출처도 사진 위에 얹는다(#1233 D3) — 상세는 갤러리 아래 줄 그대로다.
   */
  always: boolean
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  /*
    **지금까지 닿은 가장 먼 장** — 사진(`<img>`)을 그 다음 장까지만 만든다 (#1132).

    상세 첫 화면에 갤러리 원본 8장(약 4MB)이 다 내려왔다 (2026-10-03 Lighthouse 모바일).
    가려진 장은 `loading="lazy"` 였는데도 그랬다 — 크롬이 스크롤 컨테이너 안의 지연
    이미지를 여유 거리(수천 px) 안이면 미리 받는 것으로 보이고, 342px 여덟 장은 그 안이다.
    그래서 브라우저 판단에 맡기지 않고 **닿지 않은 장은 `<img>` 를 만들지 않는다.**

    **`+1` 은 옆에 물린 장이다.** 첫 화면에서도 둘째 장 왼쪽이 보이므로("넘길 수 있다" 는
    신호) 그 장은 처음부터 있어야 하고, 넘길 때마다 다음에 물릴 장이 하나씩 생긴다.
    뒤로 돌아가도 걷지 않는다 — 이미 받은 사진을 다시 지우면 깜빡이기만 한다.

    **자리·버튼은 그대로 둔다.** `li` 크기가 고정이라 사진이 늦게 붙어도 밀리지 않고,
    뷰어를 여는 버튼과 그 이름(`{n}번째 사진 크게 보기`)은 사진 유무와 상관없다.
  */
  const [reach, setReach] = useState(0)
  const { grabbing, goTo, handlers } = useCarouselScroll(trackRef, images.length)

  const syncIndex = useCallback(() => {
    const track = trackRef.current
    if (track === null) return

    const item = track.firstElementChild as HTMLElement | null
    if (item === null) return

    // 항목 폭 + gap 으로 나눈다. scrollLeft 를 항목 수로 나누면 마지막에서 어긋난다.
    const step = item.clientWidth + ITEM_GAP_PX
    const next = Math.min(images.length - 1, Math.round(track.scrollLeft / step))
    setIndex(next)
    setReach((previous) => Math.max(previous, next))
  }, [images.length])

  useEffect(() => {
    const track = trackRef.current
    if (track === null) return

    track.addEventListener('scroll', syncIndex, { passive: true })
    return () => track.removeEventListener('scroll', syncIndex)
  }, [syncIndex])

  /*
    **← → 로 한 칸** (#1233 D5) — 사진 타일(`<button>`)에 포커스가 있을 때 듣는다. 포커스는 **넘어간 칸의
    타일로 따라간다** — 화면 밖으로 밀린 타일에 포커스가 남으면 다음 Enter 가 보이지 않는 사진을 연다.
    스크롤은 `goTo` 가 하므로 `preventScroll`. 바깥 `div` 에 걸지 않는 이유: 정적 요소가 키를 다루면
    역할 없는 상호작용이 된다(`jsx-a11y/no-static-element-interactions`).
  */
  function onTileKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, position: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    // Alt+← (뒤로 가기) 같은 브라우저 단축키는 삼키지 않는다
    if (event.altKey || event.metaKey || event.ctrlKey) return

    event.preventDefault()
    const target = position + (event.key === 'ArrowRight' ? 1 : -1)
    if (target < 0 || target >= images.length) return

    goTo(target)
    trackRef.current?.children[target]?.querySelector('button')?.focus({ preventScroll: true })
  }

  /*
    이전/다음 한 칸. **끝 칸에 닿으면 그 버튼은 사라진다**(첫/끝 숨김) — 키보드로 누르던 포커스가 함께
    사라지면 `body` 로 떨어진다(WCAG 2.4.3, 리뷰 지적). 그래서 끝 칸으로 가는 누름이면 포커스를 그 칸의
    사진 타일로 먼저 옮긴다.
  */
  function step(event: React.MouseEvent<HTMLButtonElement>, delta: -1 | 1) {
    const target = index + delta
    const lands = target === 0 || target === images.length - 1
    const focused = document.activeElement === event.currentTarget

    goTo(target)
    if (lands && focused) {
      trackRef.current?.children[target]?.querySelector('button')?.focus({ preventScroll: true })
    }
  }

  return (
    <div
      // `group/gallery` — 이전/다음 버튼이 **이 사진 영역**에 마우스를 올렸을 때만 보인다. 이름을 붙여
      // 패널 · 목록 행의 다른 `group` 에 반응하지 않게 한다
      className={cn('group/gallery relative', !always && 'md:hidden')}
    >
      <ul
        ref={trackRef}
        {...handlers}
        /*
          `touch-pan-x` 로 세로 스크롤은 페이지에 넘긴다 — 갤러리 위에서 손가락을 위로
          쓸었을 때 페이지가 안 움직이면 캐러셀에 갇힌다.

          커서는 **잡을 수 있다는 신호**다. 스크롤바는 `scrollbar-none` 으로 숨겼다.
        */
        className={`flex touch-pan-x snap-x snap-mandatory scrollbar-none gap-2 overflow-x-auto px-4 ${
          grabbing ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {images.map((image, position) => (
          <li
            key={image.originImgUrl ?? position}
            className="bg-band relative shrink-0 snap-start overflow-hidden rounded-md"
            style={{ width: 'var(--gallery-w-mobile)', height: 'var(--gallery-h-mobile)' }}
          >
            <GalleryTileButton
              position={position}
              onOpen={onOpen}
              onKeyDown={(event) => onTileKeyDown(event, position)}
            >
              {position <= reach + 1 && (
                <Image
                  src={image.src}
                  // 대표 이미지는 장식이 아니라 콘텐츠다 — 장소명을 alt 로 준다
                  alt={position === 0 ? title : (image.imgName ?? '')}
                  fill
                  sizes="342px"
                  /*
                    **첫 장만 앞세운다.** 데스크톱 모자이크의 대표도 `preload` 인데 **같은
                    URL** 이다(`unoptimized` 라 원본 그대로) — 보이지 않는 갈래의 대표가
                    따로 받아지지 않는다.
                  */
                  preload={position === 0}
                  className="object-cover"
                  // 끌 때 브라우저 기본 이미지 드래그(고스트)가 스크롤을 가로챈다
                  draggable={false}
                />
              )}
            </GalleryTileButton>
          </li>
        ))}
      </ul>

      {/*
        **이전/다음 버튼 (#1233 D3)** — 끌기 · 가로 휠을 모르는 마우스 사용자의 길이다. **사진 위에 마우스를
        올렸을 때만 서서히(200ms) 나타난다**(사용자 결정 2026-10-07) — 사진을 가리지 않는다. 예외는
        **키보드 포커스**(`:focus-visible`)뿐이다: 안 보이는 버튼에 포커스가 가면 어디 있는지 모른다.
        `focus-within` 을 쓰지 않는다 — 타일을 마우스로 누르면 포커스가 남아 손을 떼도 버튼이 떠 있었다.
        **보이지 않는 동안에는 누를 수 없다**(`pointer-events-none`). 호버가 없는 휴대폰에서는 버튼이 끝까지
        투명한데, 그대로 두면 사진 좌우 가운데 44 자리가 보이지 않는 버튼이 되어 뷰어 열기 · 넘기기를
        가로챈다(리뷰 지적) — 터치는 네이티브 그대로라는 이 캐러셀의 약속이 깨진다. 첫 칸의 이전, 끝 칸의 다음은 **그리지 않는다** —
        눌러도 안 움직이는 버튼은 고장으로 읽힌다. 터치 기기에서는 `hover` 가 없어 안 보인다.
      */}
      {index > 0 && <CarouselStepButton direction="prev" onClick={(event) => step(event, -1)} />}
      {index < images.length - 1 && (
        <CarouselStepButton direction="next" onClick={(event) => step(event, 1)} />
      )}

      {/* 점 인디케이터가 아니라 카운터다 — 8장까지 가면 점은 읽히지 않는다 */}
      {images.length > 1 && (
        <span
          aria-live="polite"
          className="bg-fg text-fg-inverse text-caption pointer-events-none absolute right-6 bottom-2 rounded-sm px-2 py-1 font-medium tabular-nums"
        >
          {index + 1}/{images.length}
        </span>
      )}

      {/*
        미리보기의 사진 출처는 **사진 위 좌하단** (#1233 D3) — 400 폭 패널에서 갤러리 아래 한 줄을
        아낀다. 표기 의무(D5-2)는 문구 그대로 지킨다. 바탕은 `--fg` 70% — 흰 사진 위에서도 글자 대비
        4.5:1 을 넘긴다(카운터와 같은 짝).
      */}
      {always && (
        <span className="bg-fg/70 text-fg-inverse text-caption pointer-events-none absolute bottom-2 left-6 rounded-sm px-2 py-1">
          {messages.place.photoSource}
        </span>
      )}
    </div>
  )
}

/** 사진 위 좌우 세로 중앙의 원형 44 버튼 — `MobileCarousel` 의 `group/gallery` 안에서만 보인다 */
function CarouselStepButton({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next'
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const Icon = direction === 'prev' ? ChevronLeftIcon : ChevronRightIcon

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        direction === 'prev' ? messages.place.galleryPrevAction : messages.place.galleryNextAction
      }
      className={cn(
        'bg-bg/90 text-fg focus-visible:ring-brand-500 pointer-events-none absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full opacity-0 shadow-md transition-opacity duration-200 ease-out group-hover/gallery:pointer-events-auto group-hover/gallery:opacity-100 group-has-[:focus-visible]/gallery:pointer-events-auto group-has-[:focus-visible]/gallery:opacity-100 focus-visible:ring-2 focus-visible:outline-none',
        direction === 'prev' ? 'left-6' : 'right-6',
      )}
    >
      <Icon size={20} />
    </button>
  )
}

/**
 * 데스크톱 모자이크 — 아트보드 `장소 상세` 03. **높이는 300 고정, 폭만 달라진다.**
 *
 * `1.62fr 1fr` 은 대표 사진이 썸네일 열보다 눈에 띄게 크되 썸네일이 알아볼 수 없을 만큼
 * 좁아지지 않는 비율이다. 고정 px(590/362)로 두지 않는 이유는 **우측 열이 가변**이기
 * 때문이다 — 데스크톱 2단에서 우측 폭은 뷰포트에 따라 달라진다.
 */
function DesktopStrip({
  images,
  title,
  onOpen,
}: {
  images: GalleryImage[]
  title: string
  onOpen: (index: number) => void
}) {
  const [lead, ...rest] = images
  if (lead === undefined) return null

  const thumbs = rest.slice(0, 2)
  // 대표 1 + 썸네일 2 를 넘는 나머지 장수. 마지막 썸네일 위에 +N 으로 얹는다
  const overflow = images.length - 1 - thumbs.length
  /** `+N` 이 여는 첫 사진 — 썸네일로 그려진 마지막 장의 다음이다 */
  const firstHidden = 1 + thumbs.length

  return (
    <div className="hidden md:block">
      <div
        className="grid gap-2"
        style={{
          height: 'var(--gallery-h-desktop)',
          // 1장은 전폭으로 늘리지 않고 660 에서 멈춘다 — TourAPI 저해상도가 드러난다
          // 2장은 썸네일 열이 1장뿐이라 세로로 길어진다. 균등 2분할이 낫다
          gridTemplateColumns:
            images.length === 1
              ? 'minmax(0, var(--gallery-w-single-max))'
              : images.length === 2
                ? '1fr 1fr'
                : '1.62fr 1fr',
        }}
      >
        <div className="bg-band relative overflow-hidden rounded-md">
          <GalleryTileButton position={0} onOpen={onOpen}>
            <Image src={lead.src} alt={title} fill sizes="590px" preload className="object-cover" />
          </GalleryTileButton>
        </div>

        {/* 2장이면 썸네일 열을 만들지 않는다 — 같은 크기로 나란히 둔다 */}
        {images.length === 2 && rest[0] !== undefined && (
          <div className="bg-band relative overflow-hidden rounded-md">
            <GalleryTileButton position={1} onOpen={onOpen}>
              <Image
                src={rest[0].src}
                alt={rest[0].imgName ?? ''}
                fill
                sizes="590px"
                className="object-cover"
              />
            </GalleryTileButton>
          </div>
        )}

        {images.length >= 3 && (
          <ul className="grid gap-2" style={{ gridTemplateRows: '1fr 1fr' }}>
            {thumbs.map((image, position) => {
              // 마지막 썸네일 위에 +N 을 얹는다. 그 타일은 **나머지를 여는 버튼**이 된다
              const showsOverflow = overflow > 0 && position === thumbs.length - 1

              return (
                <li
                  key={image.originImgUrl ?? position}
                  className="bg-band relative overflow-hidden rounded-md"
                >
                  <GalleryTileButton
                    /*
                      `+N` 타일은 **가려진 첫 사진**을 연다. 얹힌 썸네일(2번째)을 열면
                      "나머지 N장 보기" 를 눌렀는데 이미 보고 있던 사진이 뜬다.
                    */
                    position={showsOverflow ? firstHidden : position + 1}
                    onOpen={onOpen}
                    {...(showsOverflow
                      ? {
                          label: messages.place.galleryOpenMoreAction.replace(
                            '{count}',
                            String(overflow),
                          ),
                        }
                      : {})}
                  >
                    <Image
                      src={image.src}
                      alt={image.imgName ?? ''}
                      fill
                      sizes="362px"
                      className="object-cover"
                    />
                    {showsOverflow && (
                      <span
                        aria-hidden
                        className="bg-fg/60 text-fg-inverse text-title-2 absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
                      >
                        +{overflow}
                      </span>
                    )}
                  </GalleryTileButton>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * 타일을 뷰어 여는 버튼으로 감싼다.
 *
 * **`<button>` 이지 `<div onClick>` 이 아니다** — 키보드 포커스·Enter/Space·역할이 전부
 * 공짜로 따라온다. 사진은 `fill` 이라 부모가 `absolute inset-0` 이어야 크기가 유지된다.
 *
 * 이름은 `aria-label` 에만 있다 (사진 안에는 글자가 없다). `label` 을 주지 않으면
 * `{index}번째 사진 크게 보기` 다 — `+N` 타일만 자기 문구를 준다.
 */
function GalleryTileButton({
  position,
  onOpen,
  label,
  onKeyDown,
  children,
}: {
  /** 0-based. 라벨에는 1부터 센 번호를 쓴다 */
  position: number
  onOpen: (index: number) => void
  label?: string
  /** 캐러셀의 ← → (#1233). 모자이크는 넘길 것이 없어 주지 않는다 */
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(position)}
      onKeyDown={onKeyDown}
      aria-label={
        label ?? messages.place.galleryOpenAction.replace('{index}', String(position + 1))
      }
      className="focus-visible:ring-brand-500 absolute inset-0 cursor-zoom-in focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
    >
      {children}
    </button>
  )
}
