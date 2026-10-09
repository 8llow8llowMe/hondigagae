'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { Chip } from '@/components/chip'
import { ChevronDownIcon } from '@/components/icons'
import { PetAvatar } from '@/components/pet-avatar'
import { PetSwitcherMenu } from '@/features/nav/pet-switcher-menu'
import { useSelectedPetStore } from '@/features/nav/selected-pet-store'
import { messages } from '@/lib/messages'
import { resolveSelectedPet } from '@/lib/nav/selected-pet'
import { type MenuPlacement, menuPlacement } from '@/lib/ui/menu-placement'
import { useOverlay } from '@/lib/ui/overlay'
import type { Pet } from '@/types/pet'

/**
 * 스위처가 서는 자리.
 * - `header` — 띠 헤더 오른쪽 묶음 (기본, 전역nav-세부명세 D4-3)
 * - `chip` — `/places` 지도 보기 필터 줄 맨 앞 칩 (장소-반려견칩-세부명세, #1301). 지도 보기는 띠 헤더가
 *   걷혀(#1300) 이 칩이 반려견을 바꾸는 유일한 곳이다
 */
export type PetSwitcherVariant = 'header' | 'chip'

/** 모바일 탭바 — 칩 메뉴가 아래로 내려갈 수 있는 바닥 (`mobile-tab-bar.tsx`) */
const TAB_BAR_SELECTOR = '[data-tab-bar]'

/**
 * 반려견 스위처 — 전역nav-세부명세 D4-3 · 장소-반려견칩-세부명세.
 *
 * **판정의 기준을 바꾸는 컨트롤이므로 헤더에 상시 노출한다.** 화면 밖에 숨어 있으면
 * 사용자가 왜 값이 바뀌었는지 모른다. 헤더가 없는 지도 보기에서는 필터 줄 칩(`variant="chip"`)이
 * 같은 일을 한다 — **한 벌이다.** 같은 스토어 · 같은 메뉴(`PetSwitcherMenu`)를 쓰고 트리거 모양만 갈린다.
 *
 * - 반려견 0마리 → 헤더는 스위처 대신 **"반려견 등록" 링크**, 칩은 **아무것도 그리지 않는다** — 지도 미리보기
 *   판정 카드가 이미 등록을 권한다 (장소-반려견칩 D1-2)
 * - 1마리도 메뉴가 열린다 — 그 한 마리 체크 + `반려견 등록`. 눌러도 아무것도 안 되는 트리거는 죽은 컨트롤이다
 * - 상한(5마리) 도달 → 드롭다운의 "반려견 등록" 을 **비활성 + 이유 표시**
 * - `Esc` / 바깥 클릭 / 고르기로 닫고 **포커스가 트리거로 복귀**한다
 *
 * **접근 이름은 `반려견 바꾸기, 지금 몽실이` 다.** 보이는 이름 앞에 `sr-only` 앞말을 둔다 — 이름만으로는
 * 무엇을 하는 버튼인지 들리지 않는다. `aria-label` 로 덮지 않는다(보이는 글자가 이름 안에 든다, WCAG 2.5.3).
 *
 * 반려견 이름이 길어도 헤더를 밀지 않게 `max-width` + `truncate` 를 건다 (D1).
 */
export function PetSwitcher({
  pets,
  totalCount,
  variant = 'header',
}: {
  pets: Pet[]
  totalCount: number
  variant?: PetSwitcherVariant
}) {
  const [open, setOpen] = useState(false)
  /*
    칩 메뉴의 위/아래 (장소-반려견칩 D1-2). 지도 시트가 `min` 이면 칩이 화면 아래쪽이라 아래로 열면 탭바에
    가리고, `max` 면 위쪽이라 위로 열면 화면 밖이다 — 하나로 고정할 수 없어 **열 때 잰다.** 처음 그리는
    프레임은 아래이고, 칠하기 전에(`useLayoutEffect`) 뒤집는다. 헤더는 늘 아래다.
  */
  const [placement, setPlacement] = useState<MenuPlacement>('below')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const isChip = variant === 'chip'

  const storedPetId = useSelectedPetStore((state) => state.selectedPetId)
  const select = useSelectedPetStore((state) => state.select)
  const restore = useSelectedPetStore((state) => state.restore)

  // localStorage 는 서버에서 읽을 수 없다. 마운트 후 복원해야 하이드레이션이 어긋나지 않는다.
  useEffect(() => restore(), [restore])

  useOverlay({
    open,
    onClose: () => setOpen(false),
    containerRef: panelRef,
    triggerRef,
    // 팝오버는 배경 덮개가 없어 페이지가 살아 있다 — 바탕 스크롤을 잠그지 않는다
    lockScroll: false,
    // 칩은 지도 시트 · 도킹 패널 안이다 — 포커스 복귀가 그 스크롤을 튀기지 않게 (D6)
    restoreFocusPreventScroll: isChip,
  })

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) === true) return
      if (triggerRef.current?.contains(target) === true) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !isChip) return
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (trigger === null || panel === null) return

    const triggerBox = trigger.getBoundingClientRect()
    // `md:hidden` 이라 768 이상에서는 높이 0 — 그때는 화면 바닥까지다
    const tabBar = document.querySelector(TAB_BAR_SELECTOR)?.getBoundingClientRect()
    const viewportBottom =
      tabBar !== undefined && tabBar.height > 0 ? tabBar.top : window.innerHeight

    // 패널이 마운트돼야 높이를 잴 수 있다 — 칠하기 전에 한 번 뒤집는다
    setPlacement(
      menuPlacement({
        triggerTop: triggerBox.top,
        triggerBottom: triggerBox.bottom,
        panelHeight: panel.offsetHeight,
        viewportBottom,
      }),
    )
  }, [open, isChip])

  // 복원 전(undefined)에도 첫 번째로 그린다 — 서버와 같은 결과라 깜빡이지 않는다
  const selected = resolveSelectedPet(pets, storedPetId ?? null)

  // 빈 드롭다운을 보여주지 않는다 (D4-3)
  if (selected === null) {
    // 지도 필터 줄에는 등록 유도 칩을 두지 않는다 — 판정 카드가 그 자리다 (장소-반려견칩 D1-2)
    if (isChip) return null
    return (
      <Link
        href="/pets/new"
        className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md px-2 font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {messages.home.registerPet}
      </Link>
    )
  }

  const selectedPetId = selected.petId

  const close = () => {
    setOpen(false)
    setPlacement('below')
  }

  const toggle = () => {
    if (open) close()
    else setOpen(true)
  }

  const choose = (petId: string) => {
    // 지금 반려견을 고르면 닫기만 한다 — 저장값을 다시 쓸 일이 없다
    if (petId !== selectedPetId) select(petId)
    close()
  }

  // 트리거 앞의 숨은 앞말 — 접근 이름이 `반려견 바꾸기, 지금 몽실이` 가 된다 (공백 한 칸 포함)
  const namePrefix = <span className="sr-only">{`${messages.pet.switcherNamePrefix} `}</span>

  const menu = open && (
    <PetSwitcherMenu
      id={menuId}
      panelRef={panelRef}
      pets={pets}
      selectedPetId={selectedPetId}
      totalCount={totalCount}
      onSelect={choose}
      onClose={close}
      align={isChip ? 'start' : 'end'}
      placement={isChip ? placement : 'below'}
      noSheetDrag={isChip}
    />
  )

  if (isChip) {
    return (
      <div className="relative shrink-0">
        {/*
          **`Chip` 그대로다** — 같은 필터 줄의 `지역 ▾` · `더보기` 와 같은 컨트롤로 읽혀야 한다. `selected={false}`
          고정: 켠 색은 "결과를 좁히는 조건이 걸림" 이고 `초기화` 의 대상인데, 반려견은 좁히지도 초기화되지도
          않는다 (장소-반려견칩 D1-2).

          앞 표시는 이모지가 아니라 아바타다 (DESIGN.md §10). `-ml-1` 은 원이 칩 왼쪽 여백 12 안에서 둥근
          테두리에 맞게 조금 당겨 서게 한다 — 일정 목록 반려견 칩(`PlanPetChips`)과 같은 모양이다.
        */}
        <Chip
          ref={triggerRef}
          selected={false}
          expanded={open}
          popup="menu"
          controls={menuId}
          onSelect={toggle}
        >
          {namePrefix}
          <PetAvatar size="sm" url={selected.profileImageUrl} className="-ml-1" />
          <span className="max-w-20 truncate">{selected.name}</span>
          <ChevronDownIcon size={16} className="shrink-0" />
        </Chip>
        {menu}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={toggle}
        className="text-body-2 text-fg hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 max-w-40 items-center gap-1 rounded-md px-2 font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {namePrefix}
        <span className="truncate">{selected.name}</span>
        <ChevronDownIcon size={16} className="text-fg-subtle shrink-0" />
      </button>

      {menu}
    </div>
  )
}
