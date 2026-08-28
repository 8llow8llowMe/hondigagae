import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Row } from '@/components/surface'
import { isAllowedImageHost } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import type { PlaceSummary } from '@/types/place'

/**
 * PlaceRow — **카드가 아니라 행이다** (디자인 가이드 §5).
 *
 * 테두리·라운드·그림자 없이 전폭으로 놓고 구분선으로 나눈다. `place-card.tsx` 를
 * 대체한다 (DESIGN.md §0).
 *
 * 썸네일 80(모바일) / 96(데스크톱) · radius 8. **`firstImage` 가 null 이어도 같은
 * 크기의 "이미지 없음" 타일을 남긴다** — 행 높이가 흔들리면 목록을 훑을 수 없다.
 * (장소 상세의 `PhotoGallery` 는 반대다. 0장이면 섹션을 아예 렌더하지 않는다.)
 *
 * **목록 API 가 적합도 점수를 주지 않으므로 배지·점수를 그리지 않는다** —
 * 근거를 댈 수 없다. 적합도는 상세에서만 말한다 (docs/screen-inventory.md §3).
 */
export function PlaceRow({ place, last = false }: { place: PlaceSummary; last?: boolean }) {
  const hasImage = isAllowedImageHost(place.firstImage) && place.firstImage !== null

  return (
    <Row as="li" last={last}>
      <Link
        href={`/places/${place.placeId}`}
        className="focus-visible:ring-brand-500 flex gap-4 py-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="bg-band relative h-20 w-20 shrink-0 overflow-hidden rounded-md md:h-24 md:w-24">
          {/* 미등록 호스트를 next/image 에 넘기면 런타임에 던진다 — 플레이스홀더로 떨어뜨린다 */}
          {hasImage ? (
            <Image
              src={place.firstImage as string}
              alt=""
              fill
              sizes="(min-width: 768px) 96px, 80px"
              className="object-cover"
            />
          ) : (
            <span className="text-caption text-fg-muted absolute inset-0 flex items-center justify-center">
              {messages.place.noImage}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* 한국어 실데이터는 길다. body 의 word-break: keep-all 은 어절 단위로만
              끊으므로 `제주특별자치도립김창열미술관` 처럼 공백 없는 긴 이름이 넘친다.
              break-words 로 "다른 방법이 없을 때만" 어절 안에서 끊게 한다. */}
          <h3 className="text-title-2 text-fg line-clamp-2 font-semibold break-words">
            {place.title}
          </h3>

          {/* nullable 은 에러가 아니라 숨김이다 */}
          {place.addr1 !== null && (
            <p className="text-body-2 text-fg-muted mt-1 line-clamp-1">{place.addr1}</p>
          )}

          {/* 태그는 최대 3개. 동반 가능 여부를 첫 태그로 — 가이드 §5 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* 동반 가능 여부를 첫 태그로 — 가이드 §5.
                등급 색을 쓰지 않는다. 동반 가능/불가는 적합도 등급이 아니라 장소의
                속성이고, 색을 주면 사용자가 그것을 적합도 신호로 읽는다.
                구분은 서버 `name` 문구가 맡는다 (DESIGN.md §2-3). */}
            <Badge tone="neutral" size="sm">
              {place.petAllowanceType.name}
            </Badge>
            <Badge tone="neutral" size="sm">
              {place.contentType.name}
            </Badge>
          </div>
        </div>
      </Link>
    </Row>
  )
}
