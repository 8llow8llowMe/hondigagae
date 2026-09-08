import { Badge } from '@/components/badge'
import { itemTypeLabel } from '@/lib/ai-plan/item-type'
import { formatDistance } from '@/lib/format/distance'
import { isLongTrip } from '@/lib/geo/distance'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { AiPlanScheduleItem } from '@/types/ai-plan'

export type AiPlanDraftItemRowProps = {
  item: AiPlanScheduleItem
  /** 그 일자 안의 1부터 시작하는 번호 (아트보드 03 의 원형 숫자) */
  ordinal: number
  /**
   * 보강으로 얻은 메타 줄 (`제주시 한림읍 · 야외`). **초안에 없어 항목당
   * `GET /places/{placeId}` 로 채운다** (명세 S6). 아직 못 받았거나 `placeId` 가 null 이면
   * undefined. 조립은 `use-draft-places.ts` 가 한다.
   */
  meta?: string | undefined
  /**
   * 담을 수 없는 장소인가 — 상세 응답의 `delisted: true`(원천에서 사라짐) 또는 **404**
   * (병합). `PLAN_004` 로 담기가 막힐 때의 원인 후보다 (명세 S5 함정 3 · 일자편집 명세 E1).
   *
   * **404 만으로 판정하지 않는다** — delisted 장소의 상세는 200 으로 온다 (#146).
   */
  delisted?: boolean
  /** 담기에서 빼기로 표시된 항목 */
  excluded?: boolean
  /**
   * 직전 항목으로부터의 **직선**거리(m). 기준이나 좌표가 없으면 `null` 이고 그때 줄이
   * 사라진다 — 계산과 그 판정은 `lib/ai-plan/draft-distance.ts` 가 한다 (#100).
   */
  distanceMeters?: number | null
}

/**
 * 초안 항목 한 줄 — 아트보드 03.
 *
 * 메타 줄은 `주소 · 실내` 다 — `indoor` 가 #16 으로 상세 응답에 들어왔다 (#112).
 * **`null` 이면 낱말이 빠진다**: 여기에는 실내 필터가 없어 "미확인" 배지를 둘 자리가 없고,
 * `false`(야외)로 단정하지도 않는다 (`lib/place/indoor.ts`).
 *
 * 거리는 붙인다 (#100). **문구·임계값을 일정 상세와 공유한다** — 두 화면이 같은 초안을
 * 두 말로 말하지 않게 `messages.plan` 과 `lib/geo/distance.ts` 를 그대로 쓴다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanDraftItemRow({
  item,
  ordinal,
  meta,
  delisted = false,
  excluded = false,
  distanceMeters = null,
}: AiPlanDraftItemRowProps) {
  const typeLabel = itemTypeLabel(item.itemType)
  // **`title`/`note` 는 nullable 이다** — 서버 DTO 에 제약이 없다 (`types/ai-plan.ts`)
  const title = (item.title ?? '').trim()
  const note = (item.note ?? '').trim()

  return (
    <li
      className={cn(
        'border-border flex gap-3 border-b px-4 py-3 last:border-b-0 md:px-10',
        // 빼기로 표시한 항목은 취소선으로 남긴다 — 지우면 무엇을 뺐는지 알 수 없다
        excluded && 'opacity-60',
      )}
    >
      {/*
        **보정이 필요 없다** (#334). 24px 배지와 옆 제목 줄(`body-1` 16/24)의 높이가 같아
        이상값이 0 이다 — 예전 `mt-0.5` 는 배지를 2px 내려 놓고 있었다.
      */}
      <span
        aria-hidden
        className="bg-band text-caption text-fg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums"
      >
        {ordinal}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('text-body-1 text-fg font-medium', excluded && 'line-through')}>
            {title === '' ? messages.aiPlan.itemTitleUnknown : title}
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

        {meta !== undefined && <p className="text-caption text-fg-muted mt-1">{meta}</p>}

        <DraftItemDistance meters={distanceMeters} />

        {/* 항목별 이유 — 서버 문구를 그대로 쓴다 */}
        {note !== '' && <p className="text-body-2 text-fg-muted mt-1">{note}</p>}
      </div>
    </li>
  )
}

/**
 * 거리 한 줄 — `PlanItemDistance` 와 **같은 문구·같은 임계값**이다.
 *
 * **"직선" 을 반드시 붙인다.** 제주는 산간·해안도로가 많아 직선거리와 주행거리가 크게
 * 다르다 — `4.1km` 만 쓰면 주행거리로 읽힌다 (일정상세-세부명세 D3).
 *
 * 30km 이상이면 **그 행만** 경고 톤이다. 색만으로 전달하지 않으려고 문장
 * (`— 하루 이동이 깁니다.`)이 함께 간다.
 *
 * **기준 문구가 `숙소에서` 로 갈리지 않는다** — 초안은 직전 항목만 기준으로 삼는다
 * (`draft-distance.ts` 주석).
 */
function DraftItemDistance({ meters }: { meters: number | null }) {
  if (meters === null) return null

  const long = isLongTrip(meters)

  return (
    <p
      className={cn(
        'text-caption mt-1 font-medium tabular-nums',
        long ? 'text-metric-low-700' : 'text-fg-muted',
      )}
    >
      {messages.plan.distanceFromPrevious.replace('{distance}', formatDistance(meters))}
      {long && messages.plan.longTripSuffix}
    </p>
  )
}
