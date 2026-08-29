'use client'

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

export const RECENT_PLACE_STORAGE_KEY = STORAGE_KEY
