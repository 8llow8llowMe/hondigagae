'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'

import { ChevronDownIcon } from '@/components/icons'
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
          className="bg-bg border-border absolute end-0 z-40 mt-1 min-w-44 rounded-lg border py-1 shadow-md outline-none"
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
                'text-body-2 hover:bg-band focus-visible:bg-band flex h-11 w-full items-center px-4 text-left focus-visible:outline-none',
                pet.petId === selected.petId
                  ? 'text-fg font-semibold'
                  : 'text-fg-muted font-medium',
              )}
            >
              <span className="truncate">{pet.name}</span>
            </button>
          ))}

          <div className="border-border mt-1 border-t pt-1">
            {limitReached ? (
              // 상한은 버튼을 숨기지 않고 비활성 + 이유를 보여준다 (공통명세)
              <div className="px-4 py-2">
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
                className="text-body-2 text-link hover:bg-band flex h-11 items-center px-4 font-semibold"
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
