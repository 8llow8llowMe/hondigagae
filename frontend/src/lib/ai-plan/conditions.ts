import type { AiPlanJobConditions, AiPlanRequestSnapshot } from '@/types/ai-plan'

/**
 * 서버가 내린 생성 조건을 화면 보관본으로 옮긴다 — 이슈 #498 (서버 쪽은 #488).
 *
 * **왜 필요한가.** 조건이 `sessionStorage` 에만 있던 동안, 대기 화면의 약속
 * *"주소를 남겨 두면 다시 볼 수 있어요"* 는 **보기까지만** 참이었다. 다른 브라우저에서
 * 같은 주소를 열면 초안은 전부 그려지는데 하단이 `조건을 다시 알려 주세요` 로 바뀌고,
 * 거기서 갈 수 있는 곳은 **처음부터 다시 만드는 길**뿐이었다 — 눈앞의 초안을 살리는
 * 길이 아니다. 이제 서버가 조건을 함께 내리므로 그 초안을 그대로 담을 수 있다.
 *
 * **보관본이 있으면 호출부가 그쪽을 먼저 쓴다.** 서버 조건에는 `pinnedPlaces` ·
 * `preferFavorites` 가 없다 — `POST /plans` 가 받지 않는 값이라 서버가 일부러 뺐다.
 * 담기에는 없어도 되지만, 있는 쪽을 버릴 이유는 없다.
 */

/**
 * 담기에 쓸 조건. `null` 이면 담을 수 없다.
 *
 * @param petNameOf `petId` → 이름. 못 찾으면 빈 문자열을 줘도 된다 — 이름은 **일정 제목
 *   기본값에만** 쓰이고 비어 있어도 흐름이 막히지 않는다 (`AiPlanRequestSnapshot.pets`).
 *   그래도 맞추는 이유는 같은 초안을 어느 브라우저에서 담든 **같은 제목**이 나와야 해서다.
 */
export function snapshotFromConditions(
  conditions: AiPlanJobConditions | null,
  petNameOf: (petId: string) => string,
): AiPlanRequestSnapshot | null {
  if (conditions === null) return null

  /*
    **반려견이 없으면 복원하지 않는다.** 서버는 이것을 "제출 때 지정하지 않아 회원의 대표
    반려견으로 짰다" 는 뜻으로 쓰는데, **어느 아이였는지는 응답에 없다.** 화면이 목록의
    첫 아이로 짐작하면 다른 아이에게 일정이 붙을 수 있다 — 담기는 `petIds[0]` 을 대표
    반려견으로 박아 넣는다 (`PlanCreateRequest`). 그럴 바에는 조건을 다시 받는 편이 낫다.

    이 화면이 제출한 작업은 폼이 반려견을 필수로 받으므로 여기 걸리지 않는다.
  */
  if (conditions.petIds.length === 0) return null

  return {
    areaCode: conditions.areaCode,
    startDate: conditions.startDate,
    endDate: conditions.endDate,
    pets: conditions.petIds.map((petId) => ({ petId, name: petNameOf(petId) })),
    budget: conditions.budget,
    // 보관본은 빈 문자열을 "없음" 으로 쓴다. 서버는 null 이라 여기서 맞춘다
    requestNote: conditions.requestNote ?? '',
    /*
      **`sigunguCode` 는 옮긴다.** 제출 본문으로 다시 나가는 값이라 빠뜨리면 조건이
      말없이 넓어진다 (`AiPlanRequestSnapshot.sigunguCode` 주석).

      **`pinnedPlaces` · `preferFavorites` 는 옮길 값이 없다.** 서버 계약에 아예 없다 —
      빈 값으로 채우지 않고 **없는 채로 둔다.** 그래서 이 복원본으로는 "같은 조건으로 다시
      만들기" 를 하지 않는다 — 호출부(`ai-plan-job-view`)가 재제출에는 보관본만 넘긴다.
    */
    sigunguCode: conditions.sigunguCode,
  }
}
