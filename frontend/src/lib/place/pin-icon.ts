import type { MapPinIcon } from '@/lib/map/pin-icons'
import { isCafePlace } from '@/lib/place/cafe'

/**
 * 장소 → 지도 핀 아이콘 (#1280, `docs/features/place/지도핀-세부명세.md` D2-1).
 *
 * **`contentType.code` 로 고른다 — 한국어 `name` 으로 고르지 않는다** (`illustration.ts` 와 같은 규칙).
 * 모르는 코드는 범용 핀이다 — 분류를 지어내지 않는다.
 */
const BY_CODE: Record<string, MapPinIcon> = {
  TOURIST_SPOT: 'landscape',
  RESTAURANT: 'utensils',
  LODGING: 'bed',
  CULTURE: 'museum',
  FESTIVAL: 'flag',
  COURSE: 'footprints',
  LEPORTS: 'bike',
  SHOPPING: 'bag',
}

export function placePinIcon(place: {
  contentType: { code: string }
  sourceCategory: string | null
}): MapPinIcon {
  if (isCafePlace(place)) return 'coffee'
  const code = place.contentType.code
  // 자기 키만 본다 — 평범한 객체라 `constructor` 같은 프로토타입 키가 `??` 를 지나친다
  return (Object.hasOwn(BY_CODE, code) ? BY_CODE[code] : undefined) ?? 'pin'
}
