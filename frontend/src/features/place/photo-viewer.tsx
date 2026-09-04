'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import Image from 'next/image'

import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { useOverlay } from '@/lib/ui/overlay'

/** 뷰어가 그리는 한 장. `src` 판정은 `PhotoGallery` 가 이미 끝냈다 */
export type ViewerImage = { src: string; imgName: string | null }

/**
 * PhotoViewer — 장소 사진을 화면 가득 확대해 보는 뷰어.
 *
 * **왜 필요했나.** 데스크톱 모자이크는 대표 1 + 썸네일 2 만 그리고 나머지를 `+N` 으로
 * 덮는다. 그 `+N` 이 장수만 말하고 아무 데도 가지 않아, **4장째부터는 화면에 도달할
 * 경로가 아예 없었다.** 모바일 캐러셀은 전부 그리지만 214px 높이라 작다. 뷰어 하나가
 * 두 문제를 같이 닫는다 — 갤러리의 모든 타일과 `+N` 이 이것을 연다.
 *
 * **`object-contain` 이다.** 갤러리 타일은 `object-cover`(고정 높이를 지켜야 한다)지만
 * 여기는 반대다 — 확대해 보려고 연 화면에서 가장자리를 잘라내면 여는 의미가 없다.
 * TourAPI 사진은 세로·파노라마가 섞여 있어 잘림이 실제로 눈에 띈다.
 *
 * **`Modal` 을 쓰지 않는다.** 그쪽은 제목·설명·본문·조작부 네 자리를 가진 카드 레이아웃
 * (`max-w-sm`, 흰 배경, 패딩 20)이라 전면 사진과 맞지 않는다. 다만 다이얼로그 **계약**은
 * 같은 것을 쓴다 — `useOverlay` 가 Esc·바탕 스크롤 잠금·포커스 복귀를 준다.
 *
 * 좌우 이동은 버튼과 `ArrowLeft`/`ArrowRight` 둘 다 받는다. **순환하지 않는다** — 끝에서
 * 처음으로 돌면 카운터(`3/8`)가 갑자기 뒤로 뛰어 몇 장이 남았는지 읽을 수 없다.
 */
export function PhotoViewer({
  images,
  /** 열려 있으면 보고 있는 사진의 0-based 위치, 닫혀 있으면 `null` */
  index,
  onIndexChange,
  onClose,
  /** 장소명 — 첫 사진의 alt 로 쓴다 (갤러리와 같은 규칙) */
  title,
}: {
  images: readonly ViewerImage[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
  title: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const base = useId()
  const open = index !== null

  useOverlay({ open, onClose, containerRef: panelRef })

  /*
    좌우 키. `useOverlay` 는 Esc 만 맡으므로 이동은 여기서 건다.

    **닫혀 있으면 걸지 않는다** — 뷰어가 닫힌 상세 화면에서 방향키를 누르면 페이지가
    가로로 스크롤되어야 하고, 그것을 이 컴포넌트가 가로채면 안 된다.
  */
  const last = images.length - 1
  useEffect(() => {
    if (index === null) return

    function onKeyDown(event: KeyboardEvent) {
      if (index === null) return

      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault()
        onIndexChange(index - 1)
      }
      if (event.key === 'ArrowRight' && index < last) {
        event.preventDefault()
        onIndexChange(index + 1)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [index, last, onIndexChange])

  const goPrev = useCallback(() => {
    if (index !== null && index > 0) onIndexChange(index - 1)
  }, [index, onIndexChange])

  const goNext = useCallback(() => {
    if (index !== null && index < last) onIndexChange(index + 1)
  }, [index, last, onIndexChange])

  if (index === null) return null

  const current = images[index]
  if (current === undefined) return null

  const titleId = `${base}-title`

  return (
    <div className="fixed inset-0 z-50">
      {/*
        배경 덮개. Esc 와 바깥 클릭이 닫기를 맡으므로 a11y 트리에서 뺀다 — `Modal` 과 같은
        처리다. **여기서는 거의 불투명하다**: 사진을 보는 화면이라 뒤의 본문이 비치면
        사진의 밝은 부분과 섞여 읽히지 않는다.
      */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="bg-fg/95 absolute inset-0"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full flex-col outline-none"
      >
        {/* 제목은 이름표다 — 화면에는 장소명과 카운터가 보이고 이 줄이 그 둘을 묶는다 */}
        <h2 id={titleId} className="sr-only">
          {messages.place.galleryViewerTitle}
        </h2>

        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          <p className="text-body-2 text-fg-inverse min-w-0 flex-1 truncate font-semibold">
            {title}
          </p>

          {images.length > 1 && (
            <span className="text-body-2 text-fg-inverse shrink-0 font-medium tabular-nums">
              {messages.place.galleryPosition
                .replace('{index}', String(index + 1))
                .replace('{total}', String(images.length))}
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={messages.common.close}
            className="text-fg-inverse focus-visible:ring-fg-inverse flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <CloseIcon size={24} />
          </button>
        </div>

        {/*
          사진 자리. `relative` + `fill` 로 남은 높이를 전부 쓴다 — 고정 높이를 주면
          가로 사진과 세로 사진 중 한쪽이 반드시 남거나 넘친다.

          **바깥을 눌러도 닫힌다.** 사진 자체는 덮개 위에 있어 클릭이 덮개까지 가지 않지만,
          사진 좌우의 빈 자리는 이 컨테이너다 — 거기서 닫히지 않으면 "바깥을 눌렀는데
          안 닫힌다" 가 된다. 컨테이너를 버튼으로 만들지 않고 덮개를 그대로 통과시킨다.
        */}
        <div className="relative min-h-0 flex-1">
          <Image
            key={current.src}
            src={current.src}
            alt={index === 0 ? title : (current.imgName ?? '')}
            fill
            sizes="100vw"
            // 확대해 보려고 연 화면이다. cover 로 가장자리를 잘라내지 않는다
            className="object-contain"
          />
        </div>

        {/*
          좌우 이동. **1장이면 그리지 않는다** — 항상 비활성인 버튼 두 개가 사진 위에
          남으면 무엇이 막혔는지 설명할 길 없이 자리만 차지한다.

          `disabled` 는 끝에서만 걸린다 (순환하지 않는다).
        */}
        {images.length > 1 && (
          <div className="flex shrink-0 items-center justify-center gap-3 px-4 py-4">
            <ViewerNavButton
              label={messages.place.galleryPrevAction}
              onClick={goPrev}
              disabled={index === 0}
            >
              <ChevronLeftIcon size={24} />
            </ViewerNavButton>
            <ViewerNavButton
              label={messages.place.galleryNextAction}
              onClick={goNext}
              disabled={index === last}
            >
              <ChevronRightIcon size={24} />
            </ViewerNavButton>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 뷰어 좌우 버튼 — 48px 원형.
 *
 * **사진 위에 얹지 않고 아래 줄에 둔다.** 얹으면 세로 사진의 좌우 여백에서는 배경 위지만
 * 가로 사진에서는 사진 위에 겹쳐 사진의 그 부분을 가린다. 두 경우 모두에서 같은 자리에
 * 있으려면 사진 밖이어야 한다. 모바일에서도 엄지 자리(하단)에 온다.
 */
function ViewerNavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="border-fg-inverse/40 text-fg-inverse focus-visible:ring-fg-inverse flex size-12 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
