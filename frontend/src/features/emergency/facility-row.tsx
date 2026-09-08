import { Badge } from '@/components/badge'
import { PhoneIcon } from '@/components/icons'
import { Row } from '@/components/surface'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 긴급 시설 행 — 아트보드 `혼디가개 긴급 시설` 01.
 *
 * **약국을 따로 묶지 않는다.** 유형이 다르다고 섹션을 나누면 "4.46km 약국" 이
 * "3.12km 병원" 보다 위로 올라간다. 거리가 우선이고 유형은 태그로 구분한다
 * (아트보드 주석).
 *
 * **진료시간은 서버 문자열 그대로 렌더한다.** `"월~금 09:00~19:00, 토 09:00~13:00"` 을
 * 파싱해 "오늘 19:00까지" 로 요약하지 않는다 — 서식이 조금만 달라도 틀린 시간을 말하게 된다.
 */
export function FacilityRow({
  facility,
  /** 위치 폴백이면 거리를 숨긴다 — 제주 중심에서 480m 인 것을 "480m" 라고 쓸 수 없다 */
  showDistance,
  last = false,
}: {
  facility: NearbyFacilityItem
  showDistance: boolean
  last?: boolean
}) {
  const meta = [
    showDistance ? formatDistance(facility.distanceMeters) : null,
    shortAddress(facility.addr),
  ].filter((part): part is string => part !== null && part !== '')

  return (
    <Row as="li" last={last}>
      <div className="flex items-center gap-3 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-title-2 text-fg font-semibold break-keep">{facility.name}</span>
            {/* 유형은 병원이 기본이라 약국일 때만 붙인다 — 모든 행에 붙으면 신호가 죽는다 */}
            {facility.facilityType.code === 'ANIMAL_PHARMACY' && (
              <Badge tone="neutral" size="sm" className="shrink-0">
                {facility.facilityType.name}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {facility.open24 && <Badge tone="neutral">{messages.emergency.open24}</Badge>}
            <OpenStatus openNow={facility.openNow} />
          </div>

          {/* 운영시간 원문. 없으면 없다고 말한다 — "닫힘" 과 구분된다 */}
          {facility.operatingHoursKnown && facility.operatingHours !== null ? (
            <p className="text-body-2 text-fg break-keep tabular-nums">
              {facility.operatingHours}
              {facility.restDate !== null && (
                <span className="text-fg-muted">
                  {' · '}
                  {facility.restDate} {messages.emergency.restPrefix}
                </span>
              )}
            </p>
          ) : (
            <p className="text-body-2 text-fg-muted break-keep">
              {messages.emergency.hoursUnknown}
            </p>
          )}

          {meta.length > 0 && (
            <p className="text-body-2 text-fg-muted break-keep tabular-nums">{meta.join(' · ')}</p>
          )}

          {/* 번호가 없으면 이유와 다음 방법을 준다. 버튼만 비활성으로 두면 왜인지 알 수 없다 */}
          {facility.tel === null && (
            <p className="text-caption text-fg-muted break-keep">{messages.emergency.telMissing}</p>
          )}
        </div>

        <CallButton name={facility.name} tel={facility.tel} />
      </div>
    </Row>
  )
}

/**
 * 영업 상태 3상태 — `openNow` 가 근거다.
 *
 * **등급 색을 쓰지 않는다** (아트보드 주석). 초록·주황은 산책 위험도 전용이고
 * 영업 여부는 판정이 아니다. `null` 은 점선으로 "모름" 을 드러낸다.
 *
 * **장소 상세의 `PlaceOpenStatus` 와 합치지 않았다** (#294). 규칙(등급색 금지 · 색이
 * 아니라 무게)은 같지만 문구가 다르고(`진료중` vs `영업 중`) `null` 처리가 갈린다 —
 * 이 화면은 `operatingHoursKnown: false` 처럼 **원문조차 없는 곳**이 있어 "모름" 이
 * 정보지만, 장소는 운영시간 원문이 항상 함께 있어 정보가 아니다. 규칙을 바꿀 때는
 * 양쪽을 같이 본다.
 */
function OpenStatus({ openNow }: { openNow: boolean | null }) {
  if (openNow === null) {
    return (
      <span className="text-caption text-fg-muted border-border-strong inline-flex items-center rounded-sm border border-dashed px-2 py-1 font-semibold">
        {messages.emergency.statusUnknown}
      </span>
    )
  }

  return (
    // 진료중은 채운 태그, 영업 종료는 흐리게 — 색이 아니라 무게로 가른다
    <Badge tone="neutral" className={openNow ? 'text-fg font-semibold' : ''}>
      {openNow ? messages.emergency.statusOpen : messages.emergency.statusClosed}
    </Badge>
  )
}

/**
 * 52px 전화 버튼.
 *
 * **번호가 없어도 자리를 비우지 않는다.** 자리가 사라지면 "이 병원만 뭔가 다르다" 가
 * 아니라 "화면이 깨졌다" 로 읽힌다 (아트보드 주석).
 */
function CallButton({ name, tel }: { name: string; tel: string | null }) {
  const base =
    'flex size-13 shrink-0 items-center justify-center rounded-md border transition-colors'

  if (tel === null) {
    return (
      <span aria-hidden className={cn(base, 'border-border text-fg-subtle')}>
        <PhoneIcon size={24} />
      </span>
    )
  }

  return (
    <a
      href={`tel:${tel.replace(/[^\d+]/g, '')}`}
      aria-label={messages.emergency.callLabel.replace('{name}', name)}
      className={cn(
        base,
        'border-border-strong text-fg hover:bg-band',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      <PhoneIcon size={24} />
    </a>
  )
}
