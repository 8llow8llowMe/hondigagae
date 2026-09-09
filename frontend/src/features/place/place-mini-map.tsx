'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import type { MapPin } from '@/features/map/map-canvas'
import { toLatLng } from '@/lib/geo/coord'
import { directionsUrl } from '@/lib/geo/map-link'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { messages } from '@/lib/messages'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (docs/external-api-guide.md §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 화면에 담을 폭(m). **반경이 아니라 지름이다** (`framedCamera` 의 `spanMeters`).
 *
 * 1.2km — 장소와 맞닿은 길·해안선이 함께 들어오는 범위다. 이 지도가 답하는 질문은
 * "여기가 어디쯤이냐" 하나이고, 그 답에는 건물 하나가 아니라 **주변 한 겹**이 필요하다.
 *
 * 확대 단계로 주지 않는 이유: 이 지도는 폭이 좌우로 크게 갈린다(우측 본문 40~ 인셋에서
 * 모바일 343 · 데스크톱 700+). 단계를 고정하면 넓은 화면에서는 동네가 통째로 들어오고
 * 좁은 화면에서는 건물만 남는다 — `framedCamera` 가 **짧은 변** 기준으로 단계를 역산한다.
 */
const MINI_MAP_SPAN_METERS = 1200

/**
 * 상세의 작은 지도 — 기본 정보 절의 끝 (주소를 머리에 둔 그 절이다).
 *
 * 아트보드 `혼디가개 장소 상세` 의 "지도 보기"·"길찾기"가 여기서 채워진다
 * ([#14](https://github.com/8llow8llowMe/hondigagae/issues/14) 로 미뤄 뒀던 자리다).
 *
 * **주소와 한 묶음이다.** 별도 절로 떼면 같은 사실("어디에 있나")이 두 제목 아래로
 * 갈린다 — 주소는 글자로, 지도는 그림으로 말하는 한 가지다.
 *
 * **좌표가 없으면 절 전체가 사라진다** (`toLatLng` 이 null). 마커를 찍을 자리도 없고
 * 길찾기 링크도 만들어지지 않는다 (`directionsUrl`) — 오류가 아니라 말할 것이 없는 것이다.
 *
 * **SDK 가 실패해도 길찾기는 남는다.** 딥링크는 좌표 하나로 만들어지는 문자열이라 지도
 * SDK 와 아무 관계가 없다 — 함께 지우면 카카오 CDN 이 느린 날에 **갈 수 있는 유일한 길**이
 * 같이 사라진다. 목록 화면(`PlaceMapView`)은 실패하면 목록으로 되돌리지만 여기는 되돌릴
 * 갈래가 없어, 지도만 빼고 링크를 남기는 것이 그 자리의 폴백이다.
 *
 * `PlaceMapView` 와 달리 **재조회도 선택도 없다.** 핀이 하나뿐이라 고를 것이 없고,
 * 지도를 옮겨도 이 화면이 보여 줄 다른 장소가 없다.
 */
export function PlaceMiniMap({
  placeId,
  title,
  lat,
  lng,
}: {
  placeId: string
  title: string
  lat: number | null
  lng: number | null
}) {
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)

  /*
    **`useMemo` 가 필수다.** 렌더 중에 새 객체를 만들면 참조가 매번 바뀌어 `MapCanvas` 의
    카메라 effect 가 매 렌더 돌고, 사용자가 맞춰 둔 확대가 계속 되돌아간다
    (`use-emergency-board.ts` 가 같은 함정을 같은 방법으로 막는다).

    좌표 변환을 `useMemo` **안에서** 한다 — 밖에서 만든 `LatLng` 은 매 렌더 새 객체라
    의존성으로 쓸 수 없다. 원시값 `lat`/`lng` 만 의존성에 둔다.
  */
  const camera = useMemo(() => {
    const coord = toLatLng({ lat, lng })
    if (coord === null) return null

    // 주인공이 하나뿐인 지도라 정중앙이다 — 기본값 0.35 는 제주 전체를 담는 화면의 값이다
    return { anchor: coord, spanMeters: MINI_MAP_SPAN_METERS, anchorRatio: 0.5 }
  }, [lat, lng])

  const pins: MapPin[] = useMemo(
    () => (camera === null ? [] : [{ id: placeId, title, lat, lng }]),
    [camera, placeId, title, lat, lng],
  )

  // 좌표가 없으면 지도도 길찾기도 없다 — 주소는 바로 위에 이미 있다
  if (camera === null) return null

  const href = directionsUrl({ name: title, lat, lng })

  return (
    <div className="flex flex-col gap-2">
      {/*
        **높이를 폭이 아니라 값으로 고정한다.** 종횡비로 두면 데스크톱 우측 본문(700+)에서
        지도가 350px 넘게 자라 기본 정보 한 절을 통째로 밀어낸다. 이 지도는 주소의
        보조 자료라 그 자리를 넘지 않아야 한다.

        둥근 모서리는 갤러리와 같은 `rounded-md` 다 — 사진과 같은 성격의 표면이다.
      */}
      {failure === null && (
        <MapCanvas
          pins={pins}
          /* 핀이 하나뿐이라 선택할 것이 없다. 라벨이 붙도록 처음부터 선택 상태로 둔다 */
          selectedId={placeId}
          onSelect={() => undefined}
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
  )
}
