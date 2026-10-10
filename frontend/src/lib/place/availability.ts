import type { PlaceDetail } from '@/types/place'

/**
 * 새로 참조할 수 없는 장소인가 — 이슈 #146.
 *
 * 백엔드가 `findVisiblePlaceIds` 로 거르는 것이 둘인데 **응답에서 드러나는 모양이 다르다.**
 * 이 차이를 화면마다 다시 판단하면 또 어긋난다:
 *
 * | 사유 | 상세 응답 | 근거 |
 * | --- | --- | --- |
 * | 원천에서 사라짐(delisting) | **200 + `delisted: true`** | 기존 일정이 참조하는 장소라 계속 응답한다 |
 * | 병합(`mergedIntoId`) | **404** | 대표 장소로 합쳐져 이 아이디는 더 이상 노출되지 않는다 |
 *
 * **404 만 보면 delisted 를 한 번도 잡지 못한다.** 실제로 그랬고, AI 초안이 경고 없이
 * 담기에서 `PLAN_004` 400 을 맞았다 (#146).
 *
 * 결론이 같아 하나로 묶는다 — 담기(`PLAN_004`)도 즐겨찾기 저장(`FAVORITE_001`)도 양쪽 다
 * 400 이다. **저장 해제(DELETE)는 여기에 해당하지 않는다** — 가시성 검사를 타지 않는다.
 */
export function isPlaceUnavailable({
  detail,
  errorStatus,
}: {
  /** 상세 응답. 아직 못 받았으면 `undefined` */
  detail: Pick<PlaceDetail, 'delisted'> | undefined
  /** 실패한 요청의 HTTP 상태. 성공이면 `null` */
  errorStatus: number | null
}): boolean {
  if (errorStatus === 404) return true

  /*
    **아직 못 받았으면 `false` 다.** 조회 중에 "담을 수 없음" 으로 표시하면 응답이 온 뒤
    번복해야 하고, 그 깜빡임이 실제 delisting 보다 자주 보인다.
  */
  return detail?.delisted === true
}
