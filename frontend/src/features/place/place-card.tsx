import Image from 'next/image'
import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/badge'
import { Card } from '@/components/card'
import { messages } from '@/lib/messages'
import type { PlaceSummary } from '@/types/place'

/**
 * 반려견 동반 등급의 **색만** FE가 매핑한다.
 * 표시 문구는 서버 metadata 의 `name` 을 그대로 쓴다 — api-integration-guide.md §6.
 * 모르는 code 는 기본값으로 떨어져 화면이 비지 않는다 (component-guide.md §4).
 */
const PET_TONE: Record<string, BadgeTone> = {
  ALLOWED: 'brand',
  PARTIALLY_ALLOWED: 'warn',
  NOT_ALLOWED: 'neutral',
}

export function PlaceCard({ place }: { place: PlaceSummary }) {
  const petTone = PET_TONE[place.petAllowanceType.code] ?? 'neutral'

  return (
    <Card variant="interactive">
      <Link
        href={`/places/${place.placeId}`}
        className="focus-visible:ring-brand-500 flex gap-4 rounded-lg p-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="bg-bg-subtle relative h-20 w-20 shrink-0 overflow-hidden rounded-md">
          {place.firstImage === null ? (
            <span className="text-caption text-fg-subtle absolute inset-0 flex items-center justify-center">
              {messages.place.noImage}
            </span>
          ) : (
            <Image
              src={place.firstImage}
              alt=""
              fill
              sizes="80px"
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
            <Badge tone={petTone} size="sm">
              {place.petAllowanceType.name}
            </Badge>
          </div>

          {/* 한국어 실데이터는 길다. 2줄까지 보여주고 넘치면 자른다 (styling-guide.md §4) */}
          <h3 className="text-title-2 text-fg mt-2 line-clamp-2 font-semibold">{place.title}</h3>

          {/* nullable 은 에러가 아니라 숨김이다 */}
          {place.addr1 !== null && (
            <p className="text-body-2 text-fg-muted mt-1 line-clamp-1">{place.addr1}</p>
          )}
          {place.tel !== null && <p className="text-caption text-fg-subtle mt-1">{place.tel}</p>}
        </div>
      </Link>
    </Card>
  )
}
