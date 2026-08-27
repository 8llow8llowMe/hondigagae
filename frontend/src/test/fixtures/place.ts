import type { PlaceSummary } from '@/types/place'

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
