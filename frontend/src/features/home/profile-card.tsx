'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ChevronDownIcon } from '@/components/icons'
import { PetAvatar } from '@/components/pet-avatar'
import { useSelectedPetStore } from '@/features/nav/selected-pet-store'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { describePet } from '@/lib/pet/describe'
import { useOverlay } from '@/lib/ui/overlay'
import type { Pet } from '@/types/pet'

/**
 * ProfileCard — 아트보드 `01 홈 · P1` / `02 홈` 좌측 상단 / `03 · C`.
 *
 * **프로필 블록 전체가 반려견 스위처다.** 판정의 기준을 바꾸는 컨트롤이라 화면 밖에
 * 숨기지 않는다 — 숨어 있으면 사용자가 왜 값이 바뀌었는지 모른다.
 *
 * 사진 96(모바일) / 112(데스크톱) **원형**. 원형은 사진·아바타에만 허용된 곡선이다.
 * 폴백 순서는 업로드 → 견종 일러스트 → **이니셜 원형**인데, 백엔드에 사진 필드가 없어
 * 지금은 이니셜뿐이다. **빈 원형을 남기지 않는다.**
 *
 * 표시 항목은 이름 + 견종·크기·나이 + **특성 태그 2개까지**. 3개 이상은 `+n`.
 */
export function ProfileCard({ pets, totalCount }: { pets: Pet[]; totalCount: number }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const storedPetId = useSelectedPetStore((state) => state.selectedPetId)
  const select = useSelectedPetStore((state) => state.select)

  useOverlay({
    open,
    onClose: () => setOpen(false),
    containerRef: panelRef,
    triggerRef,
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

  const selected = pets.find((pet) => pet.petId === storedPetId) ?? pets[0] ?? null

  // 0마리면 프로필 자리에 등록 유도 행을 둔다 (아트보드 04-②)
  if (selected === null) return <RegisterPrompt />

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="focus-visible:ring-brand-500 flex w-full items-center gap-4 px-4 py-4 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-6"
      >
        <PetAvatar size="hero" name={selected.name} />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="text-title-1 text-fg truncate font-bold">{selected.name}</span>
            <ChevronDownIcon size={18} className="text-fg-subtle shrink-0" />
          </span>
          <span className="text-body-2 text-fg-muted block tabular-nums">
            {describePet(selected, { size: true })}
          </span>
          <TraitTags pet={selected} />
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="반려견 전환"
          className="bg-bg border-border absolute start-4 top-full z-40 min-w-56 rounded-lg border py-1 shadow-md outline-none md:start-6"
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
              className="hover:bg-band focus-visible:bg-band flex h-11 w-full items-center gap-2 px-4 text-left focus-visible:outline-none"
            >
              <PetAvatar name={pet.name} />
              <span className="text-body-2 text-fg min-w-0 truncate font-medium">
                {pet.name}
                <span className="text-fg-muted"> · {firstTrait(pet)}</span>
              </span>
            </button>
          ))}

          <div className="border-border mt-1 border-t pt-1">
            {totalCount >= MAX_PET_COUNT ? (
              // 상한은 항목을 숨기지 않고 비활성 + 이유를 보여준다
              <div className="px-4 py-2">
                <span className="text-body-2 text-fg-subtle block">
                  {messages.home.registerPet} ({totalCount}/{MAX_PET_COUNT})
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
                className="text-body-2 text-link hover:bg-band flex h-11 items-center px-4 font-semibold tabular-nums"
              >
                {messages.home.registerPet} ({totalCount}/{MAX_PET_COUNT})
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** 특성 태그. **2개까지 보이고 나머지는 `+n`** (가이드 §5 ProfileCard) */
function TraitTags({ pet }: { pet: Pet }) {
  const traits = petTraits(pet)
  if (traits.length === 0) return null

  const shown = traits.slice(0, 2)
  const rest = traits.length - shown.length

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((trait) => (
        <Badge key={trait} tone="neutral">
          {trait}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge tone="neutral" className="tabular-nums">
          +{rest}
        </Badge>
      )}
    </div>
  )
}

function RegisterPrompt() {
  return (
    <Link
      href="/pets/new"
      className="focus-visible:ring-brand-500 flex items-center gap-3 px-4 py-4 focus-visible:ring-2 focus-visible:outline-none md:px-6"
    >
      <span className="min-w-0 flex-1">
        <span className="text-body-1 text-fg block font-semibold">
          {messages.home.guestProfileTitle}
        </span>
        <span className="text-body-2 text-fg-muted block">{messages.home.guestProfileDesc}</span>
      </span>
      <span className="text-body-2 text-link shrink-0 font-semibold">
        {messages.home.registerPet} ›
      </span>
    </Link>
  )
}

export function petTraits(pet: Pet): string[] {
  const traits: string[] = []

  if (pet.heatSensitive) traits.push(messages.home.traitHeat)
  if (pet.coldSensitive) traits.push(messages.home.traitCold)
  if (pet.noiseSensitive) traits.push(messages.home.traitNoise)
  if (pet.walkPreferred) traits.push(messages.home.traitWalk)

  return traits
}

function firstTrait(pet: Pet): string {
  return petTraits(pet)[0] ?? pet.sizeType.name
}
