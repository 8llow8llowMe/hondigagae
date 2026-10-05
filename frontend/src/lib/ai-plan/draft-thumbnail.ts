import { listThumbnailSrc } from '@/lib/image/thumbnail'
import type { AiPlanScheduleItem } from '@/types/ai-plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 초안 항목 썸네일 — 공통명세 S6 (#1127).
 *
 * 세 값을 가른다. **`undefined` 와 `null` 은 다른 말이다**:
 *
 *  - `string` — 그릴 사진
 *  - `null` — **사진이 없다고 확정됐다.** 호출부가 유형 일러스트(없으면 회색 타일)로 떨어뜨린다
 *  - `undefined` — **아직 모른다**(보강 중). 회색 타일로 기다린다
 *
 * 보강 중에 일러스트를 먼저 그리면 사진이 있는 장소(30%)가 일러스트 → 사진으로 깜박인다.
 * 그래서 "없음" 을 확정할 때까지 일러스트를 미룬다.
 */
export type DraftThumbnail = string | null | undefined

/**
 * 보강 쿼리 하나의 결과에서 썸네일을 꺼낸다.
 *
 * **새 요청을 만들지 않는다** — 주소 · 실내 · 좌표를 이미 받는 `GET /places/{placeId}` 응답에
 * 사진이 함께 실려 온다 (`use-draft-places.ts`).
 *
 * **작은 사진(`firstImage2`)이 먼저다.** 이슈 본문은 `imageSrc(firstImage)` 였지만, 이 칸도
 * 80~96px 라 목록 썸네일과 같은 판단이 선다 (#1132 — 940px 원본은 장당 500KB+). 판정과
 * https 승격은 `listThumbnailSrc` 가 갖는다.
 *
 * **보강이 실패하면 `null` 이다** (404 병합 · 5xx). `retry: false` 라 다시 오지 않으므로
 * 회색으로 계속 기다리게 두지 않고 일러스트로 넘긴다.
 */
export function settledDraftThumbnail({
  pending,
  detail,
}: {
  pending: boolean
  detail: Pick<PlaceDetail, 'firstImage' | 'firstImage2'> | undefined
}): DraftThumbnail {
  if (pending) return undefined
  if (detail === undefined) return null

  return listThumbnailSrc(detail.firstImage2, detail.firstImage)
}

/**
 * 항목 한 줄의 썸네일.
 *
 * **`placeId` 가 null 인 항목은 기다리지 않는다** — 보강 대상이 아니라(`draftPlaceIds`)
 * 요청이 영영 오지 않는다. 처음부터 "사진 없음" 이다.
 */
export function draftItemThumbnail(
  item: AiPlanScheduleItem,
  thumbnails: ReadonlyMap<string, string | null>,
): DraftThumbnail {
  if (item.placeId === null) return null

  return thumbnails.has(item.placeId) ? thumbnails.get(item.placeId) : undefined
}
