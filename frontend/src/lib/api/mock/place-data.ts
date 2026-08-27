import type { PlaceSummary } from '@/types/place'

/**
 * 개발용 장소 데이터.
 *
 * **실제 공공데이터가 아니라 계약을 근거로 만든 개발용 fixture 다.**
 * 백엔드 batch(`placeImportJob`)가 데이터를 적재하기 전까지 화면을 확인하기 위한 것이며,
 * `MOCK_API=true` 일 때만 BFF 가 이 값을 돌려준다 (`src/lib/api/mock/index.ts`).
 *
 * 계약 근거: backend `PlaceItem` (tour-service) — 2026-08-26 origin/develop
 *
 * 데이터를 만들 때 지킨 것:
 *  - 긴 한국어 이름을 섞는다 (오버플로가 기본 경로에서 드러나야 한다)
 *  - nullable 필드를 실제로 비운다 (`firstImage` / `tel` / `addr1` / `indoor`)
 *  - `indoor: null` 인 장소를 포함한다 — 원천에 정보가 없으면 어느 필터에도 안 잡힌다
 *  - metadata 는 백엔드 enum 의 실제 name/description 을 그대로 쓴다
 *  - 좌표는 제주 범위(위도 33.1~33.6 / 경도 126.1~126.9)
 */

const CONTENT = {
  TOURIST_SPOT: { code: 'TOURIST_SPOT', name: '관광지', description: '자연·문화 관광지' },
  CULTURE: { code: 'CULTURE', name: '문화시설', description: '박물관, 미술관 등 문화시설' },
  LEPORTS: { code: 'LEPORTS', name: '레포츠', description: '레저 및 스포츠 시설' },
  LODGING: { code: 'LODGING', name: '숙박', description: '호텔, 펜션 등 숙박 시설' },
  RESTAURANT: { code: 'RESTAURANT', name: '음식점', description: '음식점, 카페' },
  SHOPPING: { code: 'SHOPPING', name: '쇼핑', description: '시장, 상점 등 쇼핑 시설' },
} as const

const PET = {
  ALLOWED: {
    code: 'ALLOWED',
    name: '동반 가능',
    description: '반려동물 동반이 가능한 장소입니다.',
  },
  PARTIALLY_ALLOWED: {
    code: 'PARTIALLY_ALLOWED',
    name: '부분 동반 가능',
    description: '일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다.',
  },
  NOT_ALLOWED: {
    code: 'NOT_ALLOWED',
    name: '동반 불가',
    description: '반려동물 동반이 불가능한 장소입니다.',
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    name: '정보 없음',
    description: '반려동물 동반 가능 여부 정보가 확인되지 않은 장소입니다.',
  },
} as const

type Seed = Omit<PlaceSummary, 'placeId'>

const SEEDS: Seed[] = [
  {
    contentType: CONTENT.CULTURE,
    title: '제주특별자치도립김창열미술관',
    addr1: '제주특별자치도 제주시 한림읍 용금로 906-107',
    sigunguCode: '4',
    lat: 33.3608276172,
    lng: 126.4106264,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.PARTIALLY_ALLOWED,
    tel: '064-710-4150',
    indoor: true,
    sourceCategory: '미술관',
    sourceName: '문화정보원',
  },
  {
    contentType: CONTENT.TOURIST_SPOT,
    title: '가세오름',
    addr1: '제주특별자치도 서귀포시 표선면 가시리',
    sigunguCode: '3',
    lat: 33.3616666,
    lng: 126.7818122,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.ALLOWED,
    tel: null,
    indoor: false,
    sourceCategory: '여행지',
    sourceName: '관광정보 API',
  },
  {
    contentType: CONTENT.RESTAURANT,
    title: '오설록 티뮤지엄 카페',
    addr1: '제주특별자치도 서귀포시 안덕면 신화역사로 15',
    sigunguCode: '2',
    lat: 33.3057,
    lng: 126.2895,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.PARTIALLY_ALLOWED,
    tel: '064-794-5312',
    indoor: true,
    sourceCategory: '카페',
    sourceName: '식약처',
  },
  {
    contentType: CONTENT.LODGING,
    title: '애월 반려견 동반 독채 펜션 하나로',
    addr1: '제주특별자치도 제주시 애월읍 애월해안로 376',
    sigunguCode: '4',
    lat: 33.4636,
    lng: 126.3092,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.ALLOWED,
    tel: '064-799-0000',
    indoor: true,
    sourceCategory: '펜션',
    sourceName: '관광정보 API',
  },
  {
    contentType: CONTENT.TOURIST_SPOT,
    title: '함덕 서우봉 해변',
    addr1: '제주특별자치도 제주시 조천읍 조함해안로 519-10',
    sigunguCode: '4',
    lat: 33.5432,
    lng: 126.6695,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.ALLOWED,
    tel: null,
    // 원천에 실내 정보가 없다 — indoor 필터 어느 쪽에도 잡히지 않는다
    indoor: null,
    sourceCategory: null,
    sourceName: '관광정보 API',
  },
  {
    contentType: CONTENT.LEPORTS,
    title: '제주 곶자왈 반려견 산책 트레킹 코스',
    // 주소가 비어 있는 케이스 — 카드에서 주소 줄이 숨겨져야 한다
    addr1: null,
    sigunguCode: '2',
    lat: 33.2841,
    lng: 126.3612,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.ALLOWED,
    tel: null,
    indoor: false,
    sourceCategory: null,
    sourceName: '관광정보 API',
  },
  {
    contentType: CONTENT.SHOPPING,
    title: '동문재래시장',
    addr1: '제주특별자치도 제주시 관덕로14길 20',
    sigunguCode: '4',
    lat: 33.5124,
    lng: 126.5271,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.NOT_ALLOWED,
    tel: '064-752-3001',
    indoor: false,
    sourceCategory: '시장',
    sourceName: '관광정보 API',
  },
  {
    contentType: CONTENT.CULTURE,
    title: '제주현대미술관',
    addr1: '제주특별자치도 제주시 한경면 저지14길 35',
    sigunguCode: '4',
    lat: 33.3437,
    lng: 126.2696,
    firstImage: null,
    firstImage2: null,
    petAllowanceType: PET.UNKNOWN,
    tel: '064-710-7801',
    indoor: true,
    sourceCategory: '미술관',
    sourceName: '문화정보원',
  },
]

/**
 * 무한 스크롤을 확인할 수 있게 seed 를 반복해 늘린다.
 *
 * ID 는 **하나의 기준값에서 순번으로만** 파생시킨다. seed 의 id 에 순번을 더하면
 * seed id 자체가 연속이라 페이지 간에 값이 겹친다 (실제로 겪었고 테스트가 잡았다).
 */
const ID_BASE = 212481712381923328n
const PAGES = 4

export const MOCK_PLACES: PlaceSummary[] = Array.from({ length: PAGES }, (_, page) =>
  SEEDS.map((seed, index) => {
    const ordinal = page * SEEDS.length + index

    return {
      ...seed,
      // 문자열 ID 를 유지한다 — 숫자로 다루면 정밀도가 손상된다
      placeId: String(ID_BASE + BigInt(ordinal)),
      title: page === 0 ? seed.title : `${seed.title} ${page + 1}호점`,
    }
  }),
).flat()
