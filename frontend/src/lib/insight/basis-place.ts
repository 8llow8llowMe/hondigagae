/**
 * 판정 기준의 **대표 지점** — 홈-첫방문-판정-세부명세 D3-2.
 *
 * 첫 방문 · 새 기기 · 시크릿 모드에는 `localStorage` 가 비어 있어 기준 장소가 없었고,
 * 그때 홈은 판정 섹션 자체를 그리지 않았다 — 서비스의 첫 문장("지금 가도 되나")이
 * 첫 화면에 없다는 뜻이다. 기준이 없을 때 여기로 떨어뜨린다.
 *
 * **`recent-place.ts` 와 갈라 둔다.** 저쪽은 사용자가 고른 것을 담는 저장소이고, 이쪽은
 * 아무것도 고르지 않았을 때의 기본값이다. 한 모듈에 두면 `'use client'` 가 붙은 저장소
 * 때문에 이 상수까지 클라이언트 경계에 묶인다.
 *
 * **대표 지점의 이름을 여기 적지 않는다.** 화면은 서버가 준 `placeTitle` 만 쓴다 —
 * 이름을 FE 가 들고 있으면 서버 데이터가 갈릴 때 화면이 없는 장소의 이름을 말한다.
 */

/**
 * 사라봉공원 (제주시 건입동 · 33.5160, 126.5462). 근거: dev `GET /places` 실측(2026-09-15).
 *
 * 제주시 도심 안이고 `JEJU_QUERY_CENTER`(제주시청)에서 약 2.3km 인 시민 산책지라
 * "산책 판정" 의 기준으로 뜻이 맞는다. `placeId` 는 TourAPI `contentId` 축이라 dev·운영이
 * 같다고 본다 — 갈리면 명세 D5-3(대표 지점 404 → 미렌더)이 받는다.
 */
const FALLBACK_PLACE_ID = '126454'

/** 빈 문자열은 값이 아니다 — `.env` 에 키만 남기고 값을 비우는 실수를 상수로 되돌린다 */
const OVERRIDE = process.env.NEXT_PUBLIC_DEFAULT_BASIS_PLACE_ID

/**
 * 기준이 없을 때 쓰는 장소 id.
 *
 * `NEXT_PUBLIC_DEFAULT_BASIS_PLACE_ID` 로 덮어쓸 수 있다 (`.env.example`). 운영 DB 의
 * id 축이 갈리거나 대표 지점이 내려갔을 때 **배포 없이** 바꿀 자리를 남겨 둔다 —
 * `NEXT_PUBLIC_` 은 빌드 시점에 인라인되므로 재빌드는 필요하다.
 */
export const DEFAULT_BASIS_PLACE_ID: string =
  OVERRIDE === undefined || OVERRIDE === '' ? FALLBACK_PLACE_ID : OVERRIDE

/**
 * 지금 판정의 기준이 사용자가 고른 장소가 아니라 대표 지점인가.
 *
 * 참이면 판정 기준 줄 아래에 그 사실을 말하는 캡션이 붙는다 (D4 `basisDefaultNote`).
 * **`null`(기준 없음)은 거짓이다** — 그때는 캡션을 붙일 판정 줄 자체가 없다.
 */
export function isDefaultBasis(placeId: string | null): boolean {
  return placeId !== null && placeId === DEFAULT_BASIS_PLACE_ID
}
