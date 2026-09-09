'use client'

import { Badge } from '@/components/badge'
import { CloseIcon, PhoneIcon } from '@/components/icons'
import { formatDistance } from '@/lib/format/distance'
import { directionsUrl } from '@/lib/geo/map-link'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 지도에서 마커를 고르면 뜨는 카드 — 아트보드 `혼디가개 긴급 시설` 02.
 *
 * **선택 카드에서만 길찾기가 노출된다.** 목록 행에는 전화 하나만 남긴다 (아트보드 주석) —
 * 급할 때 누를 것이 둘이면 고르는 데 시간이 든다.
 *
 * **길찾기는 외부 지도 앱 딥링크다.** 경로 안내를 우리가 그리지 않는다. 좌표가 없으면
 * 버튼 자체를 두지 않는다 — 눌러도 못 가는 버튼은 없는 것만 못하다.
 */
export function FacilitySelectedCard({
  facility,
  showDistance,
  onClose,
}: {
  facility: NearbyFacilityItem
  /** 위치 폴백이면 거리를 숨긴다 — 제주 중심 기준 거리를 내 위치 기준으로 읽는다 */
  showDistance: boolean
  onClose: () => void
}) {
  const href = directionsUrl({ name: facility.name, lat: facility.lat, lng: facility.lng })

  const meta = [
    showDistance ? formatDistance(facility.distanceMeters) : null,
    shortAddress(facility.addr),
  ].filter((part): part is string => part !== null && part !== '')

  return (
    <section
      aria-label={facility.name}
      className="bg-bg border-border rounded-xl border p-4 shadow-lg"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-title-2 text-fg font-semibold break-keep">{facility.name}</h2>
            {/* 유형은 병원이 기본이라 약국일 때만 붙인다 — 목록 행과 같은 규칙이다 */}
            {facility.facilityType.code === 'ANIMAL_PHARMACY' && (
              <Badge tone="neutral" size="sm" className="shrink-0">
                {facility.facilityType.name}
              </Badge>
            )}
          </div>

          {facility.operatingHoursKnown && facility.operatingHours !== null ? (
            <p className="text-body-2 text-fg mt-1 break-keep tabular-nums">
              {facility.operatingHours}
            </p>
          ) : (
            <p className="text-body-2 text-fg-muted mt-1 break-keep">
              {messages.emergency.hoursUnknown}
            </p>
          )}

          {meta.length > 0 && (
            <p className="text-body-2 text-fg-muted mt-1 break-keep tabular-nums">
              {meta.join(' · ')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={messages.common.close}
          className="text-fg-muted hover:text-fg focus-visible:ring-brand-500 -mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-1 focus-visible:outline-none"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        {facility.tel === null ? (
          <p className="text-caption text-fg-muted flex-1 self-center break-keep">
            {messages.emergency.telMissing}
          </p>
        ) : (
          <a
            href={`tel:${facility.tel.replace(/[^\d+]/g, '')}`}
            aria-label={messages.emergency.callLabel.replace('{name}', facility.name)}
            className={cn(
              'bg-brand-600 text-fg-inverse flex h-12 flex-1 items-center justify-center gap-1.5 rounded-md font-semibold transition-colors',
              'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
            )}
          >
            <PhoneIcon size={20} />
            {messages.emergency.callShort}
          </a>
        )}

        {href !== null && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'border-border-strong text-fg hover:bg-band flex h-12 flex-1 items-center justify-center rounded-md border font-semibold transition-colors',
              'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
            )}
          >
            {messages.map.directions}
          </a>
        )}
      </div>
    </section>
  )
}
