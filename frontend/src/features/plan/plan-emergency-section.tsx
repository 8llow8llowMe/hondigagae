import { BackLink } from '@/components/back-link'
import { Badge } from '@/components/badge'
import { EmptyState } from '@/components/empty-state'
import { PhoneIcon } from '@/components/icons'
import { Surface, SurfaceList } from '@/components/surface'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type {
  PlanEmergencyDay,
  PlanEmergencyFacility,
  PlanEmergencyResponse,
  PlanEmergencySpot,
} from '@/types/emergency'

/**
 * 페이지 머리 — 돌아가기 · `h1` · 반경 안내. **카드가 아니다** (§0 의 페이지 머리 예외 —
 * 장소 상세 #443 · 일정 상세 #447 · 담기 #451 이 정한 "L0 위 제목 줄").
 *
 * 인셋은 카드 안 글줄과 같은 `card` 다 — 아래 카드의 첫 글자와 세로선이 맞아야 한다.
 * 카드 테두리 1px 만큼(44 vs 45) 어긋나는 것은 같은 PR 들이 의도한 값이다.
 * 데스크톱 세로 여백은 `SurfaceStack` 의 `md:p-6` 이 준다 (`plan-emergency-view` 와 같다).
 *
 * **반경 안내는 응답이 와야 쓸 수 있다** — 그래서 `null` 이면 그 줄을 비운다. 반경과 개수는
 * 서버 고정이라 조절 컨트롤을 두지 않고 사실만 적는다 — 조절할 수 있는 것처럼 보이면
 * 사용자가 찾아 헤맨다.
 */
export function PlanEmergencyHeader({
  planId,
  radiusMeters,
}: {
  planId: string
  radiusMeters: number | null
}) {
  return (
    /*
        **모바일만 flex 다** (#539). `md:block` 으로 데스크톱을 원래의 블록 흐름으로 되돌린다 —
        `BackLink` 에 `md:basis-full` 을 주는 방식은 줄바꿈과 **폭**이 한 속성에 묶여 있어,
        데스크톱에서 링크 상자가 줄 전체(실측 1832px)가 되고 클릭 영역과 포커스 링이 함께
        커졌다. 자리만 바꾸려던 것이 판정 영역을 바꾼 셈이라 되돌렸다.

        `items-start` 로 첫 줄에 맞춘다 — `BackLink` 의 `-my-[7px]` 이 마진 상자를 제목 첫
        줄 높이(30px)로 맞춰 두므로, 제목이 두 줄이 되거나 옆에 더 높은 것이 서도 아이콘이
        따라 내려가지 않는다. 줄 사이 `gap-x-1` 은 포커스 링(2px)이 제목 첫 글자를 덮지
        않게 하는 최소값이다.
      */
    <header
      className={cn(
        'flex flex-wrap items-start gap-x-1 pt-4 pb-4 md:block md:pt-0 md:pb-0',
        INSET_CLASS.card,
      )}
    >
      <BackLink href={`/plans/${planId}`} label={messages.plan.emergencyBack} variant="titleRow" />
      {/*
        **제목과 부제가 한 덩어리다.** 부제를 헤더 직속에 두면 모바일에서 제목만 아이콘
        만큼(40px) 밀려 한 헤더 안에 왼쪽 기준선이 둘이 된다 (`lib/ui/inset.ts` 가 지그재그
        기준선을 실패 사례로 적어 둔 그 모양이다).

        `min-w-0 flex-1` 은 폭 가드다 — 없으면 `h1` 의 기본 크기가 max-content 라 문구가
        길어지는 순간 제목이 다음 줄로 내려가고 **아이콘만 혼자 한 줄에 남는다.** 320에서
        여유가 55px 뿐이다(실측).
      */}
      <div className="min-w-0 flex-1 md:flex-none">
        <h1 className="text-title-1 text-fg lg:text-display font-bold break-keep md:mt-1 lg:font-extrabold">
          {messages.plan.emergencyHeading}
        </h1>
        {radiusMeters !== null && (
          <p className="text-caption text-fg-muted mt-1 font-medium">
            {messages.plan.emergencyRadiusNote.replace(
              '{km}',
              String(Math.round(radiusMeters / 1000)),
            )}
          </p>
        )}
      </div>
    </header>
  )
}

/**
 * 일정 응급 브리핑 — `GET /plans/{planId}/emergency` (#125).
 *
 * **출발 전 확인 용도다.** 급할 때 검색을 시작하면 늦다는 것이 이 기능의 취지라,
 * 화면도 "지금 가장 가까운 곳" 이 아니라 **일자별로 미리 훑는 목록**으로 만든다.
 * 그래서 `/emergency`(현재 위치 기준, 지도 토글)와 화면 모양이 다르다.
 *
 * **일자마다 카드 하나다** (3층 표면, #460 — 일정 상세 #447 과 같은 판정). 카드 판정 3문을
 * 통과한다 — ① 자기 제목(`N일차`) ② 혼자 떼어놔도 말이 된다(그날 갈 곳 주변의 병원) ③ 담는
 * 항목이 여럿(장소 × 시설). 장소 묶음은 카드 안 L2 다 — 같은 화자(그날의 동선)가 이어
 * 말하는 것이라 카드를 더 쪼개지 않는다(§0 "카드 경계는 이야기 단위"). 묶음 사이와
 * 시설 사이는 둘 다 1px 선이고, 묶음 제목이 `h3` 캡션으로 리듬을 끊는다 (#445 두 묶음과
 * 같은 처리).
 *
 * **`SurfaceStack` 의 직접 자식으로 카드들을 돌려준다** — 부모가 카드 간격(8/24)을 주려면
 * 래퍼가 없어야 한다 (`plan-overview-panel.tsx` 가 조각을 fragment 로 돌려주는 이유).
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
    "찾지 못했다" 를 어렵게 말하는 것이다. 빈 상태도 카드 안이다 — 로딩·오류와 같은
    자리에 같은 표면이 서야 상태가 바뀌어도 카드가 생겼다 사라지지 않는다 (#440 판단).
  */
  const hasAnySpot = data.days.some((day) => day.spots.length > 0)
  if (!hasAnySpot) {
    return (
      <Surface aria-label={messages.plan.emergencyHeading}>
        <EmptyState
          title={messages.plan.emergencyEmptyTitle}
          description={messages.plan.emergencyEmptyDescription}
          inset="card"
        />
      </Surface>
    )
  }

  return (
    <>
      {data.days.map((day) => (
        <DayCard key={day.day} day={day} />
      ))}
    </>
  )
}

/** 장소가 없는 일차는 통째로 건너뛴다 — 이동만 있는 날에 빈 카드를 남기지 않는다 */
function DayCard({ day }: { day: PlanEmergencyDay }) {
  if (day.spots.length === 0) return null

  return (
    <Surface title={messages.plan.emergencyDayLabel.replace('{day}', String(day.day))}>
      {/* 장소 묶음 사이 선은 이 목록이 긋는다 — 첫 묶음 위(카드 제목 아래)에는 없다 */}
      <SurfaceList>
        {day.spots.map((spot) => (
          <SpotBlock key={spot.planItemId} spot={spot} />
        ))}
      </SurfaceList>
    </Surface>
  )
}

function SpotBlock({ spot }: { spot: PlanEmergencySpot }) {
  return (
    <li>
      {/* 카드 제목이 `h2` 라 묶음 제목은 `h3` 캡션이다 (#445 두 묶음과 같은 등급) */}
      <h3 className={cn('text-body-2 text-fg-muted pt-3 pb-1 font-semibold', INSET_CLASS.card)}>
        {spot.title}
      </h3>

      {/*
        **반경 안에 아무것도 없는 장소를 목록에서 지우지 않는다.** 지우면 사용자는 그
        장소 주변을 확인한 것으로 오해한다 — 실제로는 "없다" 는 정보가 있어야 한다.
      */}
      {spot.facilities.length === 0 ? (
        <p className={cn('text-caption text-fg-subtle pb-3', INSET_CLASS.card)}>
          {messages.plan.emergencySpotEmpty}
        </p>
      ) : (
        <SurfaceList>
          {spot.facilities.map((facility) => (
            <FacilityRow key={`${facility.name}-${facility.addr}`} facility={facility} />
          ))}
        </SurfaceList>
      )}
    </li>
  )
}

/**
 * 시설 한 줄.
 *
 * **`/emergency` 의 `FacilityRow` 를 재사용하지 않는다.** 저쪽은 `NearbyFacilityItem`
 * 을 받는데 이 응답에는 `facilityId`·좌표·`operatingHours`·`openNow` 가 없다. 같은
 * 것으로 다루면 없는 필드를 읽게 된다 (`types/emergency.ts` 주석).
 *
 * 구분선은 스스로 긋지 않는다 — `SurfaceList` 가 항목 사이에만 긋는다 (#439 L2 규약).
 */
function FacilityRow({ facility }: { facility: PlanEmergencyFacility }) {
  return (
    <li className={cn('flex items-center gap-3 py-3', INSET_CLASS.card)}>
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
