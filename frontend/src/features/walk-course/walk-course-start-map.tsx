'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { Surface } from '@/components/surface'
import type { MapPin } from '@/features/map/map-canvas'
import { toLatLng } from '@/lib/geo/coord'
import { directionsUrl } from '@/lib/geo/map-link'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (`docs/external-api-guide.md` §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 카메라가 담아야 할 최소 범위(m). **반경이 아니라 지름이다** (`framedCamera` 의 `spanMeters`).
 *
 * ### 이 카드에서는 **높이**에 걸린다
 *
 * `framedCamera` 는 `Math.min(width, height)` 로 확대 단계를 역산하는데, 이 카드는
 * `h-44`(176) / `md:h-52`(208) 라 **짧은 변이 언제나 높이**다. 이름은 "폭" 이지만 여기서
 * 실제로 보장되는 축은 세로다.
 *
 * ### 4000 인 이유는 "얼마나 넓게" 가 아니라 "튀지 않게" 다
 *
 * 처음에는 3000 이었고 **그 값이 확대 단계 경계 위에 앉아 있었다**:
 * `16m/px × 176 = 2816 < 3000 ≤ 3328 = 16 × 208`. 그래서 브라우저 폭이 767 ↔ 768 을
 * 한 칸 넘을 때마다 같은 코스의 지도가 level 8 ↔ 7 로 바뀌어 **보이는 면적이 4배로
 * 점프했다.** 4000 은 두 높이 모두 level 8 로 떨어지고 경계(3328 · 5632)에서 넉넉히
 * 떨어져 있다 — `walk-course-start-map.test.ts` 가 이 불변을 지킨다.
 *
 * ### 실제로 보이는 범위
 *
 * level 8(32m/px) 기준 가로 **11km(375) ~ 22km(데스크톱 2열)** 다. 제주 동서 폭(~73km)의
 * 1/6~1/3 이라 **섬 전체를 담지는 않는다** — 출발지가 어느 해안·어느 마을인지까지다.
 * 섬 안 위치는 코스 이름표와 시종점 글자가 이미 말하고, "거기까지 어떻게 가나" 는 아래
 * 길찾기 딥링크가 답한다. `PlaceMiniMap`(1.2km, level 6)보다 두 단계 넓은 이유가 그것이다.
 */
const START_MAP_SPAN_METERS = 4000

/**
 * 코스 시작점 지도 — 상세 카드 하나 ([#782](https://github.com/8llow8llowMe/hondigagae/issues/782)).
 *
 * ### 왜 필요했나
 *
 * 지도가 핵심인 서비스인데 **코스 상세에 지도가 없었다.** 시종점이 글자뿐이라
 * `시흥리정류장-광치기해변` 을 읽고도 거기가 섬의 어디인지 알 수 없었다. 이 카드가
 * 실제로 주는 것은 마커보다 **길찾기 딥링크** — "출발지까지 어떻게 가나" 에 답한다.
 *
 * ### 경로 선을 그리지 않는다
 *
 * **응답에 코스 경로 좌표열이 없고 공개 원천에도 없다** (`코스목록-세부명세.md` D9-3,
 * 근거는 커밋 `7df9d300`). 시작점 마커 하나만 찍는다 — 없는 데이터를 이어 그리면 화면이
 * 코스 경로를 아는 척한다.
 *
 * ### 골격은 `PlaceMiniMap` 을 그대로 본뜬다
 *
 * 같은 질문("여기가 어디쯤이냐")에 답하는 단일 핀 지도가 이미 있다. 다른 것은
 * `spanMeters` 하나뿐이다. **재조회도 선택도 없다** — 핀이 하나뿐이라 고를 것이 없고,
 * 지도를 옮겨도 이 화면이 보여 줄 다른 코스가 없다.
 *
 * **SDK 가 실패해도 길찾기는 남는다.** 딥링크는 좌표 하나로 만들어지는 문자열이라 지도
 * SDK 와 아무 관계가 없다 — 함께 지우면 카카오 CDN 이 느린 날에 **갈 수 있는 유일한 길**이
 * 같이 사라진다 (`PlaceMiniMap` 과 같은 판단).
 *
 * **좌표가 없으면 카드 전체가 사라진다.** 실측 29개 중 25개가 그 갈래다 — 찍을 자리도
 * 링크도 없어 말할 것이 없다. 골든타임 자리(#730)와 다른 처치인 이유는, 저쪽은 *"오늘 걷기
 * 좋은 시간"* 이라는 **약속된 자리**이고 이쪽은 있으면 보태는 자료이기 때문이다.
 */
export function WalkCourseStartMap({ course }: { course: WalkCourseDetail }) {
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)

  /*
    **원시값으로 풀어 둔다** — `PlaceMiniMap` 과 같은 모양을 유지하려는 것이지 누수를 막는
    것이 아니다. 오버레이 누적은 애초에 구조적으로 불가능하다: `MapCanvas` 가 다시 그리기
    **전에** 기존 오버레이를 전부 `setMap(null)` 로 지운다. `course` 참조도 지금은 안정적이다
    (react-query 의 `structuralSharing` 기본값 + `refetchOnWindowFocus: false`).

    그 안정성이 **호출부 사정**이라 풀어 둘 뿐이다 — 호출부가 객체를 새로 만드는 날, 이
    컴포넌트는 오버레이 DOM 을 다시 만들어 핀의 포커스를 놓친다.
  */
  const { walkCourseId, lat, lng } = course
  const destination = startPointName(course.courseLabel)

  /*
    **`useMemo` 가 필수다.** 렌더 중에 새 객체를 만들면 참조가 매번 바뀌어 `MapCanvas` 의
    카메라 effect 가 매 렌더 돌고, 사용자가 맞춰 둔 확대가 계속 되돌아간다.

    좌표 변환을 `useMemo` **안에서** 한다 — 밖에서 만든 `LatLng` 은 매 렌더 새 객체라
    의존성으로 쓸 수 없다. 원시값 `lat`/`lng` 만 의존성에 둔다.
  */
  const camera = useMemo(() => {
    const coord = toLatLng({ lat, lng })
    if (coord === null) return null

    // 주인공이 하나뿐인 지도라 정중앙이다 — 기본값 0.35 는 제주 전체를 담는 화면의 값이다
    return { anchor: coord, spanMeters: START_MAP_SPAN_METERS, anchorRatio: 0.5 }
  }, [lat, lng])

  const pins: MapPin[] = useMemo(
    () => (camera === null ? [] : [{ id: walkCourseId, title: destination, lat, lng }]),
    [camera, walkCourseId, destination, lat, lng],
  )

  if (camera === null) return null

  const href = directionsUrl({ name: destination, lat, lng })

  return (
    <Surface title={messages.walkCourse.startMapHeading}>
      <div className={cn('flex flex-col gap-2 pb-4 md:pb-5', INSET_CLASS.card)}>
        {/*
          **높이를 폭이 아니라 값으로 고정한다** (`PlaceMiniMap` 과 같은 이유). 종횡비로
          두면 넓은 화면에서 지도가 카드 하나를 통째로 먹는다 — 이 지도는 보조 자료다.
        */}
        {/*
          **실패해도 제목이 붕 뜨지 않게 한 줄을 남긴다** (#782 검토). 제목이 `코스 시작점`
          이라고 약속했는데 지도만 사라지면 화면이 무엇을 못 했는지 말하지 않는다.
          `role="alert"` 는 주지 않는다 — 길찾기는 그대로 되므로 진입마다 먼저 읽힐 일이 아니다.
        */}
        {failure !== null && (
          <p className="text-body-2 text-fg-muted break-keep">
            {messages.walkCourse.startMapUnavailable}
          </p>
        )}

        {failure === null && (
          <MapCanvas
            pins={pins}
            /* 핀이 하나뿐이라 선택할 것이 없다. 라벨이 붙도록 처음부터 선택 상태로 둔다 */
            selectedId={walkCourseId}
            /*
              **`onSelect` 를 주지 않는 것이 신호다** (#789 · `PlaceMiniMap` 과 같은 처치).
              미지정이면 `MapCanvas` 가 핀을 버튼에서 떼고 지도의 이동·확대를 끈다.

              이 카드가 특히 그래야 하는 이유: 176px 띠가 **아래에 콘텐츠가 더 있는 중간
              위치**라, 그 위에서 시작한 세로 스와이프를 지도가 먹으면 페이지가 멈춘다.
            */
            camera={camera}
            onFailure={setFailure}
            className="h-44 w-full overflow-hidden rounded-md md:h-52"
          />
        )}

        {href !== null && (
          <a
            href={href}
            target="_blank"
            // 원문이 외부 링크다. opener 를 넘기지 않는다
            rel="noopener noreferrer"
            className="border-border-strong text-fg hover:bg-band focus-visible:ring-brand-500 flex h-11 items-center justify-center rounded-md border font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {messages.map.directions}
          </a>
        )}
      </div>
    </Surface>
  )
}

/**
 * 딥링크와 마커에 쓸 목적지 이름.
 *
 * **`startEndPoint` 를 쓰지 않는다.** `시흥리정류장-광치기해변` 처럼 시점과 종점이
 * 하이픈으로 붙어 있고 **갈라 쓰지 않기로 이미 정했다** (`코스상세-세부명세.md` D4-2) —
 * 그대로 넘기면 딥링크가 *종점까지 포함한 이름*으로 시작점 하나를 가리킨다.
 *
 * 코스 이름표에 `시작점` 을 붙이는 편이 짧고, 카카오맵에서 목적지 이름으로 보일 때도
 * 사용자가 방금 보던 화면과 이어진다.
 */
function startPointName(courseLabel: string): string {
  return `${courseLabel} 시작점`
}
