'use client'

import { Button } from '@/components/button'
import { Row } from '@/components/surface'
import { PlaceRowContent } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import type { PlaceSummary } from '@/types/place'

/**
 * 일정에 담는 목록의 행 — 아트보드 없음(F2 가 새로 정한 화면).
 *
 * **행 전체를 링크로 감싸지 않는다.** `<a>` 안에 `<button>` 을 넣을 수 없기 때문이다.
 * 내용은 `PlaceRowContent` 로 목록 화면과 공유하고, 제목 대신 **행 앞머리에 상세로 가는
 * 링크**를 따로 두는 대신 여기서는 담기 버튼만 남긴다 — 고르는 화면에서 상세로
 * 빠지면 담던 맥락(어느 일자)을 잃는다.
 *
 * 이미 담긴 장소는 **버튼을 없애지 않고 잠근다.** 사라지면 왜 이것만 다른지 알 수 없다.
 */
export function PlanAddPlaceRow({
  place,
  last,
  added,
  pending,
  disabled,
  onAdd,
}: {
  place: PlaceSummary
  last: boolean
  /** **그 일자에** 이미 담겼다. 서버가 중복을 막지 않아 화면이 막는다 (F5-4) */
  added: boolean
  pending: boolean
  /** 다른 담기가 진행 중 — 일괄 교체라 동시에 두 개를 보내면 하나가 진다 */
  disabled: boolean
  onAdd: (place: PlaceSummary) => void
}) {
  return (
    <Row as="li" last={last}>
      <div className="flex items-center gap-3 py-3 lg:gap-5 lg:py-4">
        <PlaceRowContent place={place} />

        {added ? (
          <span className="text-caption text-fg-muted shrink-0 font-medium">
            {messages.plan.addPlaceAlready}
          </span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            loading={pending}
            disabled={disabled && !pending}
            aria-label={messages.plan.addPlaceLabel.replace('{title}', place.title)}
            onClick={() => onAdd(place)}
          >
            {messages.plan.addPlaceShort}
          </Button>
        )}
      </div>
    </Row>
  )
}
