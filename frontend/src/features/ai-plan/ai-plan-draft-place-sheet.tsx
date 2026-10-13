'use client'

import { Badge } from '@/components/badge'
import { BottomSheet } from '@/components/bottom-sheet'
import { ThumbnailTile } from '@/components/thumbnail-tile'
import type { DraftThumbnail } from '@/lib/ai-plan/draft-thumbnail'
import { itemTypeLabel } from '@/lib/ai-plan/item-type'
import { messages } from '@/lib/messages'
import { planItemIllustration } from '@/lib/plan/illustration'
import type { AiPlanScheduleItem } from '@/types/ai-plan'

/** 시트가 그리는 한 항목 — 미리보기가 이미 가진 값만 모은다. 새 조회를 만들지 않는다 */
export type DraftPlaceSummary = {
  item: AiPlanScheduleItem
  /** 장소 id — 시트는 장소가 있는 항목에서만 열린다 */
  placeId: string
  meta: string | undefined
  thumbnail: DraftThumbnail
  /** 담으면 들어갈 시각 `HH:mm`. 담기가 싣지 않거나 20:00 을 넘으면 null */
  startTime: string | null
  delisted: boolean
  excluded: boolean
}

/**
 * 미리보기 항목의 장소 요약 시트 — #1432 · 명세 S11-2.
 *
 * **시트다, 페이지 이동이 아니다.** 담기 전 상태(고친 제목 · 뺀 항목)는 화면 state 라 `/places/{id}`
 * 로 같은 탭 이동하면 사라진다 — `BottomSheet` 가 "흐름을 잇는 선택" 으로 있는 이유와 같다
 * (DESIGN.md §5-2). 더 보려면 **새 탭**으로 장소 상세를 연다(그 낱말을 버튼에 쓴다).
 *
 * **보강 응답에서 이미 받은 값만 쓴다** — 사진 · 주소 · 실내는 `useDraftPlaces` 가 받은 그대로다.
 * 시트를 위해 상세를 다시 부르지 않는다.
 */
export function AiPlanDraftPlaceSheet({
  summary,
  onClose,
}: {
  /** null 이면 닫혀 있다 */
  summary: DraftPlaceSummary | null
  onClose: () => void
}) {
  const title = summary === null ? '' : summaryTitle(summary.item)

  return (
    <BottomSheet
      open={summary !== null}
      onClose={onClose}
      title={title}
      footer={
        summary === null ? undefined : (
          <a
            href={`/places/${encodeURIComponent(summary.placeId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border-strong text-fg hover:bg-band focus-visible:ring-brand-500 text-body-2 flex h-11 items-center justify-center rounded-md border px-4 font-semibold break-keep focus-visible:ring-2 focus-visible:outline-none"
          >
            {messages.aiPlan.placeSheetOpenDetail}
          </a>
        )
      }
    >
      {summary !== null && <AiPlanDraftPlaceSummary summary={summary} />}
    </BottomSheet>
  )
}

/**
 * 시트 본문 — 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`BottomSheet` 는 열리면 body 로
 * 포털하므로 그것까지는 렌더하지 않는다).
 *
 * 순서는 **사진 · 유형 → 시각 → AI 설명 → 주소** 다. 이 시트를 여는 이유가 "이 장소에 언제 가서
 * 무엇을 하는가" 라서 행과 같은 위계를 따른다 — 주소는 행에도 이미 있다.
 */
export function AiPlanDraftPlaceSummary({ summary }: { summary: DraftPlaceSummary }) {
  const { item, meta, thumbnail, startTime, delisted, excluded } = summary
  const typeLabel = itemTypeLabel(item.itemType)
  const note = (item.note ?? '').trim()
  const illustration = thumbnail === null ? planItemIllustration(item.itemType) : null

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div className="flex items-start gap-3">
        <ThumbnailTile
          src={typeof thumbnail === 'string' ? thumbnail : null}
          illustration={illustration}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
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
          {meta !== undefined && <p className="text-caption text-fg-muted break-words">{meta}</p>}
        </div>
      </div>

      {/*
        **뺀 항목에는 시각을 말하지 않는다** — 담기가 싣지 않는다. 그 사실을 시각 자리에서 말한다.
        시각이 없는 다른 경우(20:00 넘음)는 줄 자체가 없다 — 지어낼 값이 없다.
      */}
      {excluded ? (
        <p className="text-body-2 text-fg-muted">{messages.aiPlan.placeSheetExcluded}</p>
      ) : (
        startTime !== null && (
          <dl className="flex items-baseline gap-2">
            <dt className="text-caption text-fg-muted">{messages.aiPlan.placeSheetTimeLabel}</dt>
            <dd className="text-body-1 text-fg font-semibold tabular-nums">
              <time dateTime={startTime}>{startTime}</time>
            </dd>
          </dl>
        )
      )}

      {note !== '' && (
        <section>
          <h3 className="text-caption text-fg-muted mb-1">{messages.aiPlan.placeSheetNoteLabel}</h3>
          <p className="text-body-2 text-fg break-words">{note}</p>
        </section>
      )}
    </div>
  )
}

function summaryTitle(item: AiPlanScheduleItem): string {
  const title = (item.title ?? '').trim()
  return title === '' ? messages.aiPlan.itemTitleUnknown : title
}
