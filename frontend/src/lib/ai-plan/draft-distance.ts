import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import type { AiPlanScheduleItem } from '@/types/ai-plan'

/**
 * 초안 항목의 직선거리 — 이슈 #100.
 *
 * **계산은 `lib/geo/distance.ts` 다.** 같은 함수를 화면마다 만들면 반드시 갈린다 —
 * 일정 상세(`lib/plan/detail.ts`)와 임계값·표기를 공유하는 것이 이 모듈의 존재 이유고,
 * 여기에는 "무엇을 기준으로 재는가" 만 있다.
 *
 * **기준은 직전 항목 하나뿐이다.** 일정 상세는 일자의 첫 항목을 *앞선 날의 숙소* 기준으로
 * 재지만(`lodgingBasisFor`), 초안에서는 그 기준을 찾을 수 없다 — `AiPlanScheduleItem.itemType`
 * 은 **LLM 산출 raw string** 이라 숙소가 `LODGING` 이 아닌 표기로 올 수 있고, 그러면 숙소가
 * 아닌 항목을 "숙소에서" 라고 말하게 된다. `draftToPlanPayload` 가 `isPlanItemType` 으로
 * 걸러내는 것과 같은 이유다. 담은 뒤 일정 상세는 enum 으로 정규화된 값을 보므로 안전하다.
 */

/**
 * 한 일자의 항목별 직선거리(m). 입력과 **같은 길이·같은 순서**로 돌려준다.
 *
 * `null` 인 자리는 거리를 렌더하지 않는다. 세 경우다:
 *  - **첫 항목** — 기준이 없다
 *  - **직전 항목의 좌표를 모른다** — `placeId` 가 null 인 `MOVE` 이거나 보강 실패다
 *  - **이 항목의 좌표를 모른다**
 *
 * `0` 을 쓰지 않는다 — `haversineMeters` 와 같은 이유로 0m 는 "같은 자리" 라는 뜻이다.
 */
export function draftItemDistances(
  items: readonly AiPlanScheduleItem[],
  coordOf: (item: AiPlanScheduleItem) => LatLng | null,
): (number | null)[] {
  return items.map((item, index) => {
    /*
      **좌표가 있는 마지막 항목까지 거슬러 올라가지 않는다.** 직전이 이동 항목이면 거리를
      말하지 않는 편이 낫다 — 두 칸 건너뛴 거리를 "직선 N km 이동" 이라고 적으면 그 사이
      이동을 없는 것으로 만든다. 일정 상세도 직전 항목만 본다 (`toItemRows`).
    */
    const previous = index === 0 ? undefined : items[index - 1]
    if (previous === undefined) return null

    return haversineMeters(coordOf(previous), coordOf(item))
  })
}
