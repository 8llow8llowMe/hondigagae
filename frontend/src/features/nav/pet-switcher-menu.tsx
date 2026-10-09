'use client'

import Link from 'next/link'

import type { Ref } from 'react'

import { CheckIcon } from '@/components/icons'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import type { MenuPlacement } from '@/lib/ui/menu-placement'
import { cn } from '@/lib/utils/cn'
import type { Pet } from '@/types/pet'

/** 패널이 트리거의 어느 쪽 끝에 맞춰 서나 — 헤더는 오른쪽 끝, 필터 줄 칩은 왼쪽 끝 */
export type PetSwitcherMenuAlign = 'start' | 'end'

const ALIGN_CLASS: Record<PetSwitcherMenuAlign, string> = {
  start: 'start-0',
  end: 'end-0',
}

const PLACEMENT_CLASS: Record<MenuPlacement, string> = {
  below: 'top-full mt-1',
  above: 'bottom-full mb-1',
}

/**
 * 반려견 스위처의 메뉴 패널 — 헤더 스위처와 지도 필터 줄 칩이 **같이 쓴다** (장소-반려견칩-세부명세 D1-2).
 *
 * 두 트리거가 같은 값을 바꾸므로 메뉴도 하나여야 한다 — 두 벌이면 항목 순서 · 체크 · 상한 안내가 따로 움직인다.
 * **열고 닫는 상태 · 고른 반려견은 부모(`PetSwitcher`)가 쥔다.** 이 컴포넌트는 그리기만 해서, 닫힌 상태라
 * 정적 렌더로 보이지 않던 메뉴 내용을 따로 테스트할 수 있다.
 */
export function PetSwitcherMenu({
  id,
  pets,
  selectedPetId,
  totalCount,
  onSelect,
  onClose,
  align,
  placement,
  panelRef,
  noSheetDrag = false,
}: {
  id: string
  pets: Pet[]
  selectedPetId: string
  totalCount: number
  onSelect: (petId: string) => void
  /** `반려견 등록` 으로 나갈 때 */
  onClose: () => void
  align: PetSwitcherMenuAlign
  placement: MenuPlacement
  panelRef?: Ref<HTMLDivElement>
  /**
   * 지도 시트 머리 안에 설 때 — 시트 머리 전체가 손잡이라(#1278) 항목을 누르다 조금 끌려도 시트가 움직이지
   * 않게 `data-sheet-no-drag` 를 단다 (`map-sheet.tsx` `DRAG_IGNORED_SELECTOR`)
   */
  noSheetDrag?: boolean
}) {
  const limitReached = totalCount >= MAX_PET_COUNT

  return (
    <div
      ref={panelRef}
      id={id}
      role="menu"
      aria-label={messages.pet.switcherMenuLabel}
      data-sheet-no-drag={noSheetDrag ? '' : undefined}
      /*
        **가운데 정렬이다.** 항목이 전부 반려견 이름(짧고 길이가 저마다)이라 왼쪽
        정렬에서는 짧은 이름 뒤로 빈 폭이 길게 남아 글자가 한쪽에 밀린 것처럼 읽혔다.
        트리거 라벨 자체가 폭 좁은 이름 하나라 패널도 그 축에 맞춰 세운다.

        **계정 메뉴(`Menu`)는 왼쪽 정렬로 남긴다** — 그쪽은 길이가 비슷한 이동
        항목 넷이라 왼쪽 축으로 훑는 편이 빠르다. 두 팝오버의 성격이 다르다:
        이쪽은 값을 고르는 스위처고, 그쪽은 메뉴다.

        폭은 헤더 트리거의 `max-w-40` 과 같은 값을 최소폭으로 둔다 — 떨어져 나온 패널이
        트리거보다 좁지 않다는 것만 보장한다.

        **패널이 서는 끝(`align`)은 트리거 자리가 정한다** — 헤더는 오른쪽 끝이라 `end-0`, 필터 줄 칩은 줄 왼쪽
        끝이라 `start-0` 이다. 칩에서 `end-0` 이면 패널이 화면 왼쪽 밖으로 나간다 (#1301).
      */
      className={cn(
        'bg-bg border-border absolute z-40 min-w-40 rounded-lg border py-1 shadow-md outline-none',
        ALIGN_CLASS[align],
        PLACEMENT_CLASS[placement],
      )}
    >
      {pets.map((pet) => {
        const checked = pet.petId === selectedPetId
        return (
          <button
            key={pet.petId}
            type="button"
            role="menuitemradio"
            /* 값을 고르는 라디오다 — 이동 항목의 `aria-current` 는 쓰지 않는다 (D1-2) */
            aria-checked={checked}
            onClick={() => onSelect(pet.petId)}
            className={cn(
              /*
                **좌우 여백이 선택 여부와 무관하게 같다** (#393) — 체크가 `absolute` 라
                자리를 차지하지 않으므로, 여백을 상태에 따라 바꾸면 스위처를 옮길 때마다
                이름이 좌우로 흔들린다. 여백은 체크(16) + 간격이 들어갈 만큼 §4 스케일 안에서 잡는다 (36 은 스케일 밖이라 40).
              */
              'text-body-2 hover:bg-band focus-visible:bg-band relative flex h-11 w-full items-center justify-center px-10 text-center focus-visible:outline-none',
              checked ? 'text-fg font-semibold' : 'text-fg-muted font-medium',
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
            {checked && (
              <CheckIcon
                size={16}
                strokeWidth={2}
                aria-hidden
                className="text-brand-600 absolute end-3 shrink-0"
              />
            )}
          </button>
        )
      })}

      <div className="border-border mt-1 border-t pt-1">
        {limitReached ? (
          // 상한은 버튼을 숨기지 않고 비활성 + 이유를 보여준다 (공통명세)
          <div className="px-5 py-2 text-center">
            <span className="text-body-2 text-fg-subtle block">{messages.home.registerPet}</span>
            <span className="text-caption text-fg-muted block">{messages.pet.limitReached}</span>
          </div>
        ) : (
          <Link
            href="/pets/new"
            role="menuitem"
            onClick={onClose}
            className="text-body-2 text-link hover:bg-band flex h-11 items-center justify-center px-5 font-semibold"
          >
            {messages.home.registerPet}
          </Link>
        )}
      </div>
    </div>
  )
}
