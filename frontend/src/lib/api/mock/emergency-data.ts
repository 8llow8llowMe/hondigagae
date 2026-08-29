import type { NearbyFacilityItem, NearbyFacilityResult } from '@/types/emergency'

/**
 * 개발용 긴급 시설 데이터.
 *
 * **없는 API 를 상상해서 만드는 것이 아니다.** 계약 근거는 tour-service `emergency`
 * 컨텍스트의 `NearbyFacilityWebController` / `NearbyFacilityResponse` /
 * `NearbyFacilityItem` / `EmergencyFacilityType` 실측이다.
 * enum 문구는 백엔드 `displayName` / `description` 을 **그대로** 쓴다.
 *
 * 데이터를 만들 때 지킨 것 — 화면의 분기가 전부 한 번씩 등장하게 한다:
 *  - `openNow` 3상태(`true` / `false` / `null`)를 모두 둔다
 *  - `operatingHoursKnown: false` 인 곳을 둔다 — "닫힘" 과 구분되는지 화면에서 봐야 한다
 *  - `tel: null` 인 곳을 둔다 — 전화 버튼이 사라지지 않고 비활성으로 남는지
 *  - 약국을 병원들 **사이 거리**에 둔다 — 유형별로 섹션이 갈리지 않는지
 *  - 24시간은 1곳뿐이다 (제주 실제 사정이 3곳이라는 것과 같은 결의 희소함)
 */
const HOSPITAL = {
  code: 'ANIMAL_HOSPITAL',
  name: '동물병원',
  description: '진료가 필요한 상황에서 찾는 곳입니다.',
} as const

const PHARMACY = {
  code: 'ANIMAL_PHARMACY',
  name: '동물약국',
  description: '상비약이나 처방약이 필요할 때 찾는 곳입니다.',
} as const

/** Snowflake 는 JS 안전 정수를 넘는다 — **문자열이다** (이슈 #8) */
const FACILITIES: NearbyFacilityItem[] = [
  {
    facilityId: '4611686018427387904',
    facilityType: HOSPITAL,
    name: '제주24시동물병원',
    addr: '제주특별자치도 제주시 연북로 100',
    lat: 33.4863,
    lng: 126.4983,
    tel: '064-000-0000',
    operatingHours: '연중무휴 24시간',
    restDate: null,
    open24: true,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 480,
  },
  {
    facilityId: '4611686018427387905',
    facilityType: HOSPITAL,
    name: '한라동물병원',
    addr: '제주특별자치도 제주시 도남동 22',
    lat: 33.4901,
    lng: 126.5312,
    tel: '064-000-0001',
    operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
    restDate: '일요일',
    open24: false,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 1250,
  },
  {
    facilityId: '4611686018427387906',
    facilityType: HOSPITAL,
    name: '서귀포동물병원',
    addr: '제주특별자치도 서귀포시 중앙로 45',
    lat: 33.2541,
    lng: 126.5601,
    // 등록된 번호가 없다 — 버튼을 숨기지 않고 비활성으로 남긴다
    tel: null,
    operatingHours: null,
    restDate: null,
    open24: false,
    // 영업시간을 모르니 판정할 수 없다. **"닫힘" 이 아니다**
    openNow: null,
    operatingHoursKnown: false,
    distanceMeters: 3120,
  },
  {
    facilityId: '4611686018427387907',
    facilityType: PHARMACY,
    name: '가까운약국',
    addr: '제주특별자치도 제주시 아라일동 8',
    lat: 33.4571,
    lng: 126.5619,
    tel: '064-000-0002',
    operatingHours: '월~금 09:00~22:00, 토 10:00~22:00, 일 13:00~22:00',
    restDate: null,
    open24: false,
    openNow: false,
    operatingHoursKnown: true,
    distanceMeters: 4460,
  },
]

export function mockNearbyFacilities(radius: number): NearbyFacilityResult {
  // 반경 안의 것만 남긴다 — 반경을 넓히면 결과가 늘어나는 것이 화면에서 보여야 한다
  const facilities = FACILITIES.filter((facility) => facility.distanceMeters <= radius)

  return {
    facilities,
    totalCount: facilities.length,
    radius,
    // 화면이 서버 파라미터를 쓰지 않으므로 항상 false 다 (lib/api/emergency.ts)
    open24Only: false,
    providerName: '한국문화정보원 반려동물 동반 가능 문화시설 위치 데이터',
  }
}
