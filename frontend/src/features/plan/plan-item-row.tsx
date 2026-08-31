import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ImageIcon } from '@/components/icons'
import { Row } from '@/components/surface'
import { formatDistance } from '@/lib/format/distance'
import { isLongTrip } from '@/lib/geo/distance'
import { isAllowedImageHost } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { isPlaceTarget, type PlanItemRowModel } from '@/lib/plan/detail'
import { cn } from '@/lib/utils/cn'
import type { PlaceDetail } from '@/types/place'

/**
 * 일정 항목 행 — 아트보드 `혼디가개 여행 일정.dc.html` 01·02.
 *
 * **2열이다** (썸네일 · 텍스트). 순번 원 + 썸네일 + 텍스트로 3열을 만들면 390 에서
 * 제목이 눌린다 — **순번은 썸네일 좌상단 칩**으로 얹는다 (아트보드 01 주석).
 *
 * **주소 · 이미지 · 좌표는 `PlanItemDetail` 에 없다.** 항목당 `GET /places/{placeId}`
 * 보강으로 따라오고, 그 조회가 실패하면 `place` 가 `undefined` 인 채로 온다 —
 * **행을 지우지 않고 제목만 남긴다.** 일정 자료는 우리 DB 이고 장소는 다른 서비스다
 * (공통명세 S8).
 *
 * **실내 여부는 아직 못 쓴다.** 명세(D2)는 메타 줄에 `주소 · 실내` 를 적었지만
 * **`PlaceDetail` 에 `indoor` 가 없다** — 목록(`PlaceSummary`)에만 있고 상세 응답에는
 * 빠져 있다. 목록 캐시에서 꺼내 쓰는 우회는 쓰지 않는다(링크 직접 진입·새로고침에서
 * 사라져 같은 화면이 진입 경로에 따라 달라진다 — 장소 상세에서 이미 내린 결정).
 * [#16](https://github.com/8llow8llowMe/hondigagae/issues/16) 이 반영되면 붙인다.
 *
 * **`startTime` 을 표시하지 않는다** — 아트보드 헤더 주석이 "시간 없음" 으로 못박았다
 * (일정상세-세부명세 D8-9).
 */
export function PlanItemRow({
  model,
  place,
  last = false,
}: {
  model: PlanItemRowModel
  /** 보강 결과. 아직 안 왔거나 실패했으면 `undefined` */
  place: PlaceDetail | undefined
  last?: boolean
}) {
  const { item } = model
  const hasImage = isAllowedImageHost(place?.firstImage ?? null)
  // 실내 여부는 상세 응답에 없다 (#16). 주소만 남는다
  const address = shortAddress(place?.addr1 ?? null)

  /*
    **`targetId` 가 있다고 링크하지 않는다.** `WALK` 의 `targetId` 는 `walk_course.id`
    라 `/places/{id}` 로 보내면 남의 id 로 404 를 만든다 — 보강 대상과 같은 판정을 쓴다.
  */
  const href = isPlaceTarget(item) ? `/places/${item.targetId as string}` : null

  const body = (
    <>
      <div className="bg-band relative size-20 shrink-0 overflow-hidden rounded-md lg:size-24">
        {hasImage ? (
          <Image
            src={place?.firstImage as string}
            alt=""
            fill
            sizes="(min-width: 1024px) 96px, 80px"
            className="object-cover"
          />
        ) : (
          <span className="text-fg-subtle absolute inset-0 flex items-center justify-center">
            <ImageIcon size={20} />
          </span>
        )}

        {/* 순번 칩 — 썸네일 좌상단. 자료가 아니라 순서 표시라 a11y 트리에서 뺀다
            (행 순서는 목록 구조가 이미 말한다) */}
        <span
          aria-hidden
          className="bg-fg text-fg-inverse text-caption absolute top-1 left-1 inline-flex size-5 items-center justify-center rounded-sm font-bold tabular-nums"
        >
          {model.item.sequence + 1}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* 공백 없는 긴 한국어 이름(`제주특별자치도립김창열미술관`)이 넘치지 않게
              어절 안에서도 끊을 수 있게 한다 — PlaceRow 와 같은 규칙 */}
          <h4 className="text-title-2 text-fg min-w-0 font-semibold break-words">{item.title}</h4>
          {/* `장소` 는 기본값이라 라벨이 잡음이다. 성격이 다른 유형만 알린다 */}
          {item.itemType.code !== 'PLACE' && <Badge size="sm">{item.itemType.name}</Badge>}
        </div>

        {/* nullable 은 오류가 아니라 숨김이다. 주소가 없으면 줄 자체가 사라진다 */}
        {address !== null && (
          <p className="text-caption text-fg-muted mt-0.5 line-clamp-1 font-medium">{address}</p>
        )}

        <PlanItemDistance model={model} />
      </div>
    </>
  )

  return (
    <Row as="li" last={last}>
      {href === null ? (
        <div className="flex items-start gap-3 py-3 lg:gap-5 lg:py-4">{body}</div>
      ) : (
        // 링크 안에 링크를 넣지 않는다 — 행 전체가 하나의 링크다 (D6)
        <Link
          href={href}
          className="focus-visible:ring-brand-500 flex items-start gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none lg:gap-5 lg:py-4"
        >
          {body}
        </Link>
      )}
    </Row>
  )
}

/**
 * 거리 한 줄.
 *
 * **"직선" 을 반드시 붙인다.** 제주는 산간·해안도로가 많아 직선거리와 주행거리가 크게
 * 다르다 — `4.1km` 만 쓰면 주행거리로 읽힌다 (D3).
 *
 * 30km 이상이면 **그 행만** 경고 톤이다. 별도 경고 배지를 만들지 않는다 — 행 자체가
 * 말하는 것이 편집 동기를 만든다 (아트보드 01 주석). 색만으로 전달하지 않으려고
 * 문장(`— 하루 이동이 깁니다.`)이 함께 간다.
 */
function PlanItemDistance({ model }: { model: PlanItemRowModel }) {
  if (model.distanceKind === null || model.distanceMeters === null) return null

  const distance = formatDistance(model.distanceMeters)
  const template =
    model.distanceKind === 'lodging'
      ? messages.plan.distanceFromLodging
      : messages.plan.distanceFromPrevious
  const long = isLongTrip(model.distanceMeters)

  return (
    <p
      className={cn(
        'text-caption mt-1 font-medium tabular-nums',
        long ? 'text-metric-low-700' : 'text-fg-muted',
      )}
    >
      {template.replace('{distance}', distance)}
      {long && messages.plan.longTripSuffix}
    </p>
  )
}
