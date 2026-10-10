import { Surface } from '@/components/surface'
import {
  EMERGENCY_ENTRY_SPECIMEN,
  EMERGENCY_ROWS_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { Tag } from '@/features/about/tag'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 질문 4 의 고정 예시 — 가까운 동물병원·약국 두 줄 (#635, 명세 §5-5).
 *
 * **서버 컴포넌트다.** 상태가 없다 — 거리순으로 이미 정렬된 그림이고 누를 곳이 없다.
 * (`PlacesSpecimen` 은 #916 에서 필터 칩이 눌리며 클라이언트가 됐다.)
 *
 * 거리는 `tabular-nums` 다. 두 줄의 소수점 자리가 어긋나면 거리순이라는 사실이 흐려진다.
 *
 * **스크롤 무대의 단계는 `about-stage-*` 이름 클래스로 받는다** (#914, 명세 2026-09-25 §3-2).
 * 단계 1 위치 점 · 거리순 정렬 → 단계 2 `진료중` → 단계 3 일정 안 진입 행. **DOM 순서는
 * 처음부터 거리순**이고, 단계 0 의 뒤섞임은 `transform` 뿐이다 — 스크린리더가 읽는 순서가
 * 끝 상태다.
 *
 * 진입 행은 **링크가 아니다.** 예시 안에 실제 라우트를 심으면 "이 그림이 그 기능" 으로
 * 읽힌다 — 실제 진입은 절의 `가까운 병원·약국` 링크가 맡는다(`PlanSpecimen` 의 다시 짜기와
 * 같은 이유). 그래서 chevron 도 달지 않는다.
 */
export function EmergencySpecimen() {
  const specimen = messages.about.specimen

  return (
    <Surface aria-label={specimen.emergencyAria} className="-mx-4 md:mx-0">
      <div className={cn('pt-4', INSET_CLASS.card)}>
        <p className="text-title-2 text-fg font-semibold">{specimen.emergencyTitle}</p>
        <p className="text-caption text-fg-muted mt-1 flex items-center gap-2 font-medium">
          <span aria-hidden className="about-stage-locate bg-brand-500 size-2 rounded-full" />
          {specimen.emergencySub}
        </p>
      </div>
      <ul className={cn('pt-3', INSET_CLASS.card)}>
        {EMERGENCY_ROWS_SPECIMEN.map((row, index) => (
          <li
            key={row.name}
            className={cn(
              'about-stage-erow flex items-center gap-3 py-3',
              index > 0 && 'border-border border-t',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-1 text-fg">{row.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Tag tone="open" className="about-stage-open">
                  {row.status}
                </Tag>
                <Tag tone="neutral">{row.kind}</Tag>
              </div>
            </div>
            <span className="about-stage-dist text-body-2 text-fg shrink-0 font-semibold tabular-nums">
              {row.distance}
            </span>
          </li>
        ))}
      </ul>
      <div className={INSET_CLASS.card}>
        <div className="about-stage-entry bg-band flex items-center gap-3 rounded-md px-3 py-2">
          <Tag tone="neutral">{EMERGENCY_ENTRY_SPECIMEN.day}</Tag>
          <span className="text-body-2 text-fg font-semibold">{specimen.emergencyEntry}</span>
        </div>
      </div>
      <p className={cn('text-caption text-fg-muted pt-3 pb-4 font-medium', INSET_CLASS.card)}>
        {specimen.emergencyNote}
      </p>
    </Surface>
  )
}
