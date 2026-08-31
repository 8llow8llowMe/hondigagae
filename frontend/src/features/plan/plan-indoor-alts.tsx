'use client'

import Link from 'next/link'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import type { PlaceDetail } from '@/types/place'
import type { PlanAlternativePlaceItem } from '@/types/plan'

/**
 * 비 예보일 때의 실내 대안 — 아트보드 01 · 세부명세 F1.
 *
 * **비면 블록을 렌더하지 않는다.** 비 예보가 없는 일자에 빈 제목만 남으면
 * "대안이 없다" 로 읽힌다 — 사실은 필요가 없는 것이다.
 *
 * 계약은 `{placeId, title}` 뿐이라 **주소·실내 여부는 보강(`GET /places/{id}`)에서 온다.**
 * 상세 항목 보강과 **같은 캐시**를 쓴다(`placeKeys.detail`) — 이미 담긴 대안은 요청이
 * 아예 나가지 않는다. 보강이 실패하면 제목만 남고 행은 살아 있다.
 *
 * **아트보드의 `· 12.4km` 는 붙이지 않는다.** 계약에도 명세에도 그 거리의 기준점이 없다
 * (그날 첫 항목인지 숙소인지 정해지지 않았다). 근거 없는 숫자를 만들지 않는다.
 *
 * 담기 실패는 **토스트가 아니라 이 자리에 남는다** — `components/toast.tsx` 가
 * "오류를 토스트로 말하지 않는다"(사라지는 UI 에 복구 수단을 두지 않는다)를 못박고 있다.
 * 성공만 토스트다. 재시도는 같은 `담기` 버튼을 다시 누르는 것이다.
 */
export function PlanIndoorAlternatives({
  alternatives,
  places,
  addedPlaceIds,
  pendingPlaceId,
  disabled,
  error,
  onAdd,
}: {
  alternatives: PlanAlternativePlaceItem[]
  /** placeId → 보강 결과. 없으면 그 행은 제목만 남는다 */
  places: Map<string, PlaceDetail>
  /** **그 일자에** 이미 담긴 장소. 서버가 중복을 막지 않아 화면이 막는다 (F5-4) */
  addedPlaceIds: Set<string>
  /** 담는 중인 장소. 그 버튼만 진행 표시를 낸다 */
  pendingPlaceId: string | null
  /** 다른 담기가 진행 중이면 전부 잠근다 — 일괄 교체라 동시에 두 개를 보내면 하나가 진다 */
  disabled: boolean
  error: PlanDaySaveError | null
  onAdd: (alternative: PlanAlternativePlaceItem) => void
}) {
  if (alternatives.length === 0) return null

  return (
    <div className="border-border border-t py-4">
      <h4 className="text-caption text-fg-muted font-semibold">
        {messages.plan.indoorAlternativesTitle}
      </h4>

      <ul className="mt-2 flex flex-col">
        {alternatives.map((alternative) => (
          <PlanIndoorAlternativeRow
            key={alternative.placeId}
            alternative={alternative}
            place={places.get(alternative.placeId)}
            added={addedPlaceIds.has(alternative.placeId)}
            pending={pendingPlaceId === alternative.placeId}
            disabled={disabled}
            onAdd={onAdd}
          />
        ))}
      </ul>

      {error !== null && (
        <FormAlert
          className="mt-2"
          message={
            error.retriable ? `${messages.plan.addPlaceErrorTitle} ${error.message}` : error.message
          }
        />
      )}
    </div>
  )
}

function PlanIndoorAlternativeRow({
  alternative,
  place,
  added,
  pending,
  disabled,
  onAdd,
}: {
  alternative: PlanAlternativePlaceItem
  place: PlaceDetail | undefined
  added: boolean
  pending: boolean
  disabled: boolean
  onAdd: (alternative: PlanAlternativePlaceItem) => void
}) {
  // 보강 전·실패면 줄 자체가 사라진다. nullable 은 에러가 아니라 숨김이다
  const meta = place === undefined ? null : shortAddress(place.addr1)

  return (
    <li className="flex items-center gap-3">
      <Link
        href={`/places/${alternative.placeId}`}
        className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 min-w-0 flex-1 py-2 font-medium break-keep focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="block">{alternative.title}</span>
        {meta !== null && (
          <span className="text-caption text-fg-muted block font-medium">{meta}</span>
        )}
      </Link>

      {/*
        이미 담긴 것은 **버튼을 없애지 않고 잠근다.** 사라지면 "왜 이것만 담기가 없지" 가
        되고, 잠긴 채 문구를 달면 이유가 그 자리에 남는다 (F4).
      */}
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
          aria-label={messages.plan.addPlaceLabel.replace('{title}', alternative.title)}
          onClick={() => onAdd(alternative)}
        >
          {messages.plan.addPlaceShort}
        </Button>
      )}
    </li>
  )
}
