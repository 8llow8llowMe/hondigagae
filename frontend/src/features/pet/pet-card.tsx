import Link from 'next/link'

import { Card } from '@/components/card'
import { PetTraitBadges } from '@/features/pet/pet-trait-badges'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

/** 이름 첫 글자 아바타. 사진 필드가 없어 이것으로 카드를 구분한다 (목록-세부명세 D8-1) */
const AVATAR_TONES = [
  'bg-brand-100 text-brand-700',
  'bg-accent-100 text-accent-700',
  'bg-info-100 text-info-700',
  'bg-warn-100 text-warn-700',
] as const

/** petId 로 색을 고정한다 — 같은 반려견이 항상 같은 색이어야 목록에서 눈이 익는다 */
function toneOf(petId: string): string {
  let sum = 0
  for (const char of petId) sum += char.charCodeAt(0)
  return AVATAR_TONES[sum % AVATAR_TONES.length] ?? AVATAR_TONES[0]
}

/**
 * 반려견 카드.
 *
 * `Card` 에는 `onClick` 이 없다. `Link` 로 감싼다 — `div` + `onClick` 은 키보드로
 * 도달할 수 없다 (목록-세부명세 D6).
 *
 * **카드 안에 별도 링크·버튼을 두지 않는다.** 중첩 링크가 된다. 수정·삭제는
 * 이동한 화면에서 한다.
 */
export function PetCard({ pet }: { pet: Pet }) {
  return (
    <Link
      href={`/pets/${pet.petId}`}
      className="focus-visible:ring-brand-500 block rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card variant="interactive" className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`text-title-2 flex size-12 shrink-0 items-center justify-center rounded-full font-bold ${toneOf(pet.petId)}`}
          >
            {pet.name.slice(0, 1)}
          </span>

          <div className="flex min-w-0 flex-col">
            <h2 className="text-title-3 text-fg truncate font-semibold">{pet.name}</h2>

            {/* null 인 필드는 숨긴다. "정보 없음" 을 그리지 않는다 — 목록-세부명세 D5 */}
            {pet.breed !== null && pet.breed !== '' && (
              <p className="text-body-2 text-fg-muted truncate">{pet.breed}</p>
            )}
          </div>
        </div>

        {pet.age !== null && (
          <p className="text-caption text-fg-muted">
            {messages.pet.labels.birthYm} {pet.birthYm} · {pet.age}세
          </p>
        )}

        <PetTraitBadges pet={pet} />
      </Card>
    </Link>
  )
}
