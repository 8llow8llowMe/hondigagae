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

/** 작업이 제한 시간을 넘겼다 — 백엔드 `AiPlanErrorCode.JOB_TIMEOUT` */
export const JOB_TIMEOUT = 'AIPLAN_006'

/**
 * 제한 시간 초과에 기간 단축을 권할 수 있는가 — #710.
 *
 * **서버 문구는 무슨 일이 났는지까지만 말한다.** `AI 일정 생성이 제한 시간을 넘겼습니다.`
 * 를 읽은 사용자가 **할 수 있는 일**은 응답 어디에도 없다. `isNarrowedRegionFailure`
 * (#251)와 같은 성격의 단서다 — 서버 문구를 대신하지 않고 아래에 덧붙인다.
 *
 * **하루짜리에는 붙이지 않는다.** 1일 일정에 "하루 줄이면 빨라져요" 는 **할 수 없는 일을
 * 시키는 것**이고, 그 순간 다른 안내까지 흘려 읽게 된다 (#251 이 좁히지 않은 지역에
 * "넓혀 보세요" 를 붙이지 않기로 한 것과 같은 판단).
 *
 * **다른 실패 코드에는 붙이지 않는다.** 후보 장소가 없어 실패한 사람에게 기간을 줄이라고
 * 하면 원인을 잘못 짚는다 — 오히려 후보가 더 줄어든다.
 *
 * 기간을 모르면(`totalDays` 가 null) 붙이지 않는다. 조건을 잃은 상태라 하루인지 아닌지
 * 가릴 수 없고, 모르는 채로 권하는 쪽이 틀릴 여지가 크다.
 */
export function isShortenablePeriodTimeout(
  errorCode: string | null | undefined,
  totalDays: number | null | undefined,
): boolean {
  if (errorCode !== JOB_TIMEOUT) return false

  return typeof totalDays === 'number' && totalDays > 1
}
