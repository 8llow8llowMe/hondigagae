'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
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
 * - **0장 → 섹션을 렌더하지 않는다.** 제목부터 시작한다 — 회색 "이미지 없음" 면이
 *   첫 화면을 덮지 않는다. (목록 썸네일은 반대다. 거기서는 행 높이를 지켜야 하므로
 *   같은 크기의 타일을 남긴다 — `PlaceRow`.)
 * - 1장 → 전폭으로 늘리지 않고 660px 에서 멈춘다
 * - 2장 → 균등 2분할
 * - 3장 이상 → 대표 + 썸네일 2 + `+N`
 *
 * 모바일은 `scroll-snap` + 옆 사진 물림으로 넘길 수 있음을 알리고, 점 인디케이터 대신
 * **`1/8` 카운터**를 쓴다 — 장수가 8장까지 가면 점은 읽히지 않는다.
 */
/** `next/image` 에 넘길 src 가 확정된 사진. 판정은 `PhotoGallery` 가 한 번만 한다 */
type GalleryImage = PlaceImage & { src: string }

export function PhotoGallery({ images, title }: { images: PlaceImage[]; title: string }) {
  // `next/image` 에 넘길 수 있는 것만 남긴다 (허용 호스트 + https 승격)
  const usable = images
    .map((image) => ({ ...image, src: imageSrc(image.originImgUrl) }))
    .filter((image): image is GalleryImage => image.src !== null)

  // 0장이면 섹션 자체를 렌더하지 않는다
  if (usable.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <MobileCarousel images={usable} title={title} />
      <DesktopStrip images={usable} title={title} />

      {/* 사진 출처는 갤러리 바로 아래. 정보 출처는 본문 끝 — 각각 자기 자료 옆에서 읽힌다 */}
      <p className="text-caption text-fg-muted px-4 md:px-10">{messages.place.photoSource}</p>
    </div>
  )
}

function MobileCarousel({ images, title }: { images: GalleryImage[]; title: string }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)

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
        className="flex snap-x snap-mandatory scrollbar-none gap-2 overflow-x-auto px-4"
      >
        {images.map((image, position) => (
          <li
            key={image.originImgUrl ?? position}
            className="bg-band relative shrink-0 snap-start overflow-hidden rounded-md"
            style={{ width: 'var(--gallery-w-mobile)', height: 'var(--gallery-h-mobile)' }}
          >
            <Image
              src={image.src}
              // 대표 이미지는 장식이 아니라 콘텐츠다 — 장소명을 alt 로 준다
              alt={position === 0 ? title : (image.imgName ?? '')}
              fill
              sizes="342px"
              priority={position === 0}
              className="object-cover"
            />
          </li>
        ))}
      </ul>

      {/* 점 인디케이터가 아니라 카운터다 — 8장까지 가면 점은 읽히지 않는다 */}
      {images.length > 1 && (
        <span className="bg-fg text-fg-inverse text-caption absolute right-6 bottom-2 rounded-sm px-2 py-1 font-medium tabular-nums">
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
function DesktopStrip({ images, title }: { images: GalleryImage[]; title: string }) {
  const [lead, ...rest] = images
  if (lead === undefined) return null

  const thumbs = rest.slice(0, 2)
  // 대표 1 + 썸네일 2 를 넘는 나머지 장수. 마지막 썸네일 위에 +N 으로 얹는다
  const overflow = images.length - 1 - thumbs.length

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
          <Image src={lead.src} alt={title} fill sizes="590px" priority className="object-cover" />
        </div>

        {/* 2장이면 썸네일 열을 만들지 않는다 — 같은 크기로 나란히 둔다 */}
        {images.length === 2 && rest[0] !== undefined && (
          <div className="bg-band relative overflow-hidden rounded-md">
            <Image
              src={rest[0].src}
              alt={rest[0].imgName ?? ''}
              fill
              sizes="590px"
              className="object-cover"
            />
          </div>
        )}

        {images.length >= 3 && (
          <ul className="grid gap-2" style={{ gridTemplateRows: '1fr 1fr' }}>
            {thumbs.map((image, position) => (
              <li
                key={image.originImgUrl ?? position}
                className="bg-band relative overflow-hidden rounded-md"
              >
                <Image
                  src={image.src}
                  alt={image.imgName ?? ''}
                  fill
                  sizes="362px"
                  className="object-cover"
                />
                {/* +N 은 마지막 썸네일 위에 얹는다 */}
                {overflow > 0 && position === thumbs.length - 1 && (
                  <span className="bg-fg/60 text-fg-inverse text-title-2 absolute inset-0 flex items-center justify-center font-semibold tabular-nums">
                    +{overflow}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
