import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { PetAvatar } from '@/components/pet-avatar'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

/**
 * `내 반려견` 행 — 아트보드 01.
 *
 * **계정 설정보다 위에 있다.** 탭바가 4개 고정이라 반려견은 이 화면을 통해서만
 * 들어온다 (아트보드 01 주석). 아바타를 겹쳐 보여 몇 마리인지 바로 읽히게 한다.
 *
 * **조회 실패는 이 행을 통째로 숨긴다** — 그 판단은 호출부(`MyPageView`)가 한다.
 * 여기까지 왔다면 그릴 값이 있다는 뜻이다 (0마리 포함).
 *
 * 이동이므로 `<a>` 다. 모양이 같아도 동작 항목(`<button>`)과 역할이 다르다 (D6).
 */
export function MyPetsRow({ pets, totalCount }: { pets: Pet[]; totalCount: number }) {
  return (
    <Link
      href="/pets"
      className="hover:bg-band focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-10"
    >
      {pets.length > 0 && (
        // 겹침. 아바타는 aria-hidden 이고 이름은 아래 줄에 글자로 함께 있다
        <span className="flex shrink-0 -space-x-2">
          {pets.map((pet) => (
            <PetAvatar key={pet.petId} name={pet.name} size="lg" className="ring-bg ring-2" />
          ))}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="text-body-1 text-fg block font-semibold">{messages.member.myPets}</span>
        <span className="text-body-2 text-fg-muted block truncate">
          {pets.length === 0
            ? messages.member.petsEmpty
            : `${pets.map((pet) => pet.name).join(' · ')} · ${messages.member.petsCount(totalCount, MAX_PET_COUNT)}`}
        </span>
      </span>

      <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
    </Link>
  )
}
