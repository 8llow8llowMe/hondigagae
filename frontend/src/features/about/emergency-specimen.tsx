import { Surface } from '@/components/surface'
import { EMERGENCY_ROWS_SPECIMEN } from '@/features/about/about-specimen-data'
import { Tag } from '@/features/about/tag'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 질문 4 의 고정 예시 — 가까운 동물병원·약국 두 줄 (#635, 명세 §5-5).
 *
 * **서버 컴포넌트다.** `PlacesSpecimen` 과 같은 이유로 상태가 없다 — 거리순으로 이미
 * 정렬된 그림이고 누를 곳이 없다.
 *
 * 거리는 `tabular-nums` 다. 두 줄의 소수점 자리가 어긋나면 거리순이라는 사실이 흐려진다.
 */
export function EmergencySpecimen() {
  const specimen = messages.about.specimen

  return (
    <Surface aria-label={specimen.emergencyAria} className="-mx-4 md:mx-0">
      <div className={cn('pt-4', INSET_CLASS.card)}>
        <p className="text-title-2 text-fg font-semibold">{specimen.emergencyTitle}</p>
        <p className="text-caption text-fg-muted mt-1 font-medium">{specimen.emergencySub}</p>
      </div>
      <ul className={cn('pt-3', INSET_CLASS.card)}>
        {EMERGENCY_ROWS_SPECIMEN.map((row, index) => (
          <li
            key={row.name}
            className={cn('flex items-center gap-3 py-3', index > 0 && 'border-border border-t')}
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-1 text-fg">{row.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Tag tone="open">{row.status}</Tag>
                <Tag tone="neutral">{row.kind}</Tag>
              </div>
            </div>
            <span className="text-body-2 text-fg shrink-0 font-semibold tabular-nums">
              {row.distance}
            </span>
          </li>
        ))}
      </ul>
      <p className={cn('text-caption text-fg-muted pt-3 pb-4 font-medium', INSET_CLASS.card)}>
        {specimen.emergencyNote}
      </p>
    </Surface>
  )
}
