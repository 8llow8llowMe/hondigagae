'use client'

import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { HelpIcon } from '@/components/icons'
import { MD_QUERY, useMediaQuery } from '@/lib/ui/media-query'
import { cn } from '@/lib/utils/cn'

/**
 * InfoTip — 물음표를 눌러 여는 **보조 설명** (#313).
 *
 * 응답에는 근거 문장이 있는데 화면에 자리가 없는 필드가 여럿이다 (`feelsLikeBasis` ·
 * `heatIndexBasis` · 노면 추정치 · 권역 점수). 상시 노출로 다 세우면 홈 첫 화면의 밀도만
 * 키우고 행동은 하나도 바꾸지 않는다. **필수 표시가 아니라 원할 때 여는 채널**이다.
 *
 * ### 여는 방법이 셋이다
 *
 * `hover` **만으로 열지 않는다.** 터치에서 안 열리고 키보드로도 못 연다. hover · focus ·
 * click 셋 다 열고, `Esc` 와 바깥 클릭이 닫는다.
 *
 * **`title` 속성을 쓰지 않는다.** 모바일에서 안 뜨고 스크린리더 지원이 제각각이며 지연
 * 시간을 우리가 정하지 못한다.
 *
 * ### 폭마다 다른 그릇
 *
 * | 폭 | 그릇 | 왜 |
 * |----|------|----|
 * | `md` 이상 | 팝오버 (`--radius-lg` · `--shadow-md`) | 옆에 자리가 있다 |
 * | `md` 미만 | `BottomSheet` | `feelsLikeBasis` 가 100자를 넘어 390px 말풍선에 안 들어간다 |
 *
 * **CSS 로 감추지 않고 하나만 mount 한다.** 감춘 `BottomSheet` 도 `useOverlay` 를 걸어
 * Esc·포커스·스크롤 잠금을 실행한다 — 보이지 않는 오버레이가 키보드를 가로챈다
 * (`MD_QUERY` 주석).
 *
 * ### 포커스를 옮기지 않는다
 *
 * 팝오버는 **읽는 것**이지 조작하는 것이 아니다. 포커스를 패널로 보내면 트리거가 blur 되어
 * focus 로 연 것이 곧바로 닫히고, 닫은 뒤 포커스가 어디로 갈지도 따로 정해야 한다. 대신
 * 트리거에 `aria-describedby` 를 걸어 **트리거에 머문 채로** 내용이 읽히게 한다
 * (`role="tooltip"`). 시트 쪽은 dialog 라 `BottomSheet` 가 하던 대로 포커스를 가져간다.
 */
export function InfoTip({
  /**
   * 물음표 버튼의 이름이자 시트 제목. **무엇에 대한 설명인지**를 적는다 (`체감온도 근거`).
   * 아이콘만 있는 버튼이라 이 값이 없으면 스크린리더에 이름이 없다.
   */
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  /** 클릭으로 연 것은 hover 가 끝나도 닫지 않는다 — 읽는 도중에 사라지면 읽을 수 없다 */
  const [pinned, setPinned] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()
  const desktop = useMediaQuery(MD_QUERY)

  function close() {
    setOpen(false)
    setPinned(false)
  }

  // 바깥 클릭. 덮개가 없는 팝오버라 문서에서 직접 듣는다 (`Menu` 와 같은 방식)
  useEffect(() => {
    if (!open || !desktop) return

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node) === true) return
      close()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, desktop])

  // Esc. 팝오버 갈래에만 건다 — 시트는 `useOverlay` 가 이미 맡는다
  useEffect(() => {
    if (!open || !desktop) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, desktop])

  const trigger = (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-describedby={open && desktop ? panelId : undefined}
      onClick={() => {
        // 눌러서 연 것은 고정된다. 다시 누르면 닫힌다
        if (pinned) close()
        else {
          setPinned(true)
          setOpen(true)
        }
      }}
      /*
        **focus / blur 는 팝오버 갈래에만 건다.** 시트에서 focus 로 열면 탭 이동만 해도
        모달이 튀어나오고, `BottomSheet` 가 포커스를 가져가는 순간 트리거가 blur 되어
        방금 연 시트가 곧바로 닫힌다.
      */
      onFocus={desktop ? () => setOpen(true) : undefined}
      onBlur={
        desktop
          ? () => {
              if (!pinned) setOpen(false)
            }
          : undefined
      }
      className={cn(
        /*
          **누르는 자리 44** — §7 하한이 아니라 이 트리거에서 고른 값이다 (#883). 아이콘은 16 이고 나머지는 `p-3`(12) 여백이다 —
          `-m-3` 로 그만큼 되돌려 레이아웃에서 차지하는 폭은 20 으로 남긴다. 되돌리지 않으면
          12px 라벨 옆에 44px 짜리 빈 상자가 서서 줄이 벌어진다.
        */
        '-m-3 inline-flex size-11 shrink-0 items-center justify-center p-3',
        'text-fg-subtle hover:text-fg-muted focus-visible:ring-brand-500 rounded-full focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      <HelpIcon size={16} />
    </button>
  )

  if (!desktop) {
    return (
      <span ref={rootRef} className={cn('inline-flex align-middle', className)}>
        {trigger}
        <BottomSheet open={open} onClose={close} title={label}>
          <div className="text-body-2 text-fg px-4 py-4 break-keep">{children}</div>
        </BottomSheet>
      </span>
    )
  }

  return (
    /* `relative` 가 없으면 팝오버가 페이지 좌상단에 뜬다 (`MenuAnchor` 와 같은 이유) */
    <span
      ref={rootRef}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        if (!pinned) setOpen(false)
      }}
      className={cn('relative inline-flex align-middle', className)}
    >
      {trigger}

      {open && (
        <span
          id={panelId}
          role="tooltip"
          /*
            **왼쪽으로 편다** (`right-0`). 이 아이콘이 붙는 자리는 값의 오른쪽이고, 레일은
            폭이 400 이라 오른쪽으로 펴면 열 밖으로 나간다.

            `w-64`(256) 는 `feelsLikeBasis` 100자가 4~5줄로 접히는 폭이다. 더 좁히면 줄이
            늘어 말풍선이 세로로 서고, 더 넓히면 레일(400 − 인셋 48 = 352)을 넘는다.
          */
          className="bg-bg border-border text-body-2 text-fg absolute top-full right-0 z-40 mt-2 w-64 rounded-lg border p-3 break-keep shadow-md"
        >
          {children}
        </span>
      )}
    </span>
  )
}
