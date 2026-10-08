import type { MapSdkFailure } from '@/lib/map/sdk'
import { messages } from '@/lib/messages'
import { PLACE_PREVIEW_KEY } from '@/lib/url/place-preview'

/**
 * 지도 SDK 가 실패했을 때 — **안내 화면이 아니라 그 화면의 목록 보기로 보낸다** (#1289, 사용자 결정
 * 2026-10-08).
 *
 * 예전에는 지도 자리에 안내 한 줄 + 축소판 목록을 그렸다. 그 목록에는 필터 칩 · 레일 · 초기화가 없어
 * 진짜 목록 보기(`?view=list`)보다 못했고, 카카오 키 도메인이 안 맞거나 쿼터가 넘으면 **모든 사용자가**
 * 그 화면을 봤다. 세 지도 화면(`/places` · `/emergency` · 일정 담기)은 모두 목록 보기가 있다.
 *
 * 이동 자체는 `features/map/use-map-failure-fallback.ts` 가 한다 — 여기는 문구와 주소만 정한다.
 */

/** 목록으로 옮긴 **뒤에** 뜨는 토스트라 이미 일어난 일로 말한다. 사유마다 할 말이 다르다 */
export function mapFailureMessage(reason: MapSdkFailure): string {
  if (reason === 'no-key') return messages.map.errorNoKey
  if (reason === 'unsupported') return messages.map.errorUnsupported
  return messages.map.errorScript
}

/**
 * 목록 보기 주소에서 **미리보기(`?place=`)만 뺀다** — 목록 보기에는 미리보기가 없다. 필터 · 검색어 ·
 * 해시는 그대로다. 상대 주소를 그대로 돌려주므로 `router.replace` 에 바로 넣는다.
 */
export function fallbackListHref(listHref: string): string {
  const url = new URL(listHref, 'http://local')
  url.searchParams.delete(PLACE_PREVIEW_KEY)
  const query = url.searchParams.toString()

  return `${url.pathname}${query === '' ? '' : `?${query}`}${url.hash}`
}
