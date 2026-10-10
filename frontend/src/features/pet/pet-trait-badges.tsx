import { Badge } from '@/components/badge'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

/**
 * 성향 배지.
 *
 * **true 인 것만 표시한다.** "더위에 민감하지 않음" 을 배지로 그리면 배지가 항상 4개가
 * 되어 정보량이 0 이 된다 (목록-세부명세 D5).
 *
 * 크기·활동량·사회성은 항상 값이 있으므로 **서버 metadata 의 `name` 을 그대로** 쓴다.
 * FE 가 한국어 매핑 테이블을 만들지 않는다 (api-integration-guide.md §6).
 *
 * **전부 중립 태그다** (DESIGN.md §0 · §2-5). 이전에는 성향 배지가 `accent` 를 썼는데
 * accent 는 **AI 가 생성·판단한 것** 표시 전용이다. 장식으로 쓰면 사용자가 AI 표시를
 * 알아볼 근거가 사라진다 — DESIGN.md 가 명시적으로 지적한 항목이다.
 */
export function PetTraitBadges({ pet }: { pet: Pet }) {
  const labels = messages.pet.labels

  const flags: { key: string; label: string }[] = []
  if (pet.heatSensitive) flags.push({ key: 'heat', label: labels.heatSensitive })
  if (pet.coldSensitive) flags.push({ key: 'cold', label: labels.coldSensitive })
  if (pet.noiseSensitive) flags.push({ key: 'noise', label: labels.noiseSensitive })
  if (pet.walkPreferred) flags.push({ key: 'walk', label: labels.walkPreferred })

  return (
    <ul className="flex flex-wrap gap-1.5">
      <li>
        <Badge tone="neutral">{pet.sizeType.name}</Badge>
      </li>
      <li>
        <Badge tone="neutral">
          {labels.activityLevel} {pet.activityLevel.name}
        </Badge>
      </li>
      <li>
        <Badge tone="neutral">
          {labels.sociality} {pet.sociality.name}
        </Badge>
      </li>
      {flags.map((flag) => (
        <li key={flag.key}>
          <Badge tone="neutral">{flag.label}</Badge>
        </li>
      ))}
    </ul>
  )
}
