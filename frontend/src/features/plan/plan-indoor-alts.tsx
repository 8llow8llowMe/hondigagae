'use client'

import Link from 'next/link'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { RainIcon } from '@/components/icons'
import { formatDistance } from '@/lib/format/distance'
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
 * 계약이 주는 것은 `placeId` · `title` · `lat` · `lng` · `distanceMeters` 다.
 * **주소·실내 여부만 보강(`GET /places/{id}`)에서 온다** — 상세 항목 보강과 **같은 캐시**를
 * 쓰므로(`placeKeys.detail`) 이미 담긴 대안은 요청이 아예 나가지 않는다. 보강이 실패하면
 * 제목과 거리만 남고 행은 살아 있다.
 *
 * **거리에 `직선` 을 반드시 붙인다.** 서버가 `GeoDistance.meters()` 하버사인으로 재므로
 * 직선거리이고, 제주는 산간·해안도로가 많아 주행거리와 크게 다르다 (D3).
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
  /** placeId → 보강 결과. 없으면 그 행은 제목과 거리만 남는다 */
  places: Map<string, PlaceDetail>
  /** **그 일자에** 이미 담긴 장소. 서버가 중복을 막지 않아 화면이 막는다 (F5-4) */
  addedPlaceIds: Set<string>
  /** **이 일자에서** 담는 중인 장소. 다른 일자의 진행이 여기 비치면 안 된다 */
  pendingPlaceId: string | null
  /** 다른 담기가 진행 중이면 전부 잠근다 — 일괄 교체라 동시에 두 개를 보내면 하나가 진다 */
  disabled: boolean
  /** **이 일자에서** 난 실패만 온다 */
  error: PlanDaySaveError | null
  onAdd: (alternative: PlanAlternativePlaceItem) => void
}) {
  if (alternatives.length === 0) return null

  return (
    /*
      **면으로 묶는다** (#856). 예전에는 `border-t` 1px 하나로만 갈렸는데 그 선이 **항목 행
      사이 구분선과 색·굵기가 같아**, 담긴 일정이 아니라 **제안**이라는 사실을 말하는 신호가
      제목 글자 하나뿐이었다 — 훑으면 "다음 항목" 으로 읽힌다.

      **`--band` 는 L2(아이템 채움)라 3층 표면 규칙 안이다** (DESIGN.md §0). 판정 밴드가
      카드 안에서 tint 면으로 자기 영역을 갖는 것과 같은 문법이고, 이쪽은 등급이 아니라
      제안이라 등급 tint 가 아닌 중립 면을 쓴다.
    */
    <div className="bg-band mt-4 rounded-md px-4 py-3">
      <h4 className="text-caption text-fg-muted flex items-center gap-1.5 font-semibold">
        {/*
          조건(비)을 낱말보다 먼저 말한다 — 제목이 이미 낱말로 말하므로 장식이다
          (`Svg` 가 `aria-hidden` 을 이미 준다). **저장소 아이콘 세트의 `RainIcon` 이다** —
          같은 조건을 홈 날씨 줄이 같은 그림으로 말한다.
        */}
        <RainIcon size={14} className="shrink-0" />
        {messages.plan.indoorAlternativesTitle}
      </h4>

      {/*
        **줄 사이 선은 `ul` 이 갖고 첫 줄은 받지 않는다** — 저장소 공통 패턴이다
        (`plan-overview-panel.tsx` 의 목차와 같다). 면이 블록을 묶고 선이 그 안을 나눈다.

        **선 색이 `--border` 가 아니다.** `--band` 면 위에서 `--border`(#e3e5ea)는 면보다
        밝아 묻힌다 — 한 단 진한 `--border-strong` 을 쓴다.
      */}
      <ul className="[&>li+li]:border-border-strong mt-1 flex flex-col [&>li+li]:border-t">
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
  /*
    주소는 보강에서 오고 거리는 계약에서 온다 — **거리는 보강을 기다리지 않는다.**
    nullable 은 에러가 아니라 숨김이라, 주소가 없으면 그 조각만 빠진다.
  */
  const meta = [
    place === undefined ? null : shortAddress(place.addr1),
    messages.plan.distanceStraight.replace(
      '{distance}',
      formatDistance(alternative.distanceMeters),
    ),
  ].filter((part): part is string => part !== null)

  return (
    <li className="flex items-center gap-3">
      {/* min-h-11 — 보강 전이라 주소 줄이 없어도 44px 터치 영역을 잃지 않는다 (DESIGN.md §7) */}
      <Link
        href={`/places/${alternative.placeId}`}
        className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 min-h-11 min-w-0 flex-1 py-2 font-medium break-keep focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="block">{alternative.title}</span>
        <span className="text-caption text-fg-muted block font-medium">{meta.join(' · ')}</span>
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
