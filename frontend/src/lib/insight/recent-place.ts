'use client'

import { toErrorStatus } from '@/lib/api/error'

/**
 * 최근 본 장소 — 공통명세 S5-1 (선택지 A).
 *
 * 홈 전용 API 가 없어 판정의 기준 장소를 FE 가 정해야 한다. 사용자가 방금 본 장소면
 * 맥락이 있고, 화면에 `{장소명} 기준` 을 명시하므로 오해가 없다.
 *
 * `localStorage` 에 `placeId` 하나만 남긴다 — **토큰이 아니므로 허용된다**
 * (`auth-guide.md` 는 토큰만 금지한다).
 *
 * BE 가 홈 요약 API 를 주면(S6-1) 이 모듈과 `resolveBasisPlaceId()` 호출부만 바뀐다.
 */
const STORAGE_KEY = 'hdg_recent_place'

export function readRecentPlaceId(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    // 사파리 프라이빗 모드 등에서 던진다. 기준이 없으면 판정 섹션을 렌더하지 않을 뿐이다
    return null
  }
}

export function writeRecentPlaceId(placeId: string): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, placeId)
  } catch {
    // 저장 실패는 무시한다
  }
}

/**
 * 저장된 기준 장소를 버린다.
 *
 * **읽기와 달리 실패를 삼키는 것으로 끝나지 않는다** — 호출부가 화면 상태도 함께
 * 되돌려야 한다 (`home-view` 의 `setRecentPlaceId(null)`). 여기서는 저장소만 비운다.
 */
export function clearRecentPlaceId(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // 사파리 프라이빗 모드 등. 지우지 못해도 화면은 이미 기준 없이 그린다
  }
}

/**
 * 기준 장소 조회 실패가 **그 장소가 더 이상 없다**는 뜻인가 (#530).
 *
 * `localStorage` 에 남은 id 는 서버 데이터가 갈리면 죽는다 — 배치가 장소를 내리거나
 * dev 와 운영의 id 축이 다를 때다. 그때 홈은 `오늘 판정을 불러오지 못했어요` 로 굳었고,
 * **첫 방문자와 달리 빠져나갈 길이 없었다** — 재시도는 영원히 같은 404 를 받고, 저장된
 * id 를 지울 화면 장치가 없다.
 *
 * **404 하나만이다.** 5xx·무응답은 장소가 없어진 것이 아니라 지금 못 부르는 것이고,
 * 그때 저장된 기준을 버리면 다음 방문에 멀쩡한 판정을 잃는다 (`lib/api/error.ts` —
 * 404 는 데이터 부재, 5xx 가 일시 장애다).
 */
export function isBasisPlaceGone(error: unknown): boolean {
  return toErrorStatus(error) === 404
}

export const RECENT_PLACE_STORAGE_KEY = STORAGE_KEY
