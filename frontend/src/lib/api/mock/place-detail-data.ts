import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import type { PlaceDetail, PlaceImage, PlaceIntro, PlacePetInfo } from '@/types/place'

/**
 * 개발용 장소 상세 데이터.
 *
 * **계약을 근거로 만든 fixture 다.** 근거: backend `PlaceDetailResponse` / `PlaceIntroItem` /
 * `PlacePetInfoItem` / `PlaceImageItem` / `PlacePresenter#toDetailResponse` (tour-service, 2026-08-27).
 *
 * 기본 필드는 목록 fixture(`MOCK_PLACES`)에서 파생시킨다. 목록과 상세가 다른 장소를 보여주면
 * 개발 중에만 존재하는 착시가 생긴다.
 *
 * 데이터를 만들 때 지킨 것:
 *  - **intro / petInfo 가 통째로 null 인 케이스**를 반드시 포함한다 (섹션 숨김이 기본 경로에 드러나야 한다)
 *  - **images 가 빈 배열인 케이스**를 포함한다
 *  - homepage 는 **HTML anchor 원문**, overview 는 **`<br>` 섞인 원문** 으로 둔다
 *  - etcAcmpyInfo 는 개행 포함 장문으로 둔다 (TEXT 컬럼)
 *  - 상세 응답에는 sigunguCode / indoor / sourceCategory / sourceName 이 없다 (이슈 #16)
 */

const SCOPE = {
  FULL_AREA: {
    code: 'FULL_AREA',
    name: '전구역 동반 가능',
    description: '실내외 전 구역에서 반려동물 동반이 가능합니다.',
  },
  PARTIAL: {
    code: 'PARTIAL',
    name: '일부 구역 동반 가능',
    description: '지정된 일부 구역에서만 반려동물 동반이 가능합니다.',
  },
  OUTDOOR_ONLY: {
    code: 'OUTDOOR_ONLY',
    name: '실외만 동반 가능',
    description: '실외 공간에서만 반려동물 동반이 가능합니다.',
  },
} as const

const PET_SIZE = {
  ALL: { code: 'ALL', name: '전 견종 가능', description: '견종·크기 제한 없이 동반이 가능합니다.' },
  SMALL_ONLY: {
    code: 'SMALL_ONLY',
    name: '소형견만 가능',
    description: '소형견만 동반이 가능합니다.',
  },
  SMALL_MEDIUM: {
    code: 'SMALL_MEDIUM',
    name: '중소형견 가능',
    description: '소형견과 중형견까지 동반이 가능합니다.',
  },
} as const

const FULL_INTRO: PlaceIntro = {
  infoCenter: '064-760-6331',
  useTime: '09:00~17:50 (입장 마감 17:10)',
  restDate: '연중무휴',
  parking: '가능 (승용차 40대, 30분 무료 이후 30분당 500원)',
  chkPet: '반려동물 동반 가능 (전구역)',
  chkBabyCarriage: '대여 가능',
  chkCreditCard: '가능',
}

/** 일부 값만 있는 intro — 없는 줄이 숨겨져야 한다 */
const PARTIAL_INTRO: PlaceIntro = {
  infoCenter: null,
  useTime: '10:00~18:00',
  restDate: null,
  parking: '불가 (인근 공영주차장 이용)',
  chkPet: null,
  chkBabyCarriage: null,
  chkCreditCard: null,
}

const FULL_PET_INFO: PlacePetInfo = {
  acmpyTypeCd: '전구역 동반가능',
  acmpyPsblCpam: '전 견종 동반 가능',
  acmpyNeedMtr: '목줄 착용, 배변봉투 지참',
  etcAcmpyInfo:
    '반려견 동반 시 입장 전 안내데스크에서 확인을 받아 주세요.\n' +
    '전시실 내부에서는 반려견을 안거나 이동장에 넣어 주셔야 합니다.\n' +
    '야외 정원에서는 목줄을 착용한 상태로 자유롭게 산책할 수 있습니다.',
  relaAcdntRiskMtr: '경사로가 있어 소형견은 안고 이동하시는 것을 권장합니다.',
  relaFrnshPrdlst: '배변봉투, 급수대',
  relaPosesFclty: '반려견 운동장, 야외 휴게 공간',
  relaPurcPrdlst: '반려견 간식',
  relaRntlPrdlst: '이동장',
  allowanceScope: SCOPE.FULL_AREA,
  allowedPetSize: PET_SIZE.ALL,
  leashRequired: true,
}

/** 가공값만 있고 원문이 거의 없는 케이스 */
const SPARSE_PET_INFO: PlacePetInfo = {
  acmpyTypeCd: null,
  acmpyPsblCpam: '10kg 미만 소형견',
  acmpyNeedMtr: null,
  etcAcmpyInfo: null,
  relaAcdntRiskMtr: null,
  relaFrnshPrdlst: null,
  relaPosesFclty: null,
  relaPurcPrdlst: null,
  relaRntlPrdlst: null,
  allowanceScope: SCOPE.OUTDOOR_ONLY,
  allowedPetSize: PET_SIZE.SMALL_ONLY,
  leashRequired: false,
}

const MEDIUM_PET_INFO: PlacePetInfo = {
  acmpyTypeCd: '일부 구역 동반가능',
  acmpyPsblCpam: '중형견까지 동반 가능',
  acmpyNeedMtr: '목줄 착용 필수',
  etcAcmpyInfo: null,
  relaAcdntRiskMtr: null,
  relaFrnshPrdlst: null,
  relaPosesFclty: '야외 테라스',
  relaPurcPrdlst: null,
  relaRntlPrdlst: null,
  allowanceScope: SCOPE.PARTIAL,
  allowedPetSize: PET_SIZE.SMALL_MEDIUM,
  leashRequired: true,
}

/**
 * 이미지 URL 은 등록된 호스트(`remote-host.ts`)를 쓴다 — 미등록 호스트는 플레이스홀더로 떨어진다.
 *
 * **파일 자체는 존재하지 않으므로 dev 에서는 빈 박스로 보인다.** 그림을 보려고 둔 값이 아니라
 * `next/image` 경로가 던지지 않는지 확인하려고 둔 값이다. 실제 이미지는 백엔드 기동 후 확인한다.
 */
const IMAGES: PlaceImage[] = [
  {
    originImgUrl: 'http://tong.visitkorea.or.kr/cms/resource/mock/place-1.jpg',
    smallImageUrl: 'http://tong.visitkorea.or.kr/cms/resource/mock/place-1-thumb.jpg',
    imgName: '제주_전시관 외관 (1)',
    cpyrhtDivCd: 'Type1',
  },
  {
    originImgUrl: 'http://tong.visitkorea.or.kr/cms/resource/mock/place-2.jpg',
    smallImageUrl: null,
    imgName: null,
    cpyrhtDivCd: 'Type1',
  },
]

const HOMEPAGE_ANCHOR =
  '<a href="https://www.visitjeju.net/kr" target="_blank" title="새 창 열림">비짓제주 바로가기</a>'

const OVERVIEW =
  '제주 자연을 그대로 살린 공간이다.<br>반려견과 함께 산책할 수 있는 야외 동선이 마련돼 있고, ' +
  '실내 전시 공간은 이동장 이용 시에만 입장할 수 있다.<br />주말에는 방문객이 몰려 오전 시간대를 권장한다.'

type DetailVariant = {
  intro: PlaceIntro | null
  petInfo: PlacePetInfo | null
  images: PlaceImage[]
  overview: string | null
  homepage: string | null
  cpyrhtDivCd: string | null
}

/**
 * 4가지 조합을 순환시켜 **nullable 경로가 항상 화면에 등장**하게 한다.
 * 하나라도 빠지면 "내 로컬에서는 잘 보이던" 상태로 숨김 처리 버그가 지나간다.
 */
const VARIANTS: DetailVariant[] = [
  {
    intro: FULL_INTRO,
    petInfo: FULL_PET_INFO,
    images: IMAGES,
    overview: OVERVIEW,
    homepage: HOMEPAGE_ANCHOR,
    cpyrhtDivCd: 'Type1',
  },
  {
    // intro 가 통째로 없다
    intro: null,
    petInfo: MEDIUM_PET_INFO,
    images: [],
    overview: OVERVIEW,
    homepage: 'www.jejutour.go.kr',
    cpyrhtDivCd: 'Type3',
  },
  {
    // petInfo 가 통째로 없다
    intro: PARTIAL_INTRO,
    petInfo: null,
    images: IMAGES.slice(0, 1),
    overview: null,
    homepage: null,
    cpyrhtDivCd: null,
  },
  {
    // 결합 데이터가 전부 없다 — 기본 정보만 남는다
    intro: null,
    petInfo: SPARSE_PET_INFO,
    images: [],
    overview: null,
    homepage: null,
    cpyrhtDivCd: null,
  },
]

export function mockPlaceDetail(placeId: string): PlaceDetail | null {
  const index = MOCK_PLACES.findIndex((place) => place.placeId === placeId)
  if (index === -1) return null

  const summary = MOCK_PLACES[index]
  if (summary === undefined) return null

  const variant = VARIANTS[index % VARIANTS.length] ?? VARIANTS[0]
  if (variant === undefined) return null

  return {
    placeId: summary.placeId,
    // TODO(BE #17): 백엔드는 원천이 TourAPI 가 아니면 문자열 "null" 을 내려준다
    contentId: index % 3 === 0 ? String(126439 + index) : null,
    contentType: summary.contentType,
    title: summary.title,
    addr1: summary.addr1,
    addr2: summary.addr1 === null ? null : '(중문동)',
    zipcode: summary.addr1 === null ? null : '63546',
    lat: summary.lat,
    lng: summary.lng,
    firstImage: summary.firstImage,
    firstImage2: summary.firstImage2,
    cpyrhtDivCd: variant.cpyrhtDivCd,
    tel: summary.tel,
    homepage: variant.homepage,
    overview: variant.overview,
    petAvailable: summary.petAllowanceType.code !== 'NOT_ALLOWED',
    petAllowanceType: summary.petAllowanceType,
    intro: variant.intro,
    petInfo: variant.petInfo,
    images: variant.images,
  }
}
