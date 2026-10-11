import { messages } from '@/lib/messages'
import type { PlaceSummary } from '@/types/place'

/**
 * 장소 담기 화면의 **한 번 더 확인** — 이슈 #1383 · 일정상세-세부명세 D24-4.
 *
 * 담기 화면은 `동반 가능만` 을 기본으로 켜지만(`placeFilterDefaults`) 사용자가 끌 수 있다.
 * 그때 `동반 불가` · 미확인 장소가 반려견 일정에 곧바로 들어가지 않게 **같은 버튼을 한 번 더
 * 누르게** 하고, 그 사이에 이유를 행 안에 말한다.
 *
 * **모달이 아니다.** 담기는 되돌릴 수 있는 일이라 `ConfirmModal`(되돌릴 수 없는 일만)을 쓰지
 * 않는다 (`styling-guide.md` §3-2).
 */
export type AddPlaceConfirmReason = 'NOT_ALLOWED' | 'UNKNOWN'

/**
 * 확인이 필요한 이유. 바로 담아도 되면 `null`.
 *
 * `ALLOWED` · `PARTIALLY_ALLOWED` 는 바로 담는다. **모르는 코드는 미확인으로 본다** — 서버
 * enum 이 늘어도 확인 없이 담기는 쪽으로 새지 않는다.
 */
export function addPlaceConfirmReason(place: PlaceSummary): AddPlaceConfirmReason | null {
  const code = place.petAllowanceType.code
  if (code === 'ALLOWED' || code === 'PARTIALLY_ALLOWED') return null
  return code === 'NOT_ALLOWED' ? 'NOT_ALLOWED' : 'UNKNOWN'
}

/** 확인을 기다리는 행에 붙는 한 줄 */
export function addPlaceConfirmNotice(reason: AddPlaceConfirmReason): string {
  return reason === 'NOT_ALLOWED'
    ? messages.plan.addPlaceConfirmNotAllowed
    : messages.plan.addPlaceConfirmUnknown
}
