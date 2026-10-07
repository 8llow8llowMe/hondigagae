import { Badge } from '@/components/badge'
import { directionsUrl } from '@/lib/geo/map-link'
import { messages } from '@/lib/messages'
import { hoursHeadline } from '@/lib/place/hours'
import { cn } from '@/lib/utils/cn'

/**
 * 방문 핵심 줄 — 운영 · 전화 · 길찾기 (#1226).
 *
 * **"지금 갈 수 있나" 를 제목 바로 아래에서 답한다.** 예전에는 이 셋이 혼잡도 카드 뒤
 * `방문 정보` 카드에만 있어 1440 에서 스크롤 두 번 아래였다. 방문 정보 카드는 그대로
 * 전문(휴무 · 주차 · 지도)을 말하고, 여기는 **한 줄 요약**만 든다.
 *
 * **배지가 아니라 평문 줄이다.** 제목 옆 등급 배지 자리는 판정 축이고(세부명세 D5-5),
 * 영업 여부는 판정이 아니라 속성이다 — 배지는 `영업 중` 같은 판정값에만 쓰고 그것도
 * 운영시간 행과 같은 `neutral` 이다 (등급 색 금지).
 *
 * **값이 없는 칸은 빠지고, 셋 다 없으면 줄이 서지 않는다** (`null`).
 *
 * #1227 지도 미리보기 패널이 같은 줄을 쓴다 — 그래서 `PlaceDetail` 전체가 아니라 필요한
 * 값만 받는다.
 */
export function PlaceVisitKeyLine({
  name,
  open24,
  openNow,
  useTime,
  tel,
  lat,
  lng,
  className,
}: {
  name: string
  open24: boolean | null
  openNow: boolean | null
  useTime: string | null
  tel: string | null
  lat: number | null
  lng: number | null
  className?: string
}) {
  const hours = hoursHeadline(useTime)
  const href = directionsUrl({ name, lat, lng })
  /*
    판정값의 조합 규칙은 운영시간 행(`PlaceOpenStatus`)과 같다 — `open24` 면 `openNow` 를
    말하지 않는다. `null` 은 그리지 않는다 (세부명세 D5-5 "`null` 을 드러내지 않는다").

    **원문이 없으면 판정도 없다** — 운영시간 행이 원문 없이 사라질 때 판정값도 함께
    사라지는 것과 같다. 근거 없이 판정만 서면 아래 카드와 위가 다른 말을 한다.
  */
  const status =
    hours === null
      ? null
      : open24 === true
        ? messages.place.detailOpen24
        : openNow === null
          ? null
          : openNow
            ? messages.place.detailOpenNow
            : messages.place.detailOpenClosed
  /* 24시간이면 원문도 같은 말이라 배지 하나로 끝낸다 */
  const showHours = hours !== null && open24 !== true

  if (status === null && !showHours && tel === null && href === null) return null

  return (
    // 세로 간격을 두지 않는다 — 칸마다 터치 높이 44 가 이미 줄 사이를 벌린다
    <div className={cn('text-body-2 text-fg flex flex-wrap items-center gap-x-4', className)}>
      {(status !== null || showHours) && (
        <span className="inline-flex min-h-11 min-w-0 items-center gap-2">
          {status !== null && (
            <Badge tone="neutral" className={openNow === true ? 'font-semibold' : ''}>
              {status}
            </Badge>
          )}
          {showHours && <span className="min-w-0 break-keep">{hours}</span>}
        </span>
      )}

      {tel !== null && (
        <a
          href={`tel:${tel.replace(/[^\d+]/g, '')}`}
          // 높이 44 — 상세에서 전화는 주요 행동이다 (`TelLink` 와 같은 이유, #883)
          className="text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none"
        >
          {tel}
        </a>
      )}

      {href !== null && (
        <a
          href={href}
          target="_blank"
          // 외부 지도 앱 링크다. opener 를 넘기지 않는다 (`PlaceMiniMap` 과 같다)
          rel="noopener noreferrer"
          className="text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.map.directions}
        </a>
      )}
    </div>
  )
}
