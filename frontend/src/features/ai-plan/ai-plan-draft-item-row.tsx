import { Badge } from '@/components/badge'
import { itemTypeLabel } from '@/lib/ai-plan/item-type'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { AiPlanScheduleItem } from '@/types/ai-plan'

export type AiPlanDraftItemRowProps = {
  item: AiPlanScheduleItem
  /** 그 일자 안의 1부터 시작하는 번호 (아트보드 03 의 원형 숫자) */
  ordinal: number
  /**
   * 보강으로 얻은 주소. **초안에 없어 항목당 `GET /places/{placeId}` 로 채운다**
   * (명세 S6). 아직 못 받았거나 `placeId` 가 null 이면 undefined.
   */
  address?: string | undefined
  /**
   * 보강이 **404** 로 실패했는가. `PLAN_004`(delisting) 로 담기가 막힐 때의 원인 후보다
   * (명세 S5 함정 3 · 일자편집 명세 E1).
   */
  delisted?: boolean
  /** 담기에서 빼기로 표시된 항목 */
  excluded?: boolean
}

/**
 * 초안 항목 한 줄 — 아트보드 03.
 *
 * **거리(`4.1km`)와 실내 여부를 표시하지 않는다.**
 *  - 실내: `PlaceDetailResponse` 에 `indoor` 가 없다 (이슈 #16). 목록에만 있다
 *  - 거리: 직선거리 계산은 일정 상세(#80)의 `src/lib/geo/distance.ts` 소관이다.
 *    같은 함수를 두 브랜치가 각자 만들면 반드시 갈린다 — 그쪽이 머지되면 붙인다
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanDraftItemRow({
  item,
  ordinal,
  address,
  delisted = false,
  excluded = false,
}: AiPlanDraftItemRowProps) {
  const typeLabel = itemTypeLabel(item.itemType)
  const note = item.note.trim()

  return (
    <li
      className={cn(
        'border-border flex gap-3 border-b px-4 py-3 last:border-b-0 md:px-10',
        // 빼기로 표시한 항목은 취소선으로 남긴다 — 지우면 무엇을 뺐는지 알 수 없다
        excluded && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className="bg-band text-caption text-fg-muted mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums"
      >
        {ordinal}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('text-body-1 text-fg font-medium', excluded && 'line-through')}>
            {item.title}
          </p>
          {typeLabel !== null && (
            <Badge tone="neutral" size="sm">
              {typeLabel}
            </Badge>
          )}
          {delisted && (
            <Badge tone="danger" size="sm">
              {messages.aiPlan.itemPlaceDelisted}
            </Badge>
          )}
        </div>

        {address !== undefined && <p className="text-caption text-fg-muted mt-0.5">{address}</p>}

        {/* 항목별 이유 — 서버 문구를 그대로 쓴다 */}
        {note !== '' && <p className="text-body-2 text-fg-muted mt-1">{note}</p>}
      </div>
    </li>
  )
}
