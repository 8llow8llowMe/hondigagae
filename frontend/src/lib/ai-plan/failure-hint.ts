/** 조건에 맞는 반려견 동반 장소를 찾지 못했다 — 백엔드 `AiPlanErrorCode.NO_PLACE_CANDIDATES` */
export const NO_PLACE_CANDIDATES = 'AIPLAN_012'

/**
 * 좁힌 지역이 실패의 원인일 수 있는가 — #251.
 *
 * **서버는 이것을 말해 줄 수 없다.** `AIPLAN_012` 는 "후보를 찾지 못했다" 까지이고,
 * 요청에 `sigunguCode` 가 있었다는 사실은 응답에 실리지 않는다. 좁혔다는 것을 아는 쪽은
 * 보관한 조건을 든 **화면뿐이라** 판정이 여기 있다.
 *
 * **좁히지 않았으면 붙이지 않는다.** 제주 전체로 만들다 실패한 사람에게 "지역을 넓혀
 * 보세요" 는 할 수 없는 일을 시키는 것이고, 그 순간 다른 안내까지 흘려 읽게 된다.
 *
 * 다른 실패 코드에도 붙이지 않는다 — 기간·예산 문제에 지역을 권하면 원인을 잘못 짚는다.
 */
export function isNarrowedRegionFailure(
  errorCode: string | null | undefined,
  sigunguCode: string | null | undefined,
): boolean {
  if (errorCode !== NO_PLACE_CANDIDATES) return false

  return typeof sigunguCode === 'string' && sigunguCode !== ''
}
