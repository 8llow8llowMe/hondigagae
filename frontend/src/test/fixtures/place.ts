import type { PlaceDetail, PlaceSummary } from '@/types/place'

/**
 * 출처: backend PlaceItem (tour-service) 코드 실측 — 2026-08-26
 * 백엔드 기동 후 http://localhost:8082/v3/api-docs 로 재확인한다.
 *
 * 기본 fixture 에 긴 한국어 실데이터를 넣는다. 짧은 더미를 쓰면 오버플로 문제를
 * 영원히 못 잡는다. nullable 필드의 기본값은 null 로 둔다.
 */
export const placeSummary: PlaceSummary = {
  placeId: '212481712381923328',
  contentType: {
    code: 'TOURIST_SPOT',
    name: '관광지',
    description: '자연·문화 관광지',
  },
  title: '제주특별자치도립김창열미술관',
  addr1: '제주특별자치도 제주시 한림읍 용금로 906-107',
  sigunguCode: '4',
  lat: 33.3608276172,
  lng: 126.7818122232,
  firstImage: null,
  firstImage2: null,
  petAllowanceType: {
    code: 'PARTIALLY_ALLOWED',
    name: '부분 동반 가능',
    description: '일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다.',
  },
  allowedPetSize: {
    code: 'SMALL_ONLY',
    name: '소형견만 가능',
    description: '소형견만 동반이 가능합니다.',
  },
  maxPetWeightKg: 10,
  tel: null,
  indoor: true,
  sourceCategory: '미술관',
  sourceName: '문화정보원',
}

/** 좌표가 없는 장소 — 마커를 그리면 안 된다 */
export const placeWithoutCoordinate: PlaceSummary = {
  ...placeSummary,
  placeId: '212481712381923329',
  title: '좌표 미상 장소',
  lat: null,
  lng: null,
}

/**
 * 장소 상세.
 * 출처: backend PlaceDetailResponse / PlaceIntroItem / PlacePetInfoItem / PlaceImageItem
 *       (tour-service) 코드 실측 — 2026-08-27. 백엔드 기동 후 Swagger 로 재확인한다.
 *
 * **결합 데이터(intro / petInfo / images)가 전부 채워진 케이스다.** 비어 있는 케이스는
 * `placeDetailWithoutOptionalSections` 를 쓴다 — 숨김 처리를 검증하기 위해 분리했다.
 */
export const placeDetail: PlaceDetail = {
  placeId: '212481712381923328',
  contentId: '126439',
  contentType: {
    code: 'CULTURE',
    name: '문화시설',
    description: '박물관, 미술관 등 문화시설',
  },
  title: '제주특별자치도립김창열미술관',
  addr1: '제주특별자치도 제주시 한림읍 용금로 906-107',
  addr2: '(용금로)',
  zipcode: '63546',
  lat: 33.3608276172,
  lng: 126.4106264,
  firstImage: null,
  firstImage2: null,
  cpyrhtDivCd: 'Type1',
  tel: '064-710-4150',
  homepage: '<a href="https://www.visitjeju.net/kr" target="_blank">비짓제주</a>',
  overview: '제주 자연을 그대로 살린 공간이다.<br>야외 동선에서 반려견과 함께 산책할 수 있다.',
  petAvailable: true,
  petAllowanceType: {
    code: 'PARTIALLY_ALLOWED',
    name: '부분 동반 가능',
    description: '일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다.',
  },
  intro: {
    infoCenter: '064-710-4150',
    useTime: '09:00~18:00 (입장 마감 17:30)',
    restDate: '매주 월요일',
    parking: '가능',
    chkPet: '반려동물 동반 가능 (일부 구역)',
    chkBabyCarriage: '대여 가능',
    chkCreditCard: '가능',
  },
  petInfo: {
    acmpyTypeCd: '일부 구역 동반가능',
    acmpyPsblCpam: '전 견종 동반 가능',
    acmpyNeedMtr: '목줄 착용, 배변봉투 지참',
    etcAcmpyInfo:
      '전시실 내부에서는 이동장을 이용해 주세요.\n야외 정원은 목줄 착용 시 자유롭게 이용할 수 있습니다.',
    relaAcdntRiskMtr: '경사로가 있어 소형견은 안고 이동하시기를 권장합니다.',
    relaFrnshPrdlst: '배변봉투, 급수대',
    relaPosesFclty: '반려견 운동장',
    relaPurcPrdlst: '반려견 간식',
    relaRntlPrdlst: '이동장',
    allowanceScope: {
      code: 'PARTIAL',
      name: '일부 구역 동반 가능',
      description: '지정된 일부 구역에서만 반려동물 동반이 가능합니다.',
    },
    allowedPetSize: {
      code: 'ALL',
      name: '전 견종 가능',
      description: '견종·크기 제한 없이 동반이 가능합니다.',
    },
    leashRequired: true,
  },
  images: [
    {
      originImgUrl: 'http://tong.visitkorea.or.kr/cms/resource/mock/place-1.jpg',
      smallImageUrl: 'http://tong.visitkorea.or.kr/cms/resource/mock/place-1-thumb.jpg',
      imgName: '제주_김창열미술관 외관 (1)',
      cpyrhtDivCd: 'Type1',
    },
  ],
}

/**
 * 결합 데이터가 전부 비어 있는 상세.
 * **nullable 섹션은 에러가 아니라 숨김이다** — 이 fixture 로 숨김을 검증한다.
 */
export const placeDetailWithoutOptionalSections: PlaceDetail = {
  ...placeDetail,
  placeId: '212481712381923330',
  title: '정보가 적은 장소',
  addr1: null,
  addr2: null,
  zipcode: null,
  tel: null,
  homepage: null,
  overview: null,
  cpyrhtDivCd: null,
  contentId: null,
  intro: null,
  petInfo: null,
  images: [],
}
