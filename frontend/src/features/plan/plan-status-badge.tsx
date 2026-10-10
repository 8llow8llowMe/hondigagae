import { cn } from '@/lib/utils/cn'
import type { CodeNameMetadata } from '@/types/api'

/**
 * 일정 상태 배지 — 아트보드 04·05.
 *
 * **등급 색(초록·주황·빨강)을 쓰지 않는다.** 등급은 판정 전용이고 일정 상태는 판정이
 * 아니라 진행 단계다 (DESIGN.md §2-3). 셋 다 중립색이고 **형태로 구분한다** —
 * 초안은 점선, 확정은 채움, 완료는 반전.
 *
 * 문구는 서버가 준 `status.name` 을 그대로 쓴다. 한국어 매핑 테이블을 만들지 않는다.
 * **서버가 모르는 코드를 내려도 화면이 깨지지 않는다** — 초안과 같은 점선으로 그리고
 * 이름만 그대로 보여준다 (공통명세 S7).
 *
 * `Badge` 를 쓰지 않는 이유: `Badge` 의 4톤은 전부 채움이라 점선·반전을 표현하지 못한다.
 * 크기 값(`px-2 py-1 text-caption`)은 `Badge`/`MetricBadge` 와 **같아야 한다** — 한 줄에
 * 나란히 서는 곳이 있어 값이 갈리면 그 줄이 어긋나 보인다.
 */
const TONE: Record<string, string> = {
  DRAFT: 'border-border-strong text-fg-muted border border-dashed',
  CONFIRMED: 'bg-band text-fg-muted border border-transparent',
  COMPLETED: 'bg-fg text-fg-inverse border border-transparent',
}

export function PlanStatusBadge({
  status,
  className,
}: {
  status: CodeNameMetadata
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-caption inline-flex shrink-0 items-center rounded-sm px-2 py-1 font-semibold whitespace-nowrap',
        // 세 톤 모두 테두리를 갖는다 — 점선만 테두리가 있으면 높이가 2px 갈린다
        TONE[status.code] ?? TONE.DRAFT,
        className,
      )}
    >
      {status.name}
    </span>
  )
}
