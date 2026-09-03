/**
 * 일자 판정의 기준 반려견 이름 (#152 · #176).
 *
 * 서버는 일자마다 `basisPetId` 를 주는데 **그 아이는 대표(`petIds[0]`)가 아니라 그날 점수가
 * 가장 낮은 아이다** (`PlanWeatherProcessor.pickBasisPet`) — 한 마리라도 힘든 날이면 그날은
 * 힘든 날이라는 규칙이다. 그래서 **기준 아이는 날마다 다를 수 있고**, 화면이 일정 단위로
 * "이 일정은 초코 기준" 이라고 말하면 안 된다.
 */
export function basisPetNameOf(
  basisPetId: string | null,
  planPetIds: readonly string[],
  petNames: ReadonlyMap<string, string>,
): string | null {
  /*
    **한 마리 일정에는 붙이지 않는다.** 기준이 그 아이뿐이라 이름이 정보를 더하지 않고,
    대다수 일정에 줄이 하나 늘어난다. 지금까지의 화면과 같게 둔다.
  */
  if (planPetIds.length < 2) return null

  // 판정을 못 낸 날은 기준도 없다 (`briefDay` 가 basisPetId 를 비운다)
  if (basisPetId === null) return null

  /*
    **이름을 못 찾으면 생략한다.** 삭제된 반려견이거나 목록 조회가 실패한 경우인데,
    id 를 그대로 노출하거나 "알 수 없음" 을 붙이면 화면이 더 나빠진다.
  */
  return petNames.get(basisPetId) ?? null
}
