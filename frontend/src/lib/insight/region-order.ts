import type { RegionWeatherItem } from '@/types/insight'

/**
 * 권역 비교 목록의 순서 — **점수 높은 순.**
 *
 * **서버 순서는 지리 순서다** (`NORTH` · `SOUTH` · `EAST` · `WEST` · `HALLA`). 그대로
 * 쓰면 추천 권역이 목록 어디에 있을지 알 수 없다 — dev 실측(2026-09-08)에서
 * `제주시 85 · 서귀포 85 · 동부 85 · 서부 85 · 한라산 100` 이라 **100점짜리가 맨 끝**에
 * 섰다. 바로 위 문장은 "오늘은 한라산권이 가장 나아요" 라고 말하는데, 눈은 목록을 끝까지
 * 훑어야 그것을 찾는다. 이 섹션이 답하는 질문이 "어느 권역이 나은가" 인 이상 순위가
 * 곧 그 답이다.
 *
 * **`null` 은 맨 뒤다. 0 이 아니다.** 예보를 못 받아 판정하지 않은 권역이라(`weatherScore`
 * 주석) 0점으로 섞으면 "가장 나쁜 곳" 으로 읽힌다 — 모르는 것을 나쁜 것으로 말하지 않는다.
 *
 * **동점은 서버 순서를 지킨다.** 위 실측처럼 넷이 85 로 같은 날이 흔한데, 그때까지 순서가
 * 흔들리면 매일 같은 자리를 보던 사용자가 목록을 다시 읽어야 한다. `sort` 가 안정 정렬이라
 * (ES2019+) 동점 구간은 지리 순서 그대로 남는다.
 *
 * **입력을 변형하지 않는다.** `regions` 는 쿼리 캐시가 들고 있는 배열이라 제자리 정렬하면
 * 캐시된 응답이 바뀐다.
 */
export function sortRegionsByScore(regions: RegionWeatherItem[]): RegionWeatherItem[] {
  return [...regions].sort((a, b) => {
    if (a.weatherScore === null && b.weatherScore === null) return 0
    if (a.weatherScore === null) return 1
    if (b.weatherScore === null) return -1

    return b.weatherScore - a.weatherScore
  })
}
