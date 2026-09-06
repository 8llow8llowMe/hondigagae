'use client'

import { useMemo } from 'react'

import { useQueries } from '@tanstack/react-query'

import { PLACE_QUERY_OPTIONS, placeKeys } from '@/features/place/queries'
import { draftPlaceIds } from '@/lib/ai-plan/draft-to-plan'
import { clientFetch } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { placeDetailPath } from '@/lib/api/place'
import { type LatLng, toLatLng } from '@/lib/geo/coord'
import { isPlaceUnavailable } from '@/lib/place/availability'
import { placeMetaLine } from '@/lib/place/meta'
import type { AiPlanDraft } from '@/types/ai-plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 초안 항목 보강 — 명세 S6.
 *
 * 초안에는 주소가 없다 → **항목당 `GET /places/{placeId}`**. 방식과 캐시 키는 일정
 * 상세와 같다 (`features/plan/일정상세-세부명세.md` D3) — **`placeKeys.detail()` 을
 * 재사용**해야 장소 상세를 이미 본 항목이 요청 없이 채워진다.
 *
 * **`placeId` 가 null 인 항목은 부르지 않는다.** 이동 항목과 검증되지 않은 장소다
 * (`draftPlaceIds` 가 걸러낸다). **유형으로는 거르지 않는다** — 초안의 모든 `itemType` 은
 * `place.id` 를 가리킨다 (#89 · #252).
 *
 * **담을 수 없는 장소를 따로 모은다** — 담기가 `PLAN_004` 로 막힐 때 그 항목을 지목하기
 * 위해서다 (명세 S5 함정 3). 백엔드가 `findVisiblePlaceIds` 로 거르는 것이 둘인데
 * **응답에서 드러나는 모양이 다르다** (#146):
 *
 *  - **delisted(원천에서 사라짐)** — 상세는 **200** 으로 오고 본문 `delisted: true` 로만
 *    알 수 있다. 기존 일정이 참조하는 장소라 백엔드가 일부러 계속 응답한다
 *  - **병합(`mergedIntoId`)** — 이쪽이 **404** 다
 *
 * 예전에는 404 만 보고 delisted 라고 불렀다. 그 판정은 *병합된* 장소에만 걸리고 정작
 * delisted 는 한 번도 잡지 못했다 — 사용자는 경고 없이 담기에서 400 을 맞았다.
 *
 * 좌표도 같은 응답에서 꺼낸다 (#100). 초안에 좌표가 없어 직선거리를 재려면 이 보강이
 * 유일한 출처다 — 별도 조회를 만들지 않는다.
 *
 * 실내 여부도 같은 응답에서 온다 (#112). **행이 쓸 메타 줄을 여기서 조립한다** — 행은
 * 표시 전용이라 `indoor` 의 null 판정을 컴포넌트에 두면 렌더 테스트에서만 잡힌다.
 */
export function useDraftPlaces(draft: AiPlanDraft | null) {
  const placeIds = useMemo(() => (draft === null ? [] : draftPlaceIds(draft)), [draft])

  const results = useQueries({
    queries: placeIds.map((placeId) => ({
      queryKey: placeKeys.detail(placeId),
      queryFn: () => clientFetch<PlaceDetail>(placeDetailPath(placeId)),
      staleTime: PLACE_QUERY_OPTIONS.staleTime,
      gcTime: PLACE_QUERY_OPTIONS.gcTime,
      /*
        **404 는 재시도하지 않는다** — 병합돼 사라진 장소는 다시 물어도 없다. 전역 기본값이
        이미 404 를 제외하지만, 여기서는 항목이 여러 개라 재시도가 겹치면 미리보기가
        늦게 채워진다.
      */
      retry: false,
    })),
  })

  return useMemo(() => {
    const metaLines = new Map<string, string>()
    const coords = new Map<string, LatLng>()
    const delisted = new Set<string>()

    results.forEach((result, index) => {
      const placeId = placeIds[index]
      if (placeId === undefined) return

      const detail = result.data

      /*
        **판정은 `lib/place/availability.ts` 가 갖는다.** 여기에 인라인으로 두었던 것이
        `404 === delisted` 라는 오판이었고, 훅이라 테스트가 닿지 않아 오래 살아남았다
        (testing-guide.md §1 — "순수 함수를 뽑아 테스트한다").
      */
      if (
        isPlaceUnavailable({
          detail,
          errorStatus: result.error instanceof ApiError ? result.error.status : null,
        })
      ) {
        delisted.add(placeId)
      }

      /*
        **여기서 return 하지 않는다.** delisted 장소는 200 이라 주소·좌표가 멀쩡히 실려
        있고, 미리보기는 "이 장소가 왜 빠지는지" 를 보여줘야 한다. 404 면 아래가 알아서
        비어 있다.
      */
      if (detail === undefined) return

      /*
        `addr2` 는 상세 주소라 목록 행에는 붙이지 않는다 — 한 줄이 길어진다.
        실내 낱말은 `indoor` 가 null 이면 빠진다 — "야외" 로 단정하지 않는다 (#112).
      */
      const meta = placeMetaLine(detail.addr1, detail.indoor)
      if (meta !== null) metaLines.set(placeId, meta)

      /*
        **좌표가 없거나 0 인 장소는 넣지 않는다.** `toLatLng` 가 그 판정을 갖고 있고,
        비어 있으면 그 항목의 거리 문구가 사라진다 — 0m 를 쓰지 않는다 (#100).
      */
      const coord = toLatLng(detail)
      if (coord !== null) coords.set(placeId, coord)
    })

    return {
      metaLines,
      coords,
      /** 담을 수 없는 장소 — delisted(200 + 플래그)와 병합(404)이 함께 들어 있다 */
      delistedPlaceIds: delisted,
      /** 아직 채워지는 중인가. 미리보기를 막지는 않는다 — 주소가 늦게 붙을 뿐이다 */
      loading: results.some((result) => result.isPending),
    }
  }, [results, placeIds])
}
