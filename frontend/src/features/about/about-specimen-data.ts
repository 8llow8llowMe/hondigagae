/**
 * 소개 페이지 고정 예시 값 (#635). **계약이 아니라 그림이다** — `types/` · `mocks/` 에 두지
 * 않는다. 서버를 부르지 않으므로 여기 숫자는 실시간 값이 아니고, 화면마다 `화면 예시예요`
 * 캡션이 그것을 밝힌다.
 *
 * 문장은 `messages.about.specimen` 에 있다 — 해요체 감시가 그쪽을 본다. 여기는 숫자 · 좌표 ·
 * 예시 이름만.
 *
 * `VERDICT_SPECIMEN` 의 29 · 56.0 은 홈 `pavementLabel` 주석의 실제 제보 사례다(#269) —
 * 기온은 괜찮은데 지면이 뜨겁다는 이 서비스의 요점을 한 장면으로 보여 준다.
 */
export const VERDICT_SPECIMEN = {
  temperature: 29,
  pavement: 56.0,
  feelsLike: 31,
  pavementThreshold: 52,
  window: '06:00–08:00',
} as const

export const PLACE_ROWS_SPECIMEN = [
  { name: '사계 해안 산책로', tags: ['소형·중형 동반 가능', '실외'], open: true },
  { name: '애월 북카페', tags: ['10kg 이하', '실내'], open: true },
  { name: '저지 예술인마을', tags: ['실외'], unknown: true },
] as const satisfies readonly {
  name: string
  tags: readonly string[]
  open?: true
  unknown?: true
}[]

/** viewBox 0 0 360 150. 곡선은 손으로 그린 베지어다 — 계산식이 아니다 */
export const GOLDEN_CURVE_SPECIMEN = {
  temperaturePath:
    'M12 96 C 40 100, 60 104, 87 100 S 140 74, 192 60 S 260 70, 300 88 S 330 98, 348 100',
  pavementPath:
    'M12 106 C 40 110, 60 112, 87 96 S 150 32, 192 18 S 260 36, 300 76 S 330 96, 348 104',
  windowX: 72,
  windowWidth: 30,
  /** 봉우리 라벨은 판정 카드의 노면 값에서 파생한다 — 두 곳이 갈리면 같은 장면이 아니게 된다 */
  peak: { x: 192, y: 18, label: `${VERDICT_SPECIMEN.pavement.toFixed(1)}℃` },
  hours: [
    { x: 12, label: '00' },
    { x: 72, label: '06' },
    { x: 132, label: '10' },
    { x: 192, label: '14' },
    { x: 252, label: '18' },
    { x: 312, label: '22' },
  ],
} as const

export const CONGESTION_SPECIMEN = {
  heights: [70, 52, 46, 28, 58, 92, 100],
  labels: ['월', '화', '수', '목', '금', '토', '일'],
  bestIndex: 3,
  bestDate: '9월 18일(목)',
} as const

export const PLAN_SPECIMEN = [
  {
    day: '1일차',
    items: [
      { time: '09:00', title: '사계 해안 산책로', meta: '실외 · 소형·중형 동반 가능' },
      { time: '12:30', title: '반려견 동반 식당', meta: '실내 · 10kg 이하' },
      { time: '15:00', title: '애월 북카페', meta: '실내 · 비 오는 날 대안' },
    ],
  },
  {
    day: '2일차',
    items: [
      { time: '10:00', title: '실내 놀이터', meta: '실내 · 비 예보' },
      { time: '13:00', title: '반려견 동반 카페', meta: '실내 · 전 크기' },
      { time: '16:00', title: '동물병원 근처 산책로', meta: '실외 · 짧게' },
    ],
  },
  {
    day: '3일차',
    items: [
      { time: '08:30', title: '함덕 해변 산책', meta: '실외 · 이른 시간' },
      { time: '11:30', title: '동반 가능 식당', meta: '실내 · 10kg 이하' },
      { time: '14:00', title: '공항 근처 카페', meta: '실내 · 출발 전' },
    ],
  },
] as const

/**
 * 여행 적합도 카드의 예시 장소. **뷰에 리터럴로 남기지 않는다** — 예시 장소 이름은 전부
 * 이 파일이 갖는다. `PLACE_ROWS_SPECIMEN` · `EMERGENCY_ROWS_SPECIMEN` 과 같은 축이다.
 *
 * 등급어(`적합도 높음`)와 근거 문장은 `messages.about.specimen` 이다 — 해요체 감시가 그쪽을 본다.
 */
export const SUITABILITY_SPECIMEN = { place: '협재 해수욕장' } as const

export const WEATHER_SPECIMEN = [
  { day: '1일차', icon: '☀️', temp: '27℃' },
  { day: '2일차', icon: '🌧️', temp: '23℃' },
  { day: '3일차', icon: '⛅', temp: '26℃' },
] as const

export const INDOOR_SPECIMEN = ['애월 북카페 · 1.2km', '실내 놀이터 · 3.4km'] as const

export const EMERGENCY_ROWS_SPECIMEN = [
  { name: '제주 24시 동물의료센터', status: '진료중', kind: '동물병원', distance: '1.8km' },
  { name: '노형 동물약국', status: '영업중', kind: '동물약국', distance: '2.4km' },
] as const

/**
 * 규모 — `README.md` 의 설계 규모다. **실측치와 갈리면 README 도 함께 고친다** (명세 §5-6).
 * 공개 API 가 총 개수를 주지 않아(커서 슬라이스) 화면이 실시간으로 셀 수 없다 — 기준 시점
 * 캡션(`messages.about.data.scaleNote`)이 그것을 밝힌다.
 */
export const SCALE_SPECIMEN = { places: 315, emergency: 214, sources: 5 } as const
