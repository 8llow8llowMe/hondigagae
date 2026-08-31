import { shortAddress } from '@/lib/place/address'
import { indoorLabel } from '@/lib/place/indoor'

/**
 * 장소 행의 메타 줄 — `제주시 한림읍 · 야외` (이슈 #112).
 *
 * 목록 행 · 일정 항목 행 · AI 초안 항목 행이 **같은 한 줄**을 만든다. 세 곳이 각자
 * `[주소, 실내].filter().join(' · ')` 를 쓰고 있어서 하나로 모았다 — 조각이 하나만
 * 있을 때 빈 구분자(`· 야외`)가 남는 실수가 세 번 날 자리였다.
 *
 * **장소 상세는 이것을 쓰지 않는다.** 거기는 `contentType` 이 가운데 끼는 3조각이다.
 *
 * 둘 다 없으면 `null` 이고, 그때 호출부는 줄 자체를 렌더하지 않는다 — 빈 문자열을
 * 돌려주면 호출부마다 `!== ''` 를 기억해야 한다.
 */
export function placeMetaLine(addr1: string | null, indoor: boolean | null): string | null {
  const parts = [shortAddress(addr1), indoorLabel(indoor)].filter(
    (part): part is string => part !== null && part !== '',
  )

  return parts.length === 0 ? null : parts.join(' · ')
}
