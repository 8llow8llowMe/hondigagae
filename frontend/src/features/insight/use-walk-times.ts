'use client'

import { useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { walkTimesPath } from '@/lib/api/insight'
import { conditionKey, INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import type { PetCondition, WalkTimesResponse } from '@/types/insight'

/**
 * 오늘의 산책 골든타임 조회 훅.
 *
 * **`features/home` 이 아니라 `features/insight` 에 산다** (#618 · 공통명세 S6-3).
 * 홈과 산책 코스 상세가 같은 엔드포인트를 같은 key 로 부르는데, 한쪽 feature 안에 두면
 * 다른 쪽이 feature 를 가로질러 임포트해야 한다 (`architecture-guide.md` §3).
 * key·옵션은 이미 `lib/insight/queries.ts` 공용이고 이 훅만 홈에 남아 있었다.
 *
 * **홈의 동작은 바뀌지 않는다** — 파일만 옮겼다.
 */
/**
 * 오늘의 산책 골든타임 (#158 · #180).
 *
 * **좌표가 정해질 때까지 조회하지 않는다.** `getCurrentPosition()` 은 거부·타임아웃에도
 * 제주 중심 좌표를 돌려주므로 결국 값이 오지만, 기다리지 않고 먼저 쏘면 **잘못된 지점의
 * 곡선을 한 번 보여 준 뒤 갈아치우게 된다** — 판정 화면에서 답이 바뀌면 못 믿는다.
 *
 * 반려견을 바꾸면 조건 key 가 갈려 재조회되고, `placeholderData` 로 이전 곡선을 유지한다 —
 * 깜빡이면 바꾼 것이 반영됐는지 알 수 없다 (홈-세부명세 D4-2).
 */
export function useWalkTimes(
  position: { lat: number; lng: number } | null,
  condition: PetCondition | null,
) {
  return useQuery({
    queryKey: insightKeys.walkTimes(
      position?.lat ?? null,
      position?.lng ?? null,
      conditionKey(condition),
    ),
    // `enabled` 가 거짓인 동안 실행되지 않는다 — 좌표 단언은 그 뒤에만 닿는다
    queryFn: () =>
      clientFetch<WalkTimesResponse>(
        walkTimesPath(
          (position as { lat: number; lng: number }).lat,
          (position as { lat: number; lng: number }).lng,
          condition,
        ),
      ),
    enabled: position !== null,
    placeholderData: (previous) => previous,
    ...INSIGHT_QUERY_OPTIONS,
  })
}
