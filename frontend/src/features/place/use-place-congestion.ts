'use client'

import { useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { congestionsPath } from '@/lib/api/insight'
import type { CongestionDays } from '@/lib/insight/congestion'
import { INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import { isPlaceId } from '@/lib/place/place-id'
import type { PlaceCongestionResponse } from '@/types/insight'

/**
 * 이 장소의 기간 혼잡도 (#430).
 *
 * **반려견 조건을 받지 않는다** — 적합도·산책 위험도와 갈리는 지점이다. 붐빔은 장소와
 * 날짜의 속성이라 반려견이 바뀌어도 같은 답이고, 조건을 key 에 섞으면 반려견 전환마다
 * 같은 응답을 다시 받아 온다.
 *
 * **`staleTime` 은 인사이트 표준값(5분 / 30분 / retry 1)이다.** 예보가 아니라 30일 rolling
 * 예측이라 더 짧게 둘 이유가 없고, 같은 카드에 선 판정 둘과 리듬이 갈리면 한쪽만 새 값이
 * 되는 순간이 생긴다.
 *
 * `placeholderData` 로 이전 값을 유지한다 — 7일 ↔ 30일을 오갈 때 스켈레톤으로 되돌아가면
 * 카드 높이가 뛰어 눌린 버튼이 손가락 밑에서 움직인다.
 */
export function usePlaceCongestion(placeId: string, days: CongestionDays) {
  /*
    **형식이 틀린 `placeId` 면 켜지 않는다** (#496). 컨트롤러가 `@PathVariable long` 이라
    답이 400 으로 정해져 있다 — 적합도·산책 위험도 훅과 같은 가드다.
  */
  const enabled = isPlaceId(placeId)

  return useQuery({
    queryKey: insightKeys.congestions(placeId, days),
    queryFn: () => clientFetch<PlaceCongestionResponse>(congestionsPath(placeId, days)),
    placeholderData: (previous) => previous,
    enabled,
    ...INSIGHT_QUERY_OPTIONS,
  })
}
