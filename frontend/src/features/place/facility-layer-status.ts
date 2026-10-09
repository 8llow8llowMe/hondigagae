import { countsAreComplete } from '@/features/emergency/facility-filters'
import { ApiError, shouldOfferRetry } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { toLatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import type { NearbyFacilityResult } from '@/types/emergency'

/**
 * 병원 · 약국 층이 지금 무엇을 말해야 하나 (#1286 `지도시설토글-세부명세.md` D5).
 *
 * **토글 값과 조회 결과를 한 곳에서 묶는다.** 조회 훅은 `placeholderData: previous` 라 끈 뒤에도 직전 응답이
 * 남아 보인다 — 끔을 먼저 보지 않으면 꺼진 층의 핀 · 알림이 그대로 선다(`useFacilityLayer` 머리주석).
 * 순수 함수로 떼어 갈래를 node 테스트로 잠근다(`testing-guide.md` §1).
 */
export type FacilityLayerStatus =
  | { kind: 'off' }
  | { kind: 'loading' }
  /** `count` = 지도에 실제로 서는 수(좌표 있는 곳). `truncated` = `size` 상한에서 잘림 */
  | { kind: 'shown'; count: number; truncated: boolean }
  /**
   * `retry` — 5xx · 무응답이라 다시 시도할 수 있다(훅이 이미 1회 재시도한 뒤다). 4xx 는 `false` 이고
   * `message` 가 서버 `resultMessage`(없으면 일반 문구)다 — 404 류에 재시도를 달지 않는다.
   */
  | { kind: 'failed'; retry: boolean; message: string }

export function facilityLayerStatus({
  on,
  data,
  error,
}: {
  on: boolean
  data: NearbyFacilityResult | undefined
  error: unknown
}): FacilityLayerStatus {
  if (!on) return { kind: 'off' }

  /*
    **받은 것이 있으면 그린다.** 백그라운드 재조회만 실패한 경우(1분 뒤 `openNow` 갱신)에 지도에서 시설을
    걷어 내면, 방금 보던 핀이 이유 없이 사라진다.
  */
  if (data !== undefined) {
    return {
      kind: 'shown',
      count: data.facilities.filter((item) => toLatLng(item) !== null).length,
      truncated: !countsAreComplete(data),
    }
  }

  if (error !== null && error !== undefined) {
    const retry = shouldOfferRetry(error)
    return {
      kind: 'failed',
      retry,
      // `resultMessage` 는 백엔드 타입이 Object 다 — 렌더 직전 문자열로 좁힌다
      message: retry
        ? messages.map.facilityLoadFailed
        : toMessage(
            error instanceof ApiError ? error.rawMessage : null,
            messages.map.facilityLoadFailed,
          ),
    }
  }

  return { kind: 'loading' }
}
