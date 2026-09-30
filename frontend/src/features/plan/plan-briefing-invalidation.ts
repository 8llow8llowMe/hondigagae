import type { QueryClient } from '@tanstack/react-query'

import { planKeys } from '@/features/plan/queries'

/**
 * 일정 쓰기 뒤 출발 전 브리핑 무효화 (#1055).
 *
 * 브리핑은 인사이트 표준값(5분)이라 스스로는 금방 낡지 않는다. 그런데 응답의 절반이 예보가
 * 아니라 **그 일정의 입력 그대로**다 (`PlanBriefingProcessor.brief`):
 *
 * | 브리핑이 읽는 것                                | 바꾸는 쓰기                                        |
 * | ----------------------------------------------- | -------------------------------------------------- |
 * | 그날 항목의 시각 · 방문 여부 · 구성 · 순서      | 시각 단건 저장 · 방문 체크 · 일자 일괄 교체 전 경로 |
 * | 일정 기간(`resolveDay`) · 제목 · 동행 반려견    | 일정 수정                                          |
 * | 반려견 특성 (완료 일정은 완료 시점 스냅샷, #629) | 상태 변경 · 반려견 수정                            |
 *
 * **한 곳으로 모은 이유**: 판정(`weather`) · 산책 위험도(`walkSafety`)는 경로마다 무효화 여부가
 * 갈려(방문 체크는 둘 다 안 버린다) 각 호출처가 자기 근거를 적는다. 브리핑은 **갈리지 않는다** —
 * 위 쓰기 전부가 버린다. 갈리지 않는 규칙을 호출처마다 key 로 적으면 새 담기 경로가 생길 때
 * 조용히 빠진다(#1055 가 그렇게 났다). 빠짐은 `plan-briefing-invalidation.test.ts` 가 쓰기 API
 * 기준으로 훑어 잡는다.
 *
 * **날짜를 가리지 않는다.** 어느 날짜의 브리핑이 영향받는지 화면이 가려내면 서버 규칙을
 * 복제한다. 브리핑은 별도 라우트라 쓰기 순간에는 대개 관찰자가 없어, 받지 않고 낡음 표시만
 * 남는다 — 비용은 다시 열 때 조회 한 번이다.
 *
 * 기다리지 않는 호출처는 `void` 로 부른다 (주변 무효화와 같은 결).
 */
export function invalidatePlanBriefing(queryClient: QueryClient, planId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: planKeys.briefings(planId) })
}

/**
 * 반려견 특성 수정 뒤 — **모든 일정**의 브리핑을 버린다 (#1055).
 *
 * 진행 중인 일정은 판정마다 특성을 다시 읽는다(`PlanWeatherProcessor.loadConditions`). 그 아이와
 * 동행하는 일정을 가려내려면 일정 캐시를 뒤져야 하는데, 캐시에 없는 일정의 브리핑도 남아 있을
 * 수 있어 prefix 로 통째로 버린다. 관찰자가 없으면 낡음 표시뿐이라 싸다.
 */
export function invalidateAllPlanBriefings(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: planKeys.briefingAll() })
}
