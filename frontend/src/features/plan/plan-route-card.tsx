'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { ChipGroup } from '@/components/chip'
import { Surface } from '@/components/surface'
import type { MapPin } from '@/features/map/map-canvas'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { formatDistance } from '@/lib/format/distance'
import {
  routeCamera,
  routeCameraKey,
  type RouteItemInput,
  type RouteSelection,
  selectedIdForDay,
  toRouteModel,
  toRouteSegments,
} from '@/lib/map/route'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { messages } from '@/lib/messages'
import { lodgingBasisFor, type PlanDayGroup, planItemMapCoord } from '@/lib/plan/detail'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlanItemDetail } from '@/types/plan'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (docs/external-api-guide.md §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 동선 카드 — 일자 열의 맨 위 (#743 · 명세 D1-1).
 *
 * 이 화면은 지금까지 동선을 **숫자로만** 말했다 (`직선 4.1km 이동`). 숫자는 얼마나
 * 먼지는 말해도 **왜 먼지**는 말하지 못한다 — 같은 다섯 곳을 도는 하루라도 남북을
 * 왕복하면 합계가 두 배가 되는데, 행을 하나씩 읽어서는 그 모양이 보이지 않는다.
 *
 * **좌측 레일이 아니라 우측 일자 열이다.** 레일은 의도적으로 고정이 아니라
 * (`plan-detail-section.tsx` 의 레일 주석) 일자 카드를 읽으며 내려가면 화면에서
 * 사라진다. 지도와 목록은 서로를 가리키는 한 쌍이라 **같은 열**에 있어야 대응이 남는다.
 *
 * **한 번에 한 일자만 그린다.** 여러 날을 겹치면 색으로 가를 수밖에 없는데, 마커에
 * 판정 색을 쓰지 않는다는 규칙(`DESIGN.md`)이 그것을 막는다. 3일 15곳을 한 화면에
 * 겹치면 선도 읽히지 않는다.
 *
 * **새 요청이 없다.** 좌표는 상세 응답이 항목마다 함께 준다 (#86 · #620).
 */
export function PlanRouteCard({
  totalDays,
  days,
}: {
  totalDays: number
  days: PlanDayGroup<PlanItemDetail>[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selection, setSelection] = useState<RouteSelection>(null)
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)

  /*
    **필터·탭은 URL 에 둔다** (architecture-guide.md §10). 일자도 같은 축이라
    `?day=` 다 — 링크를 받은 사람이 같은 일자를 본다.

    범위 밖 값은 조용히 1일차로 떨어뜨린다. `?day=99` 는 사용자가 주소를 고쳤거나 옛
    링크를 연 것이고, 그때 카드를 비우는 것보다 첫날을 보여 주는 편이 낫다.
  */
  const selectedDay = clampDay(searchParams.get('day'), totalDays)

  // 일자를 바꾸면 선택이 풀린다 — 다른 일자에서 고른 핀은 여기 없다 (`selectedIdForDay`)
  const selectedId = selectedIdForDay(selection, selectedDay)

  const group = days.find((candidate) => candidate.day === selectedDay)

  /*
    **좌표 추출을 `useMemo` 안에서 한다.** 렌더 중에 만든 배열은 매번 새 참조라 핀 ·
    선을 그리는 effect 가 이유 없이 다시 돈다.

    **이 memo 만으로는 카메라를 지키지 못한다** (#982 리뷰 H-1). `days` 가 부모
    (`plan-detail-section`)에서 렌더마다 `groupItemsByDay` 로 새로 만들어져 이 memo 도
    매번 다시 돈다 — 그래서 카메라는 아래에서 **값 서명**에 따로 건다.
  */
  const model = useMemo(() => {
    const items: RouteItemInput[] = (group?.items ?? []).map((item) => ({
      id: item.planItemId,
      itemTypeCode: item.itemType.code,
      title: item.title,
      coord: planItemMapCoord(item),
    }))

    const lodging = lodgingBasisFor(selectedDay, days)

    return toRouteModel({
      items,
      lodgingBasis:
        lodging === null
          ? null
          : {
              id: lodging.planItemId,
              itemTypeCode: lodging.itemType.code,
              title: lodging.title,
              coord: planItemMapCoord(lodging),
            },
    })
  }, [group, days, selectedDay])

  /*
    **카메라 memo 는 배열이 아니라 값 서명에 건다** (#982 리뷰 H-1). `model.stops` 는 위
    이유로 렌더마다 새 참조라, 거기 걸면 날씨 · 위험도 쿼리가 늦게 도착하거나 일자 편집에
    들어갈 때마다 새 카메라가 된다. `MapCanvas` 는 새 카메라를 새 틀로 읽어 "사용자가
    옮겼다" 표시를 지우고 다시 맞추므로, **끌어 둔 지도가 그날 사각형으로 되돌아간다.**

    서명은 일자와 정류점의 `id` · 좌표뿐이다 (`routeCameraKey`) — 카메라가 읽는 값이 그것뿐이라
    서명이 같으면 `routeCamera` 결과도 같다. 그래서 의존성에서 `model.stops` 를 뺀다.
  */
  const cameraKey = routeCameraKey(selectedDay, model.stops)

  const camera = useMemo(() => {
    const frame = routeCamera(model.stops)
    /*
      주인공이 여럿인 지도라 정중앙이다 — 기본 0.35 는 제주 전체를 담는 화면의 값이다.

      **크기가 바뀌면 다시 맞춘다** (#982). 단계를 칸의 **폭**으로 정하므로(`SpanBox`) 창을
      줄이거나 기기를 돌리면 처음 맞춘 단계가 틀린다. 사용자가 지도를 만졌으면 되잡지
      않는다(`MapCanvas` 의 `refitOnResize`).
    */
    return frame === null ? null : { ...frame, anchorRatio: 0.5, refitOnResize: true }
    // 서명이 `model.stops` 의 카메라 입력을 전부 담는다 (위 주석)
  }, [cameraKey])

  const pins: MapPin[] = useMemo(
    () =>
      model.stops.map((stop) => ({
        id: stop.id,
        title: stop.title,
        lat: stop.coord.lat,
        lng: stop.coord.lng,
        order: stop.order,
      })),
    [model.stops],
  )

  const route = useMemo(() => toRouteSegments(model.legs), [model.legs])

  /*
    **찍을 것이 없으면 카드가 통째로 없다.** 항목이 없는 일자, 좌표가 하나도 없는 일자,
    지도 SDK 실패 — 셋 다 같다.

    SDK 실패에 "목록으로 보여드릴게요" 를 띄우지 않는 이유: 여기에는 되돌릴 목록 갈래가
    따로 없고, 거리 줄은 원래 자리(항목 행)에 그대로 남아 정보가 사라지지 않는다.
    `PlaceMiniMap` 과 같은 판단이다.
  */
  if (camera === null || failure !== null) return null

  const summary = messages.map.routeSummary
    .replace('{day}', String(selectedDay))
    .replace('{n}', String(model.stops.length))

  return (
    <Surface title={messages.map.routeHeading}>
      <div className={cn('flex flex-col gap-3 pb-5', INSET_CLASS.card)}>
        {totalDays > 1 && (
          <ChipGroup label={messages.map.routeDayAxis} exclusive className="flex flex-wrap gap-2">
            {days.map((candidate) => (
              <DayChip
                key={candidate.day}
                day={candidate.day}
                selected={candidate.day === selectedDay}
                pathname={pathname}
              />
            ))}
          </ChipGroup>
        )}

        <MapCanvas
          pins={pins}
          route={route}
          selectedId={selectedId}
          onSelect={(id) => setSelection({ day: selectedDay, id })}
          camera={camera}
          onFailure={setFailure}
          className="h-56 w-full overflow-hidden rounded-md md:h-64"
        />

        <div className="flex flex-col gap-1">
          <p className="text-caption text-fg-muted font-medium tabular-nums">
            {model.totalStraightMeters > 0
              ? `${summary} · ${messages.map.routeStraightTotal.replace(
                  '{distance}',
                  formatDistance(model.totalStraightMeters),
                )}`
              : summary}
          </p>

          {model.omittedCount > 0 && (
            <p className="text-caption text-fg-subtle">
              {messages.map.routeOmitted.replace('{n}', String(model.omittedCount))}
            </p>
          )}
        </div>
      </div>
    </Surface>
  )
}

/**
 * 일자 칩.
 *
 * **`Chip` 이 아니라 링크다.** 주소를 바꾸는 일이라 새 탭으로 열거나 복사할 수 있어야
 * 하고, 해시를 함께 실어 **모바일에서 그 일자 카드로 따라간다** — 세로로 쌓인 화면에서는
 * 지도와 일자 카드가 동시에 보이지 않아 칩만 눌러서는 무엇이 바뀌었는지 알기 어렵다.
 *
 * 생김새는 `Chip` 과 같은 문자열을 쓴다. 두 컨트롤이 같은 축(`radiogroup`)에 서므로
 * 모양이 갈리면 배운 규칙이 깨진다.
 */
function DayChip({
  day,
  selected,
  pathname,
}: {
  day: number
  selected: boolean
  pathname: string
}) {
  return (
    <Link
      href={`${pathname}?day=${String(day)}#${planDayAnchorId(day)}`}
      replace
      scroll={false}
      role="radio"
      aria-checked={selected}
      className={cn(
        'text-body-2 inline-flex h-11 items-center gap-1.5 rounded-md border px-3 whitespace-nowrap transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
        selected
          ? 'bg-band border-border-strong text-fg font-semibold'
          : 'bg-bg border-border text-fg-muted hover:bg-band font-medium',
      )}
    >
      {messages.map.routeDayChip.replace('{day}', String(day))}
    </Link>
  )
}

/**
 * `?day=` 를 일자 번호로 읽는다.
 *
 * **범위 밖·숫자 아님은 전부 1 이다.** 던지지 않는다 — 주소창은 사용자가 만질 수 있고,
 * 옛 링크는 기간이 줄어든 일정을 가리킬 수 있다 (`groupItemsByDay` 의 `outOfRange` 와
 * 같은 사실의 다른 얼굴이다).
 */
function clampDay(raw: string | null, totalDays: number): number {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > totalDays) return 1

  return parsed
}
