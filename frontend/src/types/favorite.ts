/**
 * 장소 즐겨찾기(저장).
 *
 * 근거: backend plan-service favorite 컨텍스트 — `FavoriteWebController` /
 * `FavoritePlacesResponse` / `FavoritePlaceItem` **소스 실측** (2026-08-31).
 * 확인 방법: http://localhost:8083/v3/api-docs — 백엔드 미기동 상태에서는 소스 실측 기준이다.
 *
 * 주의
 *  - `placeId` 는 문자열이다. 백엔드 내부는 long(Snowflake)이고 응답 DTO 가 String 으로
 *    내려준다. number 로 타이핑하면 정밀도가 손상된다.
 *  - **저장·해제 응답에 본문이 없다** (`Response<Void>`). 저장 후 상태는 목록을 다시
 *    받아서 안다 — 응답에서 읽을 수 없다.
 *  - **저장일이 없다.** `FavoriteEntity` 는 `BaseEntity` 를 상속해 DB 에는 있지만
 *    응답 DTO 에 노출되지 않는다. 아트보드 `혼디가개 저장한 장소` 03 이 요구하므로
 *    BE 후속 요청으로 남겼다 (`docs/features/favorite/저장한장소-세부명세.md` D9-1).
 *  - **커서가 없다.** `SliceResponse` 가 아니라 전량이다 (상한 100곳).
 */

/**
 * 즐겨찾기 목록 항목.
 *
 * **`placeId` 를 제외한 전부가 null 일 수 있다.** 장소 요약은 tour-service 에서 붙이는데
 * 그 조회가 실패해도 placeId 목록은 내려간다 (컨트롤러 설명 명시). 화면은 요약이 비어도
 * 행을 지우지 않고 placeId 로 상세에 갈 수 있게 남긴다.
 */
export type FavoritePlaceItem = {
  placeId: string
  /** 장소명. 요약 조회 실패 시 null */
  title: string | null
  contentTypeName: string | null
  addr: string | null
  petAllowanceName: string | null
  /** 실내 여부. **null 은 "야외" 가 아니라 "원천에 정보 없음" 이다** (`types/place.ts` 와 같은 축) */
  indoor: boolean | null
  firstImage: string | null
}

/** `GET /favorites/places` — 최근 저장순. `SliceResponse` 가 아니다 */
export type FavoritePlaceList = {
  places: FavoritePlaceItem[]
  totalCount: number
}
