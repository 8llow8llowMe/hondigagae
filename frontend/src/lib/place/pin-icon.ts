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
  return BY_CODE[place.contentType.code] ?? 'pin'
}
