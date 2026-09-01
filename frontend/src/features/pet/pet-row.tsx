import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Row } from '@/components/surface'
import { PetPhoto } from '@/features/pet/pet-photo'
import { PetTraitBadges } from '@/features/pet/pet-trait-badges'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

/**
 * 반려견 행. **카드가 아니라 전폭 행이다** (DESIGN.md §0).
 *
 * 아바타는 **업로드한 사진, 없으면 이름 첫 글자**다 (`PetPhoto`). 사진 필드는
 * 백엔드 PR #107 로 생겼다 — 그전까지 이니셜뿐이라고 적혀 있던 자리다.
 *
 * **아바타 색을 petId 로 돌리던 장식 팔레트를 걷어냈다** — DESIGN.md §0 "채도는
 * 데이터에만". 반려견마다 다른 색을 주면 사용자가 그 색을 등급 신호로 읽는다.
 * 구분은 이름 글자가 맡는다.
 *
 * `Row` 에는 `onClick` 이 없다. `Link` 로 감싼다 — `div` + `onClick` 은 키보드로
 * 도달할 수 없다 (목록-세부명세 D6).
 * **행 안에 별도 링크·버튼을 두지 않는다.** 중첩 링크가 된다. 수정·삭제는 이동한 화면에서 한다.
 */
export function PetRow({ pet, last = false }: { pet: Pet; last?: boolean }) {
  return (
    <Row as="li" last={last}>
      <Link
        href={`/pets/${pet.petId}`}
        className="focus-visible:ring-brand-500 flex flex-col gap-3 py-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex items-center gap-3">
          {/* 원형은 사진·아바타에만 허용된 곡선이다 (DESIGN.md §5) */}
          <PetPhoto name={pet.name} url={pet.profileImageUrl} />

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <h2 className="text-title-2 text-fg truncate font-semibold">{pet.name}</h2>
              {/* **대표는 하나뿐이라 배지가 신호로 산다.** 모든 행에 붙는 표시가 아니다 */}
              {pet.representative && (
                <Badge tone="neutral" size="sm" className="shrink-0">
                  {messages.pet.representativeBadge}
                </Badge>
              )}
            </div>

            {/* null 인 필드는 숨긴다. "정보 없음" 을 그리지 않는다 — 목록-세부명세 D5 */}
            {pet.breed !== null && pet.breed !== '' && (
              <p className="text-body-2 text-fg-muted truncate">{pet.breed}</p>
            )}
          </div>
        </div>

        {pet.age !== null && (
          <p className="text-caption text-fg-muted tabular-nums">
            {messages.pet.labels.birthYm} {pet.birthYm} · {pet.age}세
          </p>
        )}

        <PetTraitBadges pet={pet} />
      </Link>
    </Row>
  )
}
