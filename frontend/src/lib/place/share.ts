import { canUseShareSheet, shareSheetOutcome } from '@/lib/plan/share-link'

/**
 * 장소 공유 (#1233 D2 ④) — 지도 미리보기 행동 줄의 `공유`.
 *
 * **공유하는 것은 상세 정규 주소다** (`/places/{id}`), 지도 주소(`?place=`)가 아니다. 받는 사람은
 * 지도 맥락이 없고, 상세는 정규 주소 · 공유 카드(OG)가 이미 있다 (#1130 · #1186).
 */
export function placeShareUrl(origin: string, placeId: string): string {
  return `${origin}/places/${encodeURIComponent(placeId)}`
}

/** 테스트가 가짜를 넣을 수 있게 `Navigator` 에서 쓰는 것만 받는다 */
export type ShareNavigator = Partial<Pick<Navigator, 'share' | 'canShare'>> & {
  clipboard?: Pick<Clipboard, 'writeText'>
}

export type ShareOutcome = 'shared' | 'copied' | 'canceled' | 'failed'

/**
 * 공유 시트 → 링크 복사 순서로 시도한다.
 *
 * - 시트가 있으면(`canUseShareSheet` — 기능으로 판정) 연다. **사용자가 닫은 것(`AbortError`)은
 *   실패가 아니다** — 보내지 않기로 한 것이라 아무것도 띄우지 않는다(`canceled`).
 * - 시트가 없거나(데스크톱 대부분) 거절되면 링크를 복사한다.
 * - 클립보드도 없거나 막히면 `failed` — 호출부가 알린다.
 *
 * 판정 함수는 일정 공유(#1183)와 같은 것을 쓴다 — 같은 기기에서 두 화면이 다르게 굴지 않는다.
 */
export async function sharePlace(
  nav: ShareNavigator,
  target: { title: string; url: string },
): Promise<ShareOutcome> {
  if (canUseShareSheet(nav, target.url) && nav.share !== undefined) {
    try {
      await nav.share(target)
      return 'shared'
    } catch (error) {
      if (shareSheetOutcome(error) === 'canceled') return 'canceled'
    }
  }

  return (await copyText(nav, target.url)) ? 'copied' : 'failed'
}

/** 클립보드에 쓴다. 클립보드가 없거나(비 HTTPS · 구형) 막히면 거짓 — 조용히 실패하지 않게 호출부가 알린다 */
export async function copyText(nav: ShareNavigator, text: string): Promise<boolean> {
  if (nav.clipboard === undefined) return false
  try {
    await nav.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
