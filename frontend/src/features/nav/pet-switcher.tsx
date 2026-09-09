'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'

import { CheckIcon, ChevronDownIcon } from '@/components/icons'
import { useSelectedPetStore } from '@/features/nav/selected-pet-store'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { resolveSelectedPet } from '@/lib/nav/selected-pet'
import { useOverlay } from '@/lib/ui/overlay'
import { cn } from '@/lib/utils/cn'
import type { Pet } from '@/types/pet'

/**
 * 반려견 스위처 — 전역nav-세부명세 D4-3.
 *
 * **판정의 기준을 바꾸는 컨트롤이므로 헤더에 상시 노출한다.** 화면 밖에 숨어 있으면
 * 사용자가 왜 값이 바뀌었는지 모른다.
 *
 * - 반려견 0마리 → 스위처 대신 **"반려견 등록" 버튼**. 빈 드롭다운을 보여주지 않는다
 * - 상한(5마리) 도달 → 드롭다운의 "반려견 등록" 을 **비활성 + 이유 표시**
 * - `Esc` / 바깥 클릭으로 닫고 **포커스가 트리거로 복귀**한다
 *
 * 반려견 이름이 길어도 헤더를 밀지 않게 `max-width` + `truncate` 를 건다 (D1).
 */
export function PetSwitcher({ pets, totalCount }: { pets: Pet[]; totalCount: number }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

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

  // 복원 전(undefined)에도 첫 번째로 그린다 — 서버와 같은 결과라 깜빡이지 않는다
  const selected = resolveSelectedPet(pets, storedPetId ?? null)
  const limitReached = totalCount >= MAX_PET_COUNT

  // 빈 드롭다운을 보여주지 않는다 (D4-3)
  if (selected === null) {
    return (
      <Link
        href="/pets/new"
        className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md px-2 font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {messages.home.registerPet}
      </Link>
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
        onClick={() => setOpen((prev) => !prev)}
        className="text-body-2 text-fg hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 max-w-40 items-center gap-1 rounded-md px-2 font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="truncate">{selected.name}</span>
        <ChevronDownIcon size={16} className="text-fg-subtle shrink-0" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label="반려견 전환"
          /*
            **가운데 정렬이다.** 항목이 전부 반려견 이름(짧고 길이가 저마다)이라 왼쪽
            정렬에서는 짧은 이름 뒤로 빈 폭이 길게 남아 글자가 한쪽에 밀린 것처럼 읽혔다.
            트리거 라벨 자체가 폭 좁은 이름 하나라 패널도 그 축에 맞춰 세운다.

            **계정 메뉴(`Menu`)는 왼쪽 정렬로 남긴다** — 그쪽은 길이가 비슷한 이동
            항목 넷이라 왼쪽 축으로 훑는 편이 빠르다. 두 팝오버의 성격이 다르다:
            이쪽은 값을 고르는 스위처고, 그쪽은 메뉴다.

            폭은 트리거의 `max-w-40` 과 같은 값을 최소폭으로 둔다 — 떨어져 나온 패널이
            트리거보다 좁지 않다는 것만 보장한다.
          */
          className="bg-bg border-border absolute end-0 z-40 mt-1 min-w-40 rounded-lg border py-1 shadow-md outline-none"
        >
          {pets.map((pet) => (
            <button
              key={pet.petId}
              type="button"
              role="menuitemradio"
              aria-checked={pet.petId === selected.petId}
              onClick={() => {
                select(pet.petId)
                setOpen(false)
              }}
              className={cn(
                /*
                  **좌우 여백이 선택 여부와 무관하게 같다** (#393) — 체크가 `absolute` 라
                  자리를 차지하지 않으므로, 여백을 상태에 따라 바꾸면 스위처를 옮길 때마다
                  이름이 좌우로 흔들린다. 여백은 체크(16) + 간격이 들어갈 만큼 §4 스케일 안에서 잡는다 (36 은 스케일 밖이라 40).
                */
                'text-body-2 hover:bg-band focus-visible:bg-band relative flex h-11 w-full items-center justify-center px-10 text-center focus-visible:outline-none',
                pet.petId === selected.petId
                  ? 'text-fg font-semibold'
                  : 'text-fg-muted font-medium',
              )}
            >
              <span className="truncate">{pet.name}</span>
              {/*
                **지금 판정의 기준이 되는 반려견을 눈으로 찍어 준다** (#393). weight·색만으로
                가르던 것을 체크로 보강했다 — 반려견이 둘뿐이면 굵기 차이가 미묘하고, 이름은
                길이도 제각각이라 비교 기준이 되지 못한다.

                `aria-checked`(`menuitemradio`)가 이미 보조기기에 같은 사실을 말하므로
                아이콘은 `aria-hidden` 이다. 두 번 읽히면 "몽실이 선택됨 선택됨" 이 된다.
              */}
              {pet.petId === selected.petId && (
                <CheckIcon
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                  className="text-brand-600 absolute end-3 shrink-0"
                />
              )}
            </button>
          ))}

          <div className="border-border mt-1 border-t pt-1">
            {limitReached ? (
              // 상한은 버튼을 숨기지 않고 비활성 + 이유를 보여준다 (공통명세)
              <div className="px-5 py-2 text-center">
                <span className="text-body-2 text-fg-subtle block">
                  {messages.home.registerPet}
                </span>
                <span className="text-caption text-fg-muted block">
                  {messages.pet.limitReached}
                </span>
              </div>
            ) : (
              <Link
                href="/pets/new"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-body-2 text-link hover:bg-band flex h-11 items-center justify-center px-5 font-semibold"
              >
                {messages.home.registerPet}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
