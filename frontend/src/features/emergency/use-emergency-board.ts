'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { resolveAnchor, showsDistance } from '@/features/emergency/resolve-anchor'
import { useEmergencyNav } from '@/features/emergency/use-emergency-nav'
import { useNearbyFacilities } from '@/features/emergency/use-nearby-facilities'
import { MAX_RADIUS_METERS } from '@/lib/api/emergency'
import type { LatLng } from '@/lib/geo/coord'
import {
  getCurrentPosition,
  type PositionFailure,
  type PositionResult,
} from '@/lib/geo/current-position'
import type { JejuRegionCode } from '@/lib/geo/jeju-regions'

/**
 * 이 화면의 상태 묶음. **화면당 하나만 만든다** — 두 벌이 마운트되면
 * `getCurrentPosition()` 이 두 번 나가고 좌표가 갈린다. 보드를 만들지 않고
 * **받아서** 쓰는 컴포넌트는 이 타입을 prop 으로 받는다.
 */
export type EmergencyBoard = ReturnType<typeof useEmergencyBoard>

/**
 * 긴급 시설 화면의 상태 — 위치 · 반경 · 필터 · 조회.
 *
 * **두 갈래(목록 · 지도)가 같은 모델을 쓴다.** 각자 갖고 있으면 보기를 전환할 때
 * 조건이 풀리고, 위치 권한 프롬프트가 화면마다 다른 순간에 뜬다.
 *
 * **반경과 필터는 URL 이 소유한다** (`useEmergencyNav` · architecture-guide.md §10).
 * 이 화면은 급할 때 링크로 건네는 화면이라 "24시간 · 40km" 를 좁혀 놓고 보낸 링크가
 * 받는 사람에게 기본 화면으로 열리면 안 된다. 새로고침·뒤로가기도 같은 이유다.
 *
 * **좌표는 URL 에 없다.** 공유 대상이 아니고(받는 사람의 기준점은 자기 위치다) URL 에
 * 실을 값도 아니다.
 *
 * **좌표를 먼저 구하고 그다음 조회한다.** `lat`/`lng` 가 필수라 순서가 뒤집히면 400 이다.
 * 좌표 요청은 **실패해도 좌표를 돌려준다**(제주 중심) — 이 화면은 급할 때 여는 화면이라
 * 위치 하나 때문에 비어 버리면 안 된다.
 *
 * **서버 프리페치를 하지 않는다.** 좌표가 브라우저에만 있어 서버가 무엇을 조회할지
 * 모른다 (`architecture-guide.md` §9 결정 트리 1번).
 */
export function useEmergencyBoard() {
  const [position, setPosition] = useState<PositionResult | null>(null)
  /*
    **"이 지역에서 재검색" 으로 옮겨 간 기준점** (#396). `null` 이면 내 위치를 쓴다.

    URL 에 싣지 않는다 — `radius`·`filters` 와 달리 이것은 **지금 지도를 어디로
    밀어 뒀는지**에 딸린 값이라, 링크로 건네면 받는 사람에게는 아무 뜻도 없는 좌표다.
    (좌표를 URL 에 두지 않는 이유는 이 훅 머리주석의 `position` 설명과 같다.)

    **반경은 그대로 쓴다.** 버튼의 뜻은 "같은 반경으로 여기를 보여줘" 다 — 보이는
    영역에서 반경을 역산해 넣으면 `radius` 칩이 말하는 값과 실제 조회 반경이 갈린다.
  */
  const [searchCenter, setSearchCenter] = useState<LatLng | null>(null)
  /*
    **권역 세그먼트로 고른 기준 지역** (#639). `null` 이면 고르지 않았다.

    **URL 에 두지 않는다** (세부명세 D3-1 · D8-4). `radius`·`filters` 는 "무엇을 보고 있나"
    라 링크로 건네는 값이지만, 기준점은 **필터가 아니라 세션 맥락**이다 — 내가 위치를
    쓸 수 없어 서귀포를 골랐다는 사실은 링크를 받는 사람에게 아무 뜻도 없다.
    (좌표를 URL 에 두지 않는 이유와 같다 — 이 훅 머리주석의 `position` 설명.)
  */
  const [regionCode, setRegionCode] = useState<JejuRegionCode | null>(null)
  const { filters, radius, setFilters, setRadius, widenRadius } = useEmergencyNav()

  /*
    **누를 때마다 다시 묻는다.** 마운트 때 받은 좌표를 재사용하면 사용자가 이동한 뒤
    누른 "내 위치" 가 옛 자리를 가리킨다.

    **`/places` 와 달리 조회도 다시 돈다** — `position` 이 query key 라서다. 이 화면은
    거리를 표시하고 정렬 근거로 쓰므로 기준점이 바뀌면 목록도 바뀌어야 한다.
  */
  const locate = useCallback(() => {
    // "내 위치" 는 옮겨 둔 기준점을 되돌리는 조작이기도 하다 (#396 · #639)
    setSearchCenter(null)
    setRegionCode(null)
    void getCurrentPosition().then(setPosition)
  }, [])

  /** 지도 중심으로 기준점을 옮긴다 — 반경은 그대로다 (#396) */
  const researchAt = useCallback((center: LatLng) => setSearchCenter(center), [])

  /**
   * 권역으로 기준점을 옮긴다 — 반경은 그대로다 (#639).
   *
   * **지도 재검색을 함께 비운다.** 둘이 동시에 살아 있으면 `resolveAnchor` 에서 지도가
   * 이겨(D3-1) 방금 누른 칩이 아무 일도 하지 않은 것처럼 보인다.
   *
   * `null` 을 주면 해제다 — 같은 칩을 다시 누르면 제주 중심 기준으로 돌아간다.
   */
  const researchAtRegion = useCallback((code: JejuRegionCode | null) => {
    setSearchCenter(null)
    setRegionCode(code)
  }, [])

  useEffect(() => {
    locate()
  }, [locate])

  /*
    조회 기준점과 그 기준의 이름. **우선순위는 순수 함수가 갖는다** (`resolve-anchor.ts`,
    세부명세 D3-1) — 네 갈래가 훅 안에 인라인으로 있으면 node 환경에서 잴 수 없다.

    **`query` 도 `camera` 도 이 하나를 본다** — 둘이 다른 점을 보면 "여기를 조회했다"
    는 주장과 화면이 보여주는 자리가 어긋난다.
  */
  const { anchor, basis } = resolveAnchor({ searchCenter, regionCode, position })

  const query = useNearbyFacilities(anchor, radius)

  const fallback: PositionFailure | null =
    position !== null && position.kind === 'fallback' ? position.reason : null

  /*
    지도 카메라. **`useMemo` 가 필수다** — 렌더 중에 새 객체를 만들면 `MapCanvas` 의
    카메라 effect 가 매 렌더 돌아 **필터 칩을 누를 때마다 지도가 되돌아간다.**
    이전 구현이 `center` 를 인라인 객체로 넘겨 실제로 그랬다.

    `spanMeters` 가 지름이다 — 반경 10km 를 담으려면 20km 폭이 필요하다.
  */
  const camera = useMemo(
    () =>
      anchor === null
        ? null
        : {
            anchor,
            spanMeters: radius * 2,
            /*
              **재검색으로 옮긴 자리는 화면 정중앙에 놓는다** (#578).

              기본 프레이밍(`JEJU_MAP_SEA_RATIO` = 0.35)은 **첫 화면**의 규칙이다 —
              제주 북쪽 해안을 위쪽 35% 에 두어 위는 바다, 아래는 육지로 열리게 한다.
              그런데 재검색의 기준점은 **사용자가 방금 보고 있던 지도 중심**이라, 같은
              규칙을 걸면 그 점이 35% 지점으로 올라가며 **화면이 통째로 남쪽으로 밀린다**
              (실측 약 4km). "여기를 보여줘" 라고 눌렀는데 다른 데를 보여주는 꼴이다.

              `anchorRatio: 0.5` 면 놓는 자리와 기준점이 같아져 지도가 움직이지 않고
              목록만 다시 조회된다.

              **권역 세그먼트도 같은 길로 간다** (#639). 사용자가 "서귀포" 를 고른 자리는
              재검색과 똑같이 **직접 지목한 자리**라 화면 정중앙이 맞다 — 35% 규칙을 걸면
              고른 권역이 위로 밀려 올라가 화면 아래 절반이 다른 권역이 된다.

              **`exactOptionalPropertyTypes` 라 키를 아예 뺀다** — `undefined` 를 넣으면
              타입이 맞지 않는다. 빠지면 `MapCanvas` 가 `JEJU_MAP_SEA_RATIO` 를 쓴다.
            */
            ...(searchCenter === null && regionCode === null ? {} : { anchorRatio: 0.5 }),
          },
    [anchor?.lat, anchor?.lng, radius, searchCenter === null, regionCode === null],
  )

  return {
    position,
    camera,
    /** null 이면 내 위치를 쓰고 있다. 값이 있으면 제주 중심 폴백이다 */
    fallback,
    /** 조회 기준점. 재검색·권역으로 옮겼으면 그 자리다 */
    anchor,
    /** 거리·정렬의 기준 — `map` · `region` · `current` · `jeju` (`resolve-anchor.ts`) */
    basis,
    /** 제주 중심 폴백에서만 거리를 감춘다 — 그 자리에서 480m 를 "480m" 로 쓸 수 없다 */
    showDistance: showsDistance(basis),
    /** 권역 세그먼트로 고른 기준 지역. `null` 이면 고르지 않았다 (#639) */
    regionCode,
    /** 권역으로 기준점을 옮긴다. `null` 이면 해제 (#639) */
    researchAtRegion,
    /** 재검색으로 기준점을 옮긴 상태인가 */
    researched: searchCenter !== null,
    researchAt,
    /** 제주 안에서만 "내 위치" 버튼을 그린다 — 밖에서는 눌러도 갈 곳이 없다 */
    inJeju: position !== null && position.kind === 'granted',
    radius,
    setRadius,
    widenRadius,
    canWiden: radius < MAX_RADIUS_METERS,
    filters,
    setFilters,
    query,
    locate,
  }
}
