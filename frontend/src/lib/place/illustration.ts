/**
 * 카테고리 일러스트 — 사진이 없는 장소의 타일을 채운다.
 *
 * **회색 "이미지 없음" 이 예외가 아니라 기본이었다.** dev 실측(2026-09-04, 제주 400건):
 * `firstImage` 가 없는 장소가 281건(70%)이고 숙박 87%·문화시설 95% 다. 원천 두 곳
 * (문화정보원·식약처)에는 이미지 필드 자체가 없어서, 백엔드가 TourAPI 에서 이름·좌표로
 * 빌려 채우는 백필을 넣었지만 **못 채운 장소는 남는다** — 그 자리를 이것이 담당한다
 * (backend `placeImageBackfillJob` 커밋 메시지가 같은 분담을 적어 두었다).
 *
 * **사진인 척하지 않는다.** 플랫 일러스트라 사진과 한눈에 구분되고, 우리가 모르는 것
 * (그 장소의 실제 모습)이 아니라 **아는 것(카테고리)** 만 말한다. 그래서 자산이 없는
 * 코드에는 아무것도 주지 않고 회색 타일로 떨어뜨린다 — 카테고리를 지어내지 않는다.
 *
 * **SVG 가 아니라 WebP 다** (2026-09-29). 풍경 도형이던 SVG 를 캐릭터 그림체의 정물(반려견
 * 물건 한두 개)로 다시 그렸고, 디테일이 늘어 벡터로 다시 따지 않았다. 그레인은 SVG 의
 * `feTurbulence` 와 같은 세기·크기로 구워 넣었다 — 프롬프트와 후처리는
 * `docs/features/brand/카테고리일러스트-프롬프트.md`. 사진 0장인 장소 상세에서 660 까지
 * 커지므로 1024 정사각을 유지한다.
 *
 * `contentType` 은 metadata 객체(`{code,name,description}`)로 오므로 호출부가 `code` 를
 * 넘긴다. **`name`(한국어)으로 고르지 않는다** — 서버 문구가 바뀌면 조용히 깨지고,
 * 한국어를 키로 쓰는 매핑 테이블은 이 저장소가 금지한다 (api-integration-guide §6).
 */
const BY_CONTENT_TYPE: Record<string, string> = {
  RESTAURANT: '/illustrations/place-restaurant.webp',
  LODGING: '/illustrations/place-lodging.webp',
  CULTURE: '/illustrations/place-culture.webp',
  TOURIST_SPOT: '/illustrations/place-tourist_spot.webp',
}

/** 그릴 일러스트의 경로. 없으면 `null` — 호출부가 회색 타일로 떨어뜨린다 */
export function placeIllustration(contentTypeCode: string | null): string | null {
  if (contentTypeCode === null || contentTypeCode.length === 0) return null

  return BY_CONTENT_TYPE[contentTypeCode] ?? null
}
