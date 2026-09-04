'use client'

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'

import { PhotoViewer, type ViewerImage } from '@/features/place/photo-viewer'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { placeIllustration } from '@/lib/place/illustration'
import type { PlaceImage } from '@/types/place'

/**
 * PhotoGallery — 장소 상세 상단 (디자인 가이드 §5).
 *
 * **사진은 여기서만 말한다.** 상단 갤러리가 있으면 본문 아래 "사진" 섹션을 두지 않는다
 * — 같은 자료를 두 번 크롭해 보여주게 된다.
 *
 * **전폭 히어로를 쓰지 않는다.** TourAPI 이미지는 해상도가 고르지 않아(가로 500–800px
 * 가 흔함) 1040·390 전폭으로 늘리면 업스케일이 드러난다. 표시 폭 상한은
 * 590(데스크톱) / 342(모바일)이고 **높이는 항상 고정**이다.
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
}: {
  images: PlaceImage[]
  title: string
  contentTypeCode?: string | null
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

    return <IllustrationTile src={illustration} />
  }

  const viewerImages: ViewerImage[] = usable.map((image) => ({
    src: image.src,
    imgName: image.imgName,
  }))

  return (
    <div className="flex flex-col gap-2">
      <MobileCarousel images={usable} title={title} onOpen={setViewerIndex} />
      <DesktopStrip images={usable} title={title} onOpen={setViewerIndex} />

      {/* 사진 출처는 갤러리 바로 아래. 정보 출처는 본문 끝 — 각각 자기 자료 옆에서 읽힌다 */}
      <p className="text-caption text-fg-muted px-4 md:px-10">{messages.place.photoSource}</p>

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
function IllustrationTile({ src }: { src: string }) {
  return (
    <>
      <div className="px-4 md:hidden">
        <div
          className="bg-band relative overflow-hidden rounded-md"
          style={{ height: 'var(--gallery-h-mobile)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        </div>
      </div>

      <div className="hidden px-4 md:block md:px-10">
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
 * 마우스·펜으로 가로 스크롤 컨테이너를 **잡아 끌게** 한다.
 *
 * **터치에는 걸지 않는다.** 손가락 스크롤은 브라우저가 이미 관성·고무줄까지 붙여 처리하고,
 * 거기에 `scrollLeft` 를 직접 쓰면 두 힘이 겹쳐 끊긴다. `pointerType` 으로 갈라 터치는
 * 네이티브에 맡긴다 — 그래서 이 훅은 **실제 휴대폰의 동작을 바꾸지 않는다.**
 *
 * 그 대신 좁은 폭을 마우스로 보는 경우(반응형 확인·터치 없는 노트북)를 연다. 지금까지는
 * 가로 휠 제스처를 아는 사람만 넘길 수 있었다.
 *
 * **끌고 난 직후의 클릭을 삼킨다.** 타일이 뷰어를 여는 버튼이라, 그러지 않으면 사진을
 * 넘기려고 끌 때마다 뷰어가 열린다. 임계값(`DRAG_SLOP_PX`) 아래로 움직였으면 누른 것으로
 * 보고 통과시킨다 — 손이 조금 흔들렸다고 클릭이 사라지면 안 된다.
 */
const DRAG_SLOP_PX = 6

function useDragScroll(trackRef: React.RefObject<HTMLElement | null>) {
  /** 끄는 중인 포인터. 없으면 null */
  const drag = useRef<{ startX: number; startScrollLeft: number } | null>(null)
  /** 직전 포인터 동작이 "끌기" 였나 — 뒤따르는 click 을 삼킬지 정한다 */
  const dragged = useRef(false)
  const [grabbing, setGrabbing] = useState(false)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // 터치는 네이티브 스크롤에 맡긴다
      if (event.pointerType === 'touch') return

      const track = trackRef.current
      if (track === null) return

      drag.current = { startX: event.clientX, startScrollLeft: track.scrollLeft }
      dragged.current = false
      setGrabbing(true)
      // 포인터가 컨테이너 밖으로 나가도 계속 추적한다
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [trackRef],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = drag.current
      const track = trackRef.current
      if (state === null || track === null) return

      const moved = event.clientX - state.startX
      if (Math.abs(moved) > DRAG_SLOP_PX) dragged.current = true

      /*
        `scroll-snap-type` 을 끄고 끈다. 켜 둔 채 `scrollLeft` 를 쓰면 브라우저가 매
        프레임 스냅 지점으로 되돌려 손을 따라오지 않는다. 손을 떼면 되돌리고, 그때
        브라우저가 가장 가까운 사진으로 붙인다 — 터치와 같은 마무리다.
      */
      track.style.scrollSnapType = 'none'
      track.scrollLeft = state.startScrollLeft - moved
    },
    [trackRef],
  )

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (drag.current === null) return

      drag.current = null
      setGrabbing(false)

      const track = trackRef.current
      if (track !== null) track.style.scrollSnapType = ''

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [trackRef],
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
}: {
  images: GalleryImage[]
  title: string
  onOpen: (index: number) => void
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const { grabbing, handlers } = useDragScroll(trackRef)

  const syncIndex = useCallback(() => {
    const track = trackRef.current
    if (track === null) return

    const item = track.firstElementChild as HTMLElement | null
    if (item === null) return

    // 항목 폭 + gap 으로 나눈다. scrollLeft 를 항목 수로 나누면 마지막에서 어긋난다.
    const step = item.clientWidth + 8
    setIndex(Math.min(images.length - 1, Math.round(track.scrollLeft / step)))
  }, [images.length])

  useEffect(() => {
    const track = trackRef.current
    if (track === null) return

    track.addEventListener('scroll', syncIndex, { passive: true })
    return () => track.removeEventListener('scroll', syncIndex)
  }, [syncIndex])

  return (
    <div className="relative md:hidden">
      <ul
        ref={trackRef}
        {...handlers}
        /*
          `touch-pan-x` 로 세로 스크롤은 페이지에 넘긴다 — 갤러리 위에서 손가락을 위로
          쓸었을 때 페이지가 안 움직이면 캐러셀에 갇힌다.

          커서는 **잡을 수 있다는 유일한 신호**다. 스크롤바는 `scrollbar-none` 으로 숨겼고
          모바일 폭이라 화살표를 둘 자리도 없다.
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
            <GalleryTileButton position={position} onOpen={onOpen}>
              <Image
                src={image.src}
                // 대표 이미지는 장식이 아니라 콘텐츠다 — 장소명을 alt 로 준다
                alt={position === 0 ? title : (image.imgName ?? '')}
                fill
                sizes="342px"
                priority={position === 0}
                className="object-cover"
                // 끌 때 브라우저 기본 이미지 드래그(고스트)가 스크롤을 가로챈다
                draggable={false}
              />
            </GalleryTileButton>
          </li>
        ))}
      </ul>

      {/* 점 인디케이터가 아니라 카운터다 — 8장까지 가면 점은 읽히지 않는다 */}
      {images.length > 1 && (
        <span className="bg-fg text-fg-inverse text-caption pointer-events-none absolute right-6 bottom-2 rounded-sm px-2 py-1 font-medium tabular-nums">
          {index + 1}/{images.length}
        </span>
      )}
    </div>
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
    <div className="hidden px-4 md:block md:px-10">
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
            <Image
              src={lead.src}
              alt={title}
              fill
              sizes="590px"
              priority
              className="object-cover"
            />
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
  children,
}: {
  /** 0-based. 라벨에는 1부터 센 번호를 쓴다 */
  position: number
  onOpen: (index: number) => void
  label?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(position)}
      aria-label={
        label ?? messages.place.galleryOpenAction.replace('{index}', String(position + 1))
      }
      className="focus-visible:ring-brand-500 absolute inset-0 cursor-zoom-in focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
    >
      {children}
    </button>
  )
}
