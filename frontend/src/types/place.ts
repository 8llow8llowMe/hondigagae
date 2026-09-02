import type { EnumMetadata } from '@/types/api'
import type { PetSizeCode } from '@/types/pet'

/**
 * 근거: backend PlaceItem / PlaceDetailResponse (tour-service)
 * 확인 방법: http://localhost:8082/v3/api-docs — 백엔드 미기동 상태에서는 코드 실측 기준이다.
 *
 * 주의
 *  - placeId 는 문자열이다. 백엔드 내부는 long(Snowflake 크기)이지만 응답 DTO가
 *    String 으로 내려준다. number 로 타이핑하면 정밀도가 손상된다.
 *  - 좌표는 백엔드가 이미 lat / lng (Double) 로 정규화했다.
 *    TourAPI 원본의 mapx(경도) / mapy(위도) 문자열이 그대로 오지 않는다.
 *  - contentType / petAllowanceType 은 metadata 객체다. name / description 을 그대로 렌더한다.
 */
export type PlaceSummary = {
  placeId: string
  contentType: EnumMetadata
  title: string
  addr1: string | null
  sigunguCode: string | null
  lat: number | null
  lng: number | null
  firstImage: string | null
  firstImage2: string | null
  petAllowanceType: EnumMetadata
  /** 입장 가능 반려견 크기. **상세 응답의 `petInfo.allowedPetSize` 와 같은 축이다** */
  allowedPetSize: EnumMetadata
  /** 입장 가능 체중 상한(kg). **원문에 숫자가 있을 때만 온다** — null 은 "제한 없음" 이 아니라 "모름" 이다 */
  maxPetWeightKg: number | null
  tel: string | null
  /** 실내 여부. **null 이면 원천에 정보가 없다** — indoor 필터의 true/false 어느 쪽에도 잡히지 않는다 */
  indoor: boolean | null
  /** 원본 분류 (원천이 준 값 그대로). 콘텐츠 타입으로 갈리지 않는 구분에 쓴다 (예: 카페, 펜션) */
  sourceCategory: string | null
  /** 정보 출처 표시명 (예: 문화정보원) */
  sourceName: string
}

/**
 * 장소 상세 (`GET /api/v1/places/{placeId}` — `PlaceDetailResponse`).
 *
 * 목록(`PlaceSummary`)과 필드 집합이 다르다. **`sigunguCode` 는 상세 응답에 없다** — 목록 항목에만
 * 있고 #16 범위가 아니었다. 상세에서 시군구로 갈리는 표시를 만들지 않는다.
 * 근거: backend PlaceDetailResponse / PlacePresenter#toDetailResponse (tour-service, 2026-08-31)
 */
export type PlaceDetail = {
  placeId: string
  /** 원천이 TourAPI 가 아니면 `null` 이다 (#17 반영 — 그전에는 문자열 `"null"` 이었다) */
  contentId: string | null
  contentType: EnumMetadata
  title: string
  addr1: string | null
  addr2: string | null
  zipcode: string | null
  lat: number | null
  lng: number | null
  firstImage: string | null
  firstImage2: string | null
  /** 저작권 유형 (Type1 / Type3 — 출처 표기 의무). TourAPI 원천에서만 채워진다 */
  cpyrhtDivCd: string | null
  tel: string | null
  /** **HTML anchor 포함 원문.** parseHomepage() 로 href 만 뽑아 쓴다 */
  homepage: string | null
  /** **HTML 태그가 섞인 원문.** toPlainText() 로 평문화해 쓴다 */
  overview: string | null
  petAvailable: boolean
  /**
   * **원천에서 사라진 장소인가.** `true` 면 폐업·등록 철회 등으로 더 이상 확인되지 않는
   * 곳이다 — 백엔드 `@Schema` 가 *"화면에서 그렇게 안내해야 한다"* 고 적었다.
   *
   * **`true` 여도 상세는 200 으로 온다.** 기존 일정(`plan_item`)이 참조하는 장소가 원천에서
   * 빠졌다고 일정 화면까지 깨지면 안 되기 때문이다
   * (`PlaceRepository.findByIdAndMergedIntoIdIsNull`). `GET /places/{placeId}` 가 **404** 를
   * 내는 것은 *병합된*(`mergedIntoId != null`) 장소뿐이다 — 둘을 뒤바꿔 읽지 않는다 (#146).
   *
   * 새로 참조하는 쪽은 백엔드가 막는다: 일정 담기는 `PLAN_004`, 즐겨찾기 저장은
   * `FAVORITE_001` 로 400 이다. **저장 해제(DELETE)는 가시성 검사를 타지 않아 그대로 된다.**
   */
  delisted: boolean
  petAllowanceType: EnumMetadata
  /**
   * 실내 여부. **`null` 은 "야외" 가 아니라 "원천에 정보 없음" 이다** — `false` 와 다르게 다룬다
   * (#16 · #112). 판정은 `lib/place/indoor.ts` 가 갖고 있다.
   */
  indoor: boolean | null
  /** 원본 분류 (원천이 준 값 그대로 — `카페` `펜션` `미술관`). `contentType` 으로 갈리지 않는 구분이다 */
  sourceCategory: string | null
  /** 정보 출처 **표시명** (`문화정보원` `관광정보 API` `식약처`). 코드가 아니라 서버 문구다 */
  sourceName: string | null
  /** **객체 통째로 null 이 될 수 있다** — 에러가 아니라 섹션 숨김이다 */
  intro: PlaceIntro | null
  /** **객체 통째로 null 이 될 수 있다** */
  petInfo: PlacePetInfo | null
  /** null 이 아니다. 최소 빈 배열이다 (백엔드가 .stream().toList() 로 만든다) */
  images: PlaceImage[]
}

/** 소개 정보. 원문 그대로 내려오는 값들이라 전부 nullable 이다 */
export type PlaceIntro = {
  infoCenter: string | null
  useTime: string | null
  restDate: string | null
  parking: string | null
  /** 애완동물 동반 가능 원문. **판단은 petInfo 우선** (백엔드 DTO 주석) */
  chkPet: string | null
  chkBabyCarriage: string | null
  chkCreditCard: string | null
}

/** 반려동물 동반 정보. 원문 9종은 nullable, 가공값 3종은 non-null 이다 */
export type PlacePetInfo = {
  acmpyTypeCd: string | null
  acmpyPsblCpam: string | null
  acmpyNeedMtr: string | null
  /** 개행 포함 장문 (TEXT 컬럼) */
  etcAcmpyInfo: string | null
  relaAcdntRiskMtr: string | null
  relaFrnshPrdlst: string | null
  relaPosesFclty: string | null
  relaPurcPrdlst: string | null
  relaRntlPrdlst: string | null
  /** 가공값 — 엔티티가 nullable = false 다 */
  allowanceScope: EnumMetadata
  allowedPetSize: EnumMetadata
  leashRequired: boolean
}

export type PlaceImage = {
  originImgUrl: string | null
  smallImageUrl: string | null
  imgName: string | null
  cpyrhtDivCd: string | null
}

/** 목록 필터 — 백엔드 PlaceWebController 의 RequestParam 과 이름을 일치시킨다 */
export type PlaceFilters = {
  areaCode: string
  sigunguCode: string | null
  contentType: ContentTypeCode | null
  petAllowanceType: PetAllowanceCode | null
  /** true 면 실내만. **원천에 정보가 없는 장소(indoor === null)는 어느 쪽으로도 잡히지 않는다** */
  indoor: boolean | null
  allowedPetSize: AllowedPetSizeCode | null
  /**
   * 내 반려견 크기. **받아 주지 않는 것으로 확인된 곳만 뺀다** — 정보 없음인 곳은 남는다.
   * 아트보드의 "몽실이가 들어갈 수 있는 곳만" 이 이 파라미터다 (`PlaceWebController#getPlaces`).
   *
   * `allowedPetSize` 와 다르다. 저쪽은 **장소의 속성**을 직접 고르는 축이고, 이쪽은
   * **내 반려견을 기준**으로 거르는 축이다. 화면에서는 이쪽만 쓴다 — 판정의 화자를 유지한다.
   */
  petSizeType: PetSizeCode | null
  /**
   * 내 반려견 체중(kg) 기준. **`petSizeType` 과 같은 축이고 함께 켜진다** —
   * 아트보드의 "몽실이가 들어갈 수 있는 곳만" 체크 하나가 둘을 같이 보낸다.
   *
   * **정수다.** 백엔드 파라미터가 `Integer` 라 3.5kg 는 그대로 못 보낸다 —
   * 올림해서 보낸다 (`lib/pet/weight.ts` 의 `toPlaceFilterWeight`).
   */
  petWeightKg: number | null
  /** 원본 분류 자유 문자열 (예: 카페) */
  sourceCategory: string | null
}

/**
 * 백엔드 ContentType enum 의 name().
 * TODO(BE 확인): Spring 기본 바인딩은 name() 기준이므로 `?contentType=TOURIST_SPOT` 을 전제한다.
 * 코드값("12") 바인딩용 컨버터가 있는지 Swagger 로 확인한다.
 */
export const CONTENT_TYPE_CODES = [
  'TOURIST_SPOT',
  'CULTURE',
  'FESTIVAL',
  'COURSE',
  'LEPORTS',
  'LODGING',
  'SHOPPING',
  'RESTAURANT',
] as const
export type ContentTypeCode = (typeof CONTENT_TYPE_CODES)[number]

/** 입장 가능 반려견 크기 (backend AllowedPetSize) */
export const ALLOWED_PET_SIZE_CODES = ['ALL', 'SMALL_ONLY', 'SMALL_MEDIUM', 'UNKNOWN'] as const
export type AllowedPetSizeCode = (typeof ALLOWED_PET_SIZE_CODES)[number]

export const PET_ALLOWANCE_CODES = [
  'ALLOWED',
  'PARTIALLY_ALLOWED',
  'NOT_ALLOWED',
  'UNKNOWN',
] as const
export type PetAllowanceCode = (typeof PET_ALLOWANCE_CODES)[number]

/**
 * 주변 장소 검색 (`GET /api/v1/places/nearby`).
 * 목록과 달리 커서가 아니라 `totalCount` 를 준다 — 건수 표기가 가능하다.
 */
export type NearbyPlaceItem = {
  place: PlaceSummary
  distanceMeters: number
}

export type NearbyPlaceResult = {
  places: NearbyPlaceItem[]
  totalCount: number
  radius: number
}
