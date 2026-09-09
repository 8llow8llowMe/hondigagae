import { Badge } from '@/components/badge'
import { EmptyState } from '@/components/empty-state'
import { PhoneIcon } from '@/components/icons'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type {
  PlanEmergencyDay,
  PlanEmergencyFacility,
  PlanEmergencyResponse,
  PlanEmergencySpot,
} from '@/types/emergency'

/**
 * 일정 응급 브리핑 — `GET /plans/{planId}/emergency` (#125).
 *
 * **출발 전 확인 용도다.** 급할 때 검색을 시작하면 늦다는 것이 이 기능의 취지라,
 * 화면도 "지금 가장 가까운 곳" 이 아니라 **일자별로 미리 훑는 목록**으로 만든다.
 * 그래서 `/emergency`(현재 위치 기준, 지도 토글)와 화면 모양이 다르다.
 *
 * **길찾기 버튼이 없다.** 이 응답의 `FacilityItem` 에는 좌표가 없어 `directionsUrl` 이
 * 링크를 만들 수 없고, 눌러도 아무 데도 못 가는 버튼은 없는 것만 못하다
 * (`lib/geo/map-link.ts` 주석). 대신 주소와 전화를 준다.
 *
 * **표현 전용이다** — 조회는 `PlanEmergencyView` 가 갖는다 (이 저장소 테스트가 jsdom
 * 없이 문자열로 검증하므로 훅을 든 컴포넌트는 provider 없이 렌더할 수 없다).
 */
export function PlanEmergencySection({ data }: { data: PlanEmergencyResponse }) {
  /*
    **장소가 하나도 없으면 일차 목록을 그리지 않는다.** 빈 일차만 늘어선 화면은
    "찾지 못했다" 를 어렵게 말하는 것이다.
  */
  const hasAnySpot = data.days.some((day) => day.spots.length > 0)
  if (!hasAnySpot) {
    return (
      <EmptyState
        title={messages.plan.emergencyEmptyTitle}
        description={messages.plan.emergencyEmptyDescription}
      />
    )
  }

  return (
    <div className="flex flex-col">
      {/*
        반경과 개수는 **서버 고정**이라 조절 컨트롤을 두지 않는다. 화면은 사실만 적는다 —
        조절할 수 있는 것처럼 보이면 사용자가 찾아 헤맨다.
      */}
      <p className="text-caption text-fg-muted px-4 py-3 font-medium md:px-10">
        {messages.plan.emergencyRadiusNote.replace(
          '{km}',
          String(Math.round(data.radiusMeters / 1000)),
        )}
      </p>

      {data.days.map((day) => (
        <DaySection key={day.day} day={day} />
      ))}
    </div>
  )
}

/** 장소가 없는 일차는 통째로 건너뛴다 — 이동만 있는 날에 빈 제목을 남기지 않는다 */
function DaySection({ day }: { day: PlanEmergencyDay }) {
  if (day.spots.length === 0) return null

  return (
    <section aria-label={messages.plan.emergencyDayLabel.replace('{day}', String(day.day))}>
      {/* 섹션 제목 등급은 일정 상세와 같은 갈래다 — `lg` 에서 갈린다 (#358) */}
      <h2 className="text-title-2 text-fg lg:text-title-1 px-4 pt-5 pb-2 font-semibold md:px-10 lg:font-bold">
        {messages.plan.emergencyDayLabel.replace('{day}', String(day.day))}
      </h2>

      {day.spots.map((spot) => (
        <SpotBlock key={spot.planItemId} spot={spot} />
      ))}
    </section>
  )
}

function SpotBlock({ spot }: { spot: PlanEmergencySpot }) {
  return (
    <div className="px-4 py-2 md:px-10">
      <p className="text-body-2 text-fg-muted font-semibold">{spot.title}</p>

      {/*
        **반경 안에 아무것도 없는 장소를 목록에서 지우지 않는다.** 지우면 사용자는 그
        장소 주변을 확인한 것으로 오해한다 — 실제로는 "없다" 는 정보가 있어야 한다.
      */}
      {spot.facilities.length === 0 ? (
        <p className="text-caption text-fg-subtle py-2">{messages.plan.emergencySpotEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {spot.facilities.map((facility, index) => (
            <FacilityRow
              key={`${facility.name}-${facility.addr}`}
              facility={facility}
              last={index === spot.facilities.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 시설 한 줄.
 *
 * **`/emergency` 의 `FacilityRow` 를 재사용하지 않는다.** 저쪽은 `NearbyFacilityItem`
 * 을 받는데 이 응답에는 `facilityId`·좌표·`operatingHours`·`openNow` 가 없다. 같은
 * 것으로 다루면 없는 필드를 읽게 된다 (`types/emergency.ts` 주석).
 */
function FacilityRow({ facility, last }: { facility: PlanEmergencyFacility; last: boolean }) {
  return (
    <li className={cn('flex items-center gap-3 py-3', !last && 'border-border/60 border-b')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-body-2 text-fg font-semibold break-keep">{facility.name}</span>
          {/* 병원이 기본이라 약국일 때만 붙인다 — 모든 행에 붙으면 신호가 죽는다 */}
          {facility.typeName !== '동물병원' && (
            <Badge tone="neutral" size="sm" className="shrink-0">
              {facility.typeName}
            </Badge>
          )}
          {facility.open24 && (
            <Badge tone="brand" size="sm" className="shrink-0">
              {messages.plan.emergencyOpen24}
            </Badge>
          )}
        </div>

        <span className="text-caption text-fg-muted tabular-nums">
          {formatDistance(facility.distanceMeters)} · {facility.addr}
        </span>

        {/*
          **`operatingHoursKnown: false` 는 휴무가 아니라 확인 필요다** (백엔드 스키마 명시).
          "닫혔다" 로 쓰면 실제로 여는 병원을 사용자가 건너뛴다 — 응급에서 가장 나쁜 실패다.
        */}
        {!facility.operatingHoursKnown && (
          <span className="text-caption text-fg-subtle">{messages.plan.emergencyHoursUnknown}</span>
        )}
      </div>

      <a
        href={`tel:${facility.tel.replace(/[^\d+]/g, '')}`}
        aria-label={messages.plan.emergencyCallLabel.replace('{name}', facility.name)}
        className="border-border text-fg hover:bg-band focus-visible:ring-brand-500 flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <PhoneIcon size={20} />
      </a>
    </li>
  )
}
