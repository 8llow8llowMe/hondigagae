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
import { cn } from '@/lib/utils/cn'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLSpanElement>(null)

  /**
   * 메뉴의 왼쪽 위 꼭짓점. **이름 줄의 왼쪽 아래**에 맞춘다 — 트리거 전체(`top-full` +
   * 컨테이너 인셋) 기준으로 두면 아바타 왼쪽에서 시작해 프로필 블록 밖에서 열리고,
   * 무엇을 눌러 열린 목록인지가 멀어진다. 이름에서 흘러내리면 그 아래 설명을 덮으면서
   * "이 이름을 바꾸는 목록" 으로 읽힌다.
   *
   * **잰다.** 텍스트 블록은 아바타와 세로 중앙 정렬이고 아바타 폭도 폭마다 달라,
   * 이름 줄의 x·y 가 태그 줄 수와 폰트에 따라 움직인다 — 고정값을 적으면 한 경우에서만
   * 맞는다.
   */
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null)

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

    const name = nameRef.current
    const root = rootRef.current
    if (name === null || root === null) return

    const nameBox = name.getBoundingClientRect()
    const rootBox = root.getBoundingClientRect()
    setMenuAt({ top: nameBox.bottom - rootBox.top, left: nameBox.left - rootBox.left })
  }, [open])

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
    <div ref={rootRef} className="relative">
      {/*
        `py-8` 은 폭을 가리지 않는다. 위아래가 각각 날짜 줄·판정 줄과 맞닿아 있어
        `py-4` 로는 프로필이 자기 영역을 갖지 못하고 낀 것처럼 보인다 — 레일이 좁은
        데스크톱에서도 마찬가지다.
      */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="focus-visible:ring-brand-500 flex w-full items-center gap-4 px-4 py-8 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-6"
      >
        <PetAvatar size="hero" name={selected.name} />

        <span className="min-w-0 flex-1">
          <span ref={nameRef} className="flex items-center gap-1">
            <span className="text-title-1 text-fg truncate font-bold">{selected.name}</span>
            <ChevronDownIcon size={18} className="text-fg-subtle shrink-0" />
          </span>
          <span className="text-body-2 text-fg-muted block tabular-nums">
            {describePet(selected, { size: true })}
          </span>
          <TraitTags pet={selected} />
        </span>
      </button>

      {/* 재기 전 첫 프레임은 트리거 아래(`top-full`)로 둔다 — 위치 없이 그리지 않는다 */}
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="반려견 전환"
          className={cn(
            'bg-bg border-border absolute z-40 min-w-56 rounded-lg border py-1 shadow-md outline-none',
            menuAt === null && 'start-4 top-full md:start-6',
          )}
          style={menuAt === null ? undefined : { top: menuAt.top, insetInlineStart: menuAt.left }}
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
