import { messages } from '@/lib/messages'

/**
 * `cpyrhtDivCd`(Type1 / Type3) 를 화면 문구로 옮긴다.
 *
 * **enum metadata 가 아니라 표시명이 없는 raw string 이라 FE 매핑 외에 방법이 없다.**
 * "FE에 코드→한국어 매핑 테이블을 만들지 않는다"(docs/api-integration-guide.md §6)는
 * 서버가 `name` 을 함께 주는 metadata 객체에 대한 규칙이다. 대신 **모르는 코드 폴백**을 둔다.
 *
 * 이 값은 배치의 TourApiPlaceCatalogAdapter 에서만 채워진다 → 값이 있으면 원천이 TourAPI 다.
 */
const LABEL: Record<string, string> = {
  Type1: messages.place.detailCopyrightType1,
  Type3: messages.place.detailCopyrightType3,
}

export function copyrightLabel(code: string | null): string | null {
  if (code === null || code.trim().length === 0) return null

  return LABEL[code] ?? messages.place.detailCopyrightUnknown
}
