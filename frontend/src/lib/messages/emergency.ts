import type { FacilityTypeCode } from '@/types/emergency'

/**
 * 긴급 시설(동물병원 · 동물약국) 화면 문구.
 *
 * 정본은 아트보드 `혼디가개 긴급 시설.dc.html` 01·03 절이다.
 * 어미는 해요체로 통일한다 (DESIGN.md §1).
 */
export const emergencyMessages = {
  pageTitle: '병원 · 약국',
  pageDescription: '반려견이 아플 때 갈 수 있는 제주 동물병원과 동물약국을 찾아보세요.',

  // ── 좁히기 ─────────────────────────────────────────────────────────────

  typeGroupLabel: '시설 유형',
  typeAll: '전체',
  /**
   * 시설 유형 칩 라벨 (#205).
   *
   * **이 자리만 서버 enum metadata 를 쓰지 않는다.** 원래는 응답 목록에서
   * `facilityType.name` 을 역추적했는데, 이 화면은 유형을 **서버로 보내지 않고
   * 클라이언트에서 좁힌다** (`lib/api/emergency.ts` — 칩마다 개수를 보여주려고). 그래서
   * **개수가 0 인 칩도 반드시 그려야 하고**, 그 칩은 목록에 표본이 없어 라벨을 만들 수
   * 없다 — `?? code` 로 떨어져 화면에 `ANIMAL_HOSPITAL` 이 나갔다. dev 실측이다.
   *
   * `frontend/CLAUDE.md` 의 "한국어 매핑 테이블 금지" 는 **서버가 준 값을 FE 가 다시
   * 번역하지 말라**는 뜻이다. 여기는 서버가 값을 주지 않는 자리 — 데이터가 없는 필터
   * 컨트롤의 고정 라벨이라 층이 다르다. **목록 행·선택 카드는 그대로 서버 `name` 을
   * 쓴다** (거기는 데이터가 있는 자리다).
   *
   * `FACILITY_TYPE_CODES` 가 늘면 `satisfies` 가 컴파일 단계에서 잡는다.
   */
  typeByCode: {
    ANIMAL_HOSPITAL: '병원',
    ANIMAL_PHARMACY: '약국',
  } satisfies Record<FacilityTypeCode, string>,
  narrowGroupLabel: '영업 조건',
  open24: '24시간',
  openNow: '지금 진료중',

  /**
   * `open24Only` 는 제주 동물병원 중 3곳뿐이라 결과가 매우 적다 —
   * 백엔드 스키마가 이 사실을 화면에 알리라고 명시한다.
   */
  open24Note: '24시간 운영으로 확인된 곳은 제주에 몇 곳뿐이에요.',

  /** `{radius}` 치환. 서버가 준 `radius` 를 그대로 쓴다 */
  sortNote: '가까운 순 · 반경 {radius}',
  basisCurrent: '현재 위치 기준',
  basisJeju: '제주 중심 기준',

  // ── 행 ─────────────────────────────────────────────────────────────────

  /** `openNow === true`. 채운 태그 */
  statusOpen: '진료중',
  /** `openNow === false`. 회색 */
  statusClosed: '영업 종료',
  /**
   * `openNow === null`. 점선.
   * **"닫힘" 으로 쓰지 않는다** — 영업시간 정보가 없어 판정할 수 없는 것이다.
   */
  statusUnknown: '영업 여부 확인 필요',
  /** `operatingHoursKnown === false` */
  hoursUnknown: '진료시간이 등록돼 있지 않아요',
  /** `restDate` 앞에 붙인다 */
  restPrefix: '휴무',

  /** `{name}` 치환 — icon-only 버튼의 접근성 이름 */
  callLabel: '{name} 전화하기',
  /** 지도 선택 카드의 전화 버튼 라벨 — 행의 아이콘 버튼과 달리 글자가 들어간다 */
  callShort: '전화',
  /** `tel === null`. **버튼을 숨기지 않고 이유와 다음 방법을 준다** */
  telMissing: '등록된 전화번호가 없어요 — 주소로 위치를 확인해 주세요.',

  // ── 상태 ───────────────────────────────────────────────────────────────

  /** 반경 안에 아무것도 없다 (조건을 켜지 않았는데도) */
  emptyTitle: '반경 안에 병원·약국이 없어요',
  /** `{radius}` 치환 */
  emptyDescription: '반경 {radius} 안에서 찾지 못했어요. 반경을 넓혀 보세요.',
  widenRadius: '반경 넓히기',

  /** 조건을 켜서 0건이 된 경우 — 아트보드 03 */
  narrowedTitle: '조건에 맞는 곳이 없어요',
  /** `{n}` 치환. 끄면 몇 개가 되는지 실제로 세어 말한다 */
  reliefOpenNow: '“지금 진료중” 끄면 {n}곳',
  reliefOpen24: '“24시간” 끄면 {n}곳',
  reliefType: '전체 보기 {n}곳',

  errorTitle: '주변 시설을 불러오지 못했어요',

  // ── 위치 ───────────────────────────────────────────────────────────────

  locating: '현재 위치를 확인하는 중',
  /**
   * **거리를 감추는 이유를 말한다.** 제주 중심에서 480m 인 것을 "480m" 로 쓰면
   * 사용자는 자기 위치에서 480m 로 읽는다.
   */
  positionDenied: '위치 권한이 없어 거리를 계산할 수 없어요. 제주 중심에서 찾은 곳들이에요.',
  positionTimeout: '위치를 확인하지 못했어요. 제주 중심에서 찾은 곳들이에요.',
  positionUnsupported: '이 브라우저에서는 현재 위치를 쓸 수 없어요. 제주 중심에서 찾은 곳들이에요.',
  retryPosition: '현재 위치로 다시 찾기',

  /** `{provider}` 치환 */
  source: '정보 출처: {provider}. 진료시간은 실제와 다를 수 있어 방문 전 전화로 확인해 주세요.',
} as const
