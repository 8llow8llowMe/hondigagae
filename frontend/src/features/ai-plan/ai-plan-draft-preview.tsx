import { Badge } from '@/components/badge'
import { EmptyState } from '@/components/empty-state'
import { ReasonList } from '@/components/reason-list'
import { Surface, SurfaceList } from '@/components/surface'
import { AiPlanDraftItemRow } from '@/features/ai-plan/ai-plan-draft-item-row'
import { formatBudget } from '@/lib/ai-plan/budget'
import { draftItemDistances } from '@/lib/ai-plan/draft-distance'
import { draftItemCount } from '@/lib/ai-plan/draft-to-plan'
import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { formatPlanDateRange } from '@/lib/plan/date'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { AiPlanDraft, AiPlanScheduleItem } from '@/types/ai-plan'

export type AiPlanDraftPreviewProps = {
  draft: AiPlanDraft
  title: string
  startDate: string
  endDate: string
  /** 원 단위. 정하지 않았으면 null */
  budget: number | null
  /** 기간에서 센 총 일수. 못 셌으면 null */
  totalDays: number | null
  /**
   * `placeId` → 메타 줄 (`제주시 한림읍 · 야외`). 보강 결과 (명세 S6 · #112).
   * 조립은 `use-draft-places.ts` 가 한다 — 이 컴포넌트는 표시 전용이다.
   */
  metaLines: ReadonlyMap<string, string>
  /**
   * `placeId` → 좌표. 같은 보강 결과에서 나온다 (#100). **없는 항목은 거리 줄이 없다** —
   * 보강이 아직이거나 실패했거나 원천에 좌표가 없는 경우다.
   */
  coords: ReadonlyMap<string, LatLng>
  /**
   * 담을 수 없는 `placeId` — `PLAN_004` 원인 후보. 상세 응답의 `delisted: true`(200)와
   * 병합(404)이 함께 들어 있다 (#146)
   */
  delistedPlaceIds: ReadonlySet<string>
  /** 담기에서 빼기로 표시한 `placeId` */
  excludedPlaceIds: ReadonlySet<string>
}

/**
 * 초안 미리보기 — 아트보드 03 · 명세 S6.
 *
 * 아트보드에서 빼는 것 (명세 S2):
 *  - **일자별 적합도 배지(`주의`·`양호`)** — 판정은 `GET /plans/{planId}/weather` 인데
 *    담기 전에는 `planId` 가 없다
 *  - **`이 날 다시 만들기`** — 일자 단위 재생성은 `planId` 가 필요해 담은 뒤에만 가능하다
 *    (계약은 `af86c98` 에서 생겼다. 명세 S2 의 "재생성 API 가 없다" 는 낡았다)
 *  - **`이 날 산책`** — 대상 `placeId` 를 고를 근거가 초안에 없다
 *  - **`말로 고치기`** — 수정 API 가 없다
 *
 * **카드 여럿이다** (`DESIGN.md §0`, #473). 개요(제목 · AI 배지 · 요약 · 미저장 문구 ·
 * 부분 생성 · `reasons`)가 카드 하나, 그 다음은 **일자마다 카드 하나**다 (#447 이
 * `PlanDaySection` 에 내린 결정과 같다 — 일자는 자기 제목이 있고, 혼자 떼어놔도 말이 되며,
 * 담는 항목이 여럿이라 판정 3문을 통과한다).
 *
 * **`SurfaceStack` 을 여기서 그리지 않는다.** 담는 쪽(`AiPlanJobView` 의 껍데기)이 이미
 * 스택이라, 여기서 래퍼를 하나 더 두면 카드 사이 간격을 스택이 주지 못하고 담기 패널이
 * 그 래퍼 밖으로 밀린다. fragment 로 카드들을 그대로 내보낸다.
 *
 * **담기 패널을 받지 않는다** — `footer` prop 을 걷었다. 액션은 카드가 아니라 카드 밖
 * L0 이고, 그 배치는 담는 쪽이 갖는다 (#464 가 `PetForm` 의 `footer` 를 걷은 것과 같다).
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanDraftPreview({
  draft,
  title,
  startDate,
  endDate,
  budget,
  totalDays,
  metaLines,
  coords,
  delistedPlaceIds,
  excludedPlaceIds,
}: AiPlanDraftPreviewProps) {
  const itemCount = draftItemCount(draft)
  const budgetLabel = formatBudget(budget)
  const madeDays = draft.days.length

  /*
    **조각을 조립한다.** 조건을 잃으면 기간을 모르는데(명세 S5 함정 1), 한 문장에
    기간을 박아 두면 그때 빈 구분자가 남는다.
  */
  const summary = [
    startDate === '' || endDate === '' ? null : formatPlanDateRange(startDate, endDate),
    messages.aiPlan.previewArea,
    messages.aiPlan.previewItemCount.replace('{count}', String(itemCount)),
    budgetLabel === null ? null : messages.aiPlan.previewBudget.replace('{budget}', budgetLabel),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  /**
   * **`days` 가 여행 일수보다 적어도 감추지 않는다** (명세 S6). `status` 는 `COMPLETED`
   * 인데 일부 일자가 비는 경우다 — 그대로 말하고 나머지는 담은 뒤에 채우라고 안내한다.
   */
  const partial = totalDays !== null && madeDays < totalDays

  /*
    **`placeId` 가 없는 항목은 좌표도 없다.** `MOVE` 다 — 초안에 `WALK` 는 오지 않고(#89),
    나머지 유형은 후보 밖 장소라 연결이 끊긴 경우에만 `placeId` 가 비어 있다.
  */
  const coordOf = (item: AiPlanScheduleItem): LatLng | null =>
    item.placeId === null ? null : (coords.get(item.placeId) ?? null)

  if (madeDays === 0) {
    /*
      **빈 초안도 카드 안이다** (#440 판단). 카드 밖에 두면 이 갈래에서만 화면의 흰 면이
      통째로 사라진다 — 담기 패널은 여전히 카드 밖 L0 에 서 있으므로 흰 면이 하나도 없는
      화면이 된다. 머리가 이름을 이미 그리므로 카드는 `aria-label` 만 갖는다.
    */
    return (
      <Surface aria-label={messages.aiPlan.previewTitle}>
        <EmptyState
          inset="card"
          title={messages.aiPlan.emptyDraftTitle}
          description={messages.aiPlan.emptyDraftDescription}
        />
      </Surface>
    )
  }

  return (
    <>
      {/*
        **개요 카드.** `Surface` 의 `title` 슬롯을 쓰지 않는다 — 제목 옆에 AI 배지가 붙고
        390 에서 배지가 다음 줄로 접혀야 해서 그 슬롯(제목 + 우측 액션, 접히지 않음)에
        맞지 않는다 (#447 `PlanDaySection` 과 같은 이유).

        그래서 `aria-label` 이 아니라 **`titleId`** 를 준다: `Surface` 는 `title` 유무와
        무관하게 `aria-labelledby={titleId}` 를 걸므로, 카드의 이름이 **아래 보이는 `h2`
        그 자체**가 된다. `aria-label` 로 이름을 따로 적으면 사용자가 고친 제목과 카드
        이름이 갈리고, 제목을 비우면 이름이 빈 문자열이 된다.
      */}
      <Surface titleId={DRAFT_HEADING_ID}>
        <header className={cn('flex flex-col gap-2 pt-5 pb-4', INSET_CLASS.card)}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={DRAFT_HEADING_ID} className="text-title-1 text-fg font-bold break-keep">
              {title}
            </h2>
            {/* accent 는 "AI 가 만든 것" 표시 전용이다 (DESIGN.md §2-5 · 아트보드 03 주석) */}
            <Badge tone="accent">{messages.aiPlan.draftBadge}</Badge>
          </div>

          <p className="text-caption text-fg-muted tabular-nums">{summary}</p>

          {/* 저장 시점을 반복해 말한다 — 아트보드 03 주석 */}
          <p className="text-caption text-fg-subtle">{messages.aiPlan.previewNotSaved}</p>
        </header>

        {/*
          **`bg-band` 는 카드 안 L2 채움이라 그대로 둔다** (§0 "같은 카드 안을 나눈다 —
          1px 구분선 또는 `--band` 채움"). 좌우 마진만 카드 인셋으로 바꿨다.
        */}
        {partial && (
          <div className={cn('mb-4', INSET_CLASS.card)}>
            <div className="bg-band rounded-md px-3 py-2">
              <p className="text-body-2 text-fg font-medium">
                {messages.aiPlan.partialDays
                  .replace('{total}', String(totalDays))
                  .replace('{made}', String(madeDays))}
              </p>
              <p className="text-caption text-fg-muted mt-1">
                {messages.aiPlan.partialDaysDescription}
              </p>
            </div>
          </div>
        )}

        {/*
          `reasons` 는 **초안 전체에 대한 XAI 라 일자별이 아니다** → 개요 카드에 한 번 낸다
          (명세 S6). 서버 순서를 재정렬하지 않고 문장도 그대로 쓴다.
        */}
        {draft.reasons.length > 0 && (
          <section className={cn('pb-5', INSET_CLASS.card)}>
            <h3 className="text-body-1 text-fg mb-2 font-semibold">
              {messages.aiPlan.reasonsTitle}
            </h3>
            <ReasonList
              reasons={draft.reasons.map((reason) => ({ description: reason.description }))}
            />
          </section>
        )}
      </Surface>

      {draft.days.map((dayItem) => {
        /*
          **거리는 일자 안에서만 잰다.** 일자 경계를 넘겨 재면 전날 마지막 항목에서
          다음 날 첫 항목까지가 "이동" 으로 읽히는데, 그 사이에는 숙박이 있다.
          빼기로 표시한 항목도 순서에서 빼지 않는다 — 취소선으로 남아 있는 행이라
          거리만 다시 이어 붙이면 화면과 어긋난다.
        */
        const distances = draftItemDistances(dayItem.items, coordOf)
        const dayLabel = messages.aiPlan.dayLabel.replace('{day}', String(dayItem.day))

        return (
          /*
            **일자마다 카드 하나** (#447 과 같은 결정). 제목이 `h3` 에서 `h2` 로 올라간다 —
            카드의 제목이므로, 그리고 옆 개요 카드의 제목과 같은 레벨이어야 한다.
            `Surface` 의 `title` 슬롯이 그 `h2` 와 `pb-3` 을 그려 준다.
          */
          <Surface key={dayItem.day} title={dayLabel}>
            {/* 항목 목록은 카드 폭을 다 쓰고 위 1px 선으로 제목과 갈린다 (#447) */}
            <SurfaceList className="border-border border-t">
              {dayItem.items.map((item, index) => (
                <AiPlanDraftItemRow
                  key={`${dayItem.day}-${index}-${item.title}`}
                  item={item}
                  ordinal={index + 1}
                  meta={item.placeId === null ? undefined : metaLines.get(item.placeId)}
                  distanceMeters={distances[index] ?? null}
                  delisted={item.placeId !== null && delistedPlaceIds.has(item.placeId)}
                  excluded={item.placeId !== null && excludedPlaceIds.has(item.placeId)}
                />
              ))}
            </SurfaceList>
          </Surface>
        )
      })}
    </>
  )
}

/** 개요 카드가 `aria-labelledby` 로 가리키는 `h2` 의 id */
const DRAFT_HEADING_ID = 'ai-plan-draft-heading'
