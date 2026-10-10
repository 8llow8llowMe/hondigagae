/**
 * 초안 항목 종류의 표시명.
 *
 * **여기만 FE 한국어 매핑 테이블을 둔다.** enum metadata 규칙("FE 매핑 테이블 금지",
 * `api-integration-guide.md` §6)은 서버가 `name` 을 함께 주는 metadata 객체를 대상으로
 * 한다. `AiPlanScheduleItem.itemType` 은 **표시명 없는 raw string** 이라 매핑 외에
 * 방법이 없다 — 장소 상세의 `cpyrhtDivCd` 와 같은 예외다.
 *
 * 값은 백엔드 `PlanItemType` 의 `displayName` 복제본이다. 담은 뒤에는 서버가
 * `PlanItemDetail.itemType` 을 metadata 로 주므로 **이 표는 담기 전 화면에서만 쓰인다.**
 */
const LABELS: Record<string, string> = {
  PLACE: '장소',
  MEAL: '식사',
  LODGING: '숙박',
  WALK: '산책',
  MOVE: '이동',
}

/**
 * 모르는 코드는 **null 이다.** 코드 문자열을 그대로 노출하면 화면에 `CAFE` 가 뜬다 —
 * 라벨을 렌더하지 않는 편이 낫다 (모르는 코드 폴백은 필수다).
 */
export function itemTypeLabel(itemType: string): string | null {
  return LABELS[itemType] ?? null
}
