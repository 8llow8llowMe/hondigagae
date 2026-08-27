import type { BadgeTone } from '@/components/badge'

/**
 * 반려견 동반 등급의 **색만** FE가 매핑한다.
 * 표시 문구는 서버 metadata 의 `name` 을 그대로 쓴다 — docs/api-integration-guide.md §6.
 * 목록 카드와 상세가 같은 색을 써야 하므로 여기 한 곳에 둔다.
 */
const PET_TONE: Record<string, BadgeTone> = {
  ALLOWED: 'brand',
  PARTIALLY_ALLOWED: 'warn',
  NOT_ALLOWED: 'neutral',
}

/** 모르는 code 는 기본값으로 떨어져 화면이 비지 않는다 (component-guide.md §4) */
export function petTone(code: string): BadgeTone {
  return PET_TONE[code] ?? 'neutral'
}
