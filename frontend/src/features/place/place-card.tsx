import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Card } from '@/components/card'
import { petTone } from '@/features/place/pet-tone'
import { isAllowedImageHost } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import type { PlaceSummary } from '@/types/place'

export function PlaceCard({ place }: { place: PlaceSummary }) {
  const tone = petTone(place.petAllowanceType.code)

  return (
    <Card variant="interactive">
      <Link
        href={`/places/${place.placeId}`}
        className="focus-visible:ring-brand-500 flex gap-4 rounded-lg p-4 focus-visible:ring-2 focus-visible:outline-none md:gap-5 md:p-5"
      >
        <div className="bg-bg-subtle relative h-20 w-20 shrink-0 overflow-hidden rounded-md md:h-24 md:w-24">
          {/* 미등록 호스트를 next/image 에 넘기면 런타임에 던진다 — 플레이스홀더로 떨어뜨린다 */}
          {!isAllowedImageHost(place.firstImage) || place.firstImage === null ? (
            <span className="text-caption text-fg-muted absolute inset-0 flex items-center justify-center">
              {messages.place.noImage}
            </span>
          ) : (
            <Image
              src={place.firstImage}
              alt=""
              fill
              sizes="(min-width: 768px) 96px, 80px"
              className="object-cover"
              unoptimized={false}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone="neutral" size="sm">
              {place.contentType.name}
            </Badge>
            <Badge tone={tone} size="sm">
              {place.petAllowanceType.name}
            </Badge>
          </div>

          {/* 한국어 실데이터는 길다. 2줄까지 보여주고 넘치면 자른다 (styling-guide.md §4).
              body 의 word-break: keep-all 은 어절 단위로만 끊으므로
              `제주특별자치도립김창열미술관` 처럼 공백 없는 긴 이름이 가로로 넘친다.
              break-words 로 "다른 방법이 없을 때만" 어절 안에서 끊게 한다. */}
          <h3 className="text-title-2 text-fg mt-2 line-clamp-2 font-semibold break-words">
            {place.title}
          </h3>

          {/* nullable 은 에러가 아니라 숨김이다 */}
          {place.addr1 !== null && (
            <p className="text-body-2 text-fg-muted mt-1 line-clamp-1">{place.addr1}</p>
          )}
          {place.tel !== null && (
            <p className="text-caption text-fg-muted mt-1 font-medium">{place.tel}</p>
          )}
        </div>
      </Link>
    </Card>
  )
}
