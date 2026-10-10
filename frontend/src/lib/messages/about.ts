/**
 * 서비스 소개 화면 문구 — `/about` (#635).
 *
 * **이 화면은 #611 에서 출처 표기가 갈 곳으로 생겼고, #635 에서 소개 페이지가 됐다.** 절은
 * 기능 이름이 아니라 **보호자의 질문 순서**다 — 데려가도 돼요? → 지금 나가도 돼요? → 오늘
 * 어디 가요? → 위급하면? → 무엇을 보고 판단하나요. 정본은
 * `docs/superpowers/specs/2026-09-15-about-landing-design.md` §5.
 *
 * **보호 라우트가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다 — 심사자가 로그인
 * 없이 모바일로 둘러본다.
 *
 * **출처 · 면책 · 공모전 표기를 여기서 다시 적지 않는다.** `footerMessages` 를 그대로 읽는다.
 *
 * **개수를 적지 않는다.** `315곳` 같은 규모 숫자는 `features/about/about-specimen-data.ts`
 * 의 상수다 — `message-tone.test.ts` 가 잠근다.
 *
 * **예시 카드의 문장도 여기 있다.** 값(29 · 56.0 · 31)은 상수 파일에, 그 값을 감싸는 말은
 * 여기에 — 해요체 감시가 예시 문장까지 덮게 하기 위해서다.
 *
 * **약관 링크가 여기 있는 이유는 출처와 같다** (#610). 푸터가 감춰지는 768 미만에서
 * 마이페이지는 로그인이 필요하고 `(auth)` 그룹에는 푸터가 없어, 이 화면이 없으면 **가입 전
 * 모바일 방문자가 약관을 읽을 수단이 사라진다.** 소개 페이지가 돼도 이 몫은 그대로다.
 *
 * **없는 링크는 여기서도 만들지 않는다.** 문의는 아직 창구가 없어 넣지 않는다.
 *
 * **낱말 규칙 (#940, 사용자 검토).** `판정` 을 쓰지 않는다 — 심판받는 느낌이라 이름은 `오늘 상태`,
 * 문장 안에서는 `알려 줘요` · `안내해요` 로 푼다. 장소를 `거른다` · 조건이 `갈린다` 고 쓰지 않는다 —
 * `안내해요` · `다른` 으로 쓴다. `원천` 대신 `데이터` · `출처`, `서버가 ~` 대신 하는 일(`AI로 다시
 * 생성해요`)을 쓴다. `about-view.test.ts` 가 이 파일의 값 문자열 전체를 잠근다.
 */
export const aboutMessages = {
  title: '서비스 소개',
  description: '혼디가개가 무엇을 보고 판단하는지와 데이터 출처를 모았어요.',

  /**
   * 히어로 (#940). 서비스 이름표 같던 작은 표지어(`반려견과 함께하는 제주 여행`)를 제목으로
   * 올렸다 — 예전 제목(`동반 가능한 곳만 골라서, 지금 가도 되는지까지 봐요`)의 "~, ~해요" 구조가
   * 어색하다는 검토였다. 그 뜻은 제목 아래 한 줄(`lead`)이 쉼표 없이 말한다. 설명 문단(`sub`)은
   * 뺐다 — 한 줄을 되풀이했고 공공데이터 · 일정 · 가입 없이는 아래 절이 말한다.
   */
  hero: {
    heading: '반려견과 함께하는 제주 여행',
    /**
     * 두 토막 — 768 이상은 토막 사이에서 줄을 바꾸고("…시간까지 / 한 번에 확인해요"), 그 미만은
     * 한 문장으로 흐른다. 한 줄로 두면 태블릿 · 데스크톱에서 `한 번에` 앞뒤 아무 데서나 꺾였다.
     */
    lead: ['동반 가능한 장소부터 오늘 산책하기 좋은 시간까지', '한 번에 확인해요'] as const,
    ctaPrimary: '오늘 상태 보러 가기',
    ctaSecondary: '장소 찾기',
    /** 1024 이상 히어로 카피 아래 스크롤 힌트 (#915) — 질문 1 절로 가는 앵커 */
    scrollCue: '내려가며 질문 다섯 개에 답해요',
  },

  /**
   * 절 내비 (#915). 절 라벨은 각 절의 제목(`q1.heading` …)을 그대로 읽는다 — 같은 절을 두
   * 이름으로 부르지 않게. 표지어(`질문 1` · `그리고`)는 링크 이름으로 가는 곳을 말하지 못한다
   * (WCAG 2.4.4). 여기는 제목이 화면에 없는 히어로 몫과 목록 이름만 둔다.
   */
  nav: {
    label: '이 페이지의 절',
    top: '처음',
  },

  /** 히어로 판정 카드 예시 — 값은 `about-specimen-data.ts` */
  specimen: {
    verdictAria: '오늘 산책 상태 화면 예시',
    verdictLabel: '오늘 산책 · 제주시 기준',
    verdictTitle: '지금은 나가지 않는 편이 좋아요',
    verdictGrade: '위험',
    temperatureLabel: '기온',
    /** 한 줄에 선다 (#940) — 예전 `추정 노면(아스팔트)` 는 두 줄로 꺾였고, `아스팔트 추정온도` 도 1024 칸(안쪽 80)에서 86 이라 넘쳤다. 단위 ℃ 가 바로 옆이다 */
    pavementLabel: '아스팔트 추정',
    feelsLikeLabel: '체감온도',
    /** `{threshold}` 치환 */
    reasonPavement: '노면 온도가 {threshold}℃ 를 넘어 발바닥 화상 위험이 있어요',
    /** `{window}` 치환 */
    reasonWindow: '오늘 산책하기 좋은 시간은 {window} 이에요',
    verdictNote: '화면 예시예요. 실제 값은 기상청 실시간 관측으로 계산해요.',

    placesAria: '내 반려견 기준 필터 화면 예시',
    placesChip: '내 반려견 기준 · 소형 · 7kg',
    placesNote: '화면 예시예요. 장소 이름과 조건은 실제와 달라요.',
    unknownTag: '동반 정보 없음',
    /** 필터 칩 · 행 태그 둘 다 쓴다 — 같은 낱말이 화면에서 갈리지 않게 한 곳에서 읽는다 */
    filterIndoor: '실내',
    filterOpen: '운영 중',

    curveAria: '시간대별 기온과 추정 노면 온도 곡선 예시. 06시부터 08시 사이가 추천 구간이에요.',
    curveTitle: '오늘 산책하기 좋은 시간',
    /** `{window}` 치환 */
    curveSub: '제주시 기준 · {window} 을 추천해요',
    curveLegendTemperature: '기온',
    curveLegendPavement: '아스팔트 추정온도',
    /**
     * **색이 무엇을 뜻하는지까지 적는다** (#656). 예전에는 `추천 구간` 한 낱말이라, 초록
     * 견본을 보고 *"초록 면 = 추천 구간"* 으로 배우게 됐다. 실제 홈 곡선은 이제 추천 구간
     * 안을 **시각별 등급**으로 칠하므로, 그렇게 배운 사람은 창 안의 황갈색 칸을 추천에서
     * 빠진 시각으로 읽는다 — 소개 페이지가 실제로 없는 규칙을 가르치는 셈이다.
     *
     * 견본 자체는 **창 안이 전부 한 등급인 날**이라 한 색으로 둔다 (`GOLDEN_CURVE_SPECIMEN`).
     * 그것도 실제로 나오는 모양이고, 일러스트에 등급 분포까지 담으면 이 카드가 말하려는
     * "낮에 걷기 좋은 시간대가 있다" 가 묻힌다 (세부명세 §5-3).
     */
    curveLegendWindow: '추천 구간 · 색은 시각별 등급',
    curveNote: '화면 예시예요. 곡선은 기상청 시간별 예보로 매일 새로 계산해요.',
    /** 곡선 시각 핸들 (#916) */
    curveScrubLabel: '시각을 옮겨 보면 그때의 노면 온도를 읽어 줘요',
    /** `{time}` · `{temperature}` · `{pavement}` 치환 */
    curveReadout: '{time} · 기온 {temperature}℃ · 노면 {pavement}℃',
    /**
     * 산책 판정 등급어 — shared `WalkSafetyLevel` 의 서버 `name` 그대로다(키도 서버 code).
     * 예시 표에 붙이는 라벨이라 서버를 부르지 않을 뿐, 실화면과 다른 낱말을 쓰지 않는다.
     * 톤은 여기서 정하지 않는다 — `walkSafetyTone(code)` 이 실화면과 같은 톤을 준다.
     */
    walkGrades: { SAFE: '안전', CAUTION: '주의', DANGER: '위험' },

    /**
     * **서버 `name` 그대로다.** 예전에는 `적합도 높음` 이었는데 실제 적합도 `HIGH` 의
     * `name` 은 `여행 적합` 이라, 소개 페이지가 실제로 없는 화면을 보여 주고 있었다.
     * 축(`적합도`)은 이제 배지의 `axis` 가 붙인다 (#652 · 명세 D8-3).
     */
    suitabilityGrade: '여행 적합',
    /**
     * 적합도 예시 (#940) — 실제 응답(`PlaceSuitabilityResponse`)의 모양을 그대로 옮긴다: 근거는
     * `name` + 완성 문장 `description` 이고 영향이 큰 순서다. 날씨 요약은 `weather` 의 최고 체감 ·
     * 강수 확률, 혼잡도는 `congestion.level.name`, 반영 조건은 `*Applied` 셋이다. 값은
     * `SUITABILITY_SPECIMEN` 이다.
     */
    suitabilityMeta: '{date} · {pet} 기준',
    suitabilityFeelsLike: '최고 체감',
    suitabilityRain: '강수 확률',
    suitabilityCongestion: '혼잡도',
    /**
     * 근거 이름은 서버 `SuitabilityReasonCode` 의 `name` 그대로다(`WEATHER_OK` · `LOW_CONGESTION` ·
     * `PET_ALLOWED`). 문장은 서버가 데이터를 넣어 완성해 보내는 자리라 예시 값으로 채웠다.
     */
    suitabilityReasons: [
      {
        name: '날씨 적정',
        description: '최고 체감온도 27℃ 에 강수 확률 10% 라 반려견 활동에 무리가 없어요',
      },
      { name: '혼잡도 낮음', description: '관광객 집중도가 낮아 여유롭게 둘러볼 수 있어요' },
      {
        name: '반려견 동반 가능',
        description: '반려견 출입이 확인된 해변이에요. 소형견은 목줄을 하면 산책로까지 함께 가요',
      },
    ] as const,
    suitabilityAppliedLabel: '반영한 조건',
    suitabilityApplied: ['날씨', '반려견 조건', '혼잡도'] as const,
    suitabilityNote: '화면 예시예요. 실제 등급은 기상청 예보와 혼잡도 예측으로 매일 새로 계산해요.',

    congestionAria: '일주일 혼잡도 막대 예시. 목요일이 가장 한산해요.',
    /** 막대 툴팁 · 버튼 이름 (#916) — `{date}` · `{level}` 치환, 가장 한산한 날은 `congestionBarBest` */
    congestionBar: '{date} · {level}',
    congestionBarBest: '{date} · 가장 한산',
    /** `{date}` 치환 */
    congestionBest: '{date}이 가장 한산할 것으로 보여요',
    /** 한산한 날 예시 머리 · 요약 (#940) — 날짜는 `CONGESTION_SPECIMEN` */
    congestionRange: '{range} · 혼잡도 예측',
    congestionBestLabel: '가장 한산한 날',
    congestionWeekend: '주말은 붐빌 것으로 보여 평일 방문을 권해요',
    congestionNote: '화면 예시예요. 실제로는 앞으로 30일 예측에서 골라요.',

    planTablistLabel: '예시 일정의 일자',
    planRegenerate: '하루만 다시 짜기',
    planAiTag: 'AI 제안',
    /** 다시 짜기 시연의 진행 단계 (#916) — DESIGN.md §8 "무한 스피너 대신 진행 단계" */
    planRegenerateSteps: [
      '장소 후보를 고르고 있어요',
      '동선을 맞추고 있어요',
      '준비물을 붙이고 있어요',
    ] as const,
    planRegenerateNote: '화면 예시예요. 실제로는 AI로 다시 생성해요.',
    /** 다시 짜기가 끝났을 때 live 영역에 남기는 문장 (#916 검토) — `{day}` 치환(`N일차`) */
    planRegenerated: '{day}를 다시 짰어요',
    planRestored: '{day}를 처음 안으로 되돌렸어요',

    weatherAria: '3일 날씨 브리핑 예시. 2일차에 비가 와요.',
    /** 강수 확률 칸 — `{value}` 치환 */
    weatherRain: '강수 {value}%',
    /** `{day}` 치환 */
    indoorTitle: '{day} 비 예보 · 가까운 실내',
    indoorNote: '화면 예시예요. 실내 대안은 비 예보가 있는 날에만 붙어요.',

    emergencyAria: '긴급 시설 목록 예시',
    emergencyTitle: '가까운 동물병원·약국',
    emergencySub: '현재 위치 기준 · 거리순',
    emergencyNote: '화면 예시예요. 시설 이름과 거리는 실제와 달라요.',
    /** 일정 상세의 진입 행 그림 (#914) — 일자는 `EMERGENCY_ENTRY_SPECIMEN` */
    emergencyEntry: '가는 곳 주변 병원·약국',
    /**
     * 곡선 예시의 기상특보 띠 (#914). 질문 2 항목 4("기상특보가 발효되면 그것부터 알려요")가
     * 가리킬 그림이 곡선 카드에 없어 새로 둔다. 특보는 판정과 같은 축의 데이터라
     * `metric-mid` 색이다 (명세 2026-09-25 §3-2).
     */
    curveAlert: '폭염주의보 발효 중 · 이것부터 알려요',
  },

  q1: {
    kicker: '질문 1',
    heading: '데려가도 돼요?',
    lead: '장소마다 다른 동반 조건을 내 반려견 기준으로 확인해요.',
    points: [
      '크기와 체중을 등록하면 그 조건에 맞는 제주의 동반 가능 장소를 안내해요',
      "동반 정보가 없는 곳은 '불가'로 단정하지 않고 정보 없음으로 따로 보여 줘요",
      '실내인지, 지금 운영 중인지도 함께 봐요',
    ] as const,
    link: '장소 찾기',
  },

  q2: {
    kicker: '질문 2',
    heading: '지금 나가도 돼요?',
    lead: '기온이 괜찮아도 아스팔트는 뜨거워요. 발바닥이 닿는 온도를 기준으로 알려 드려요.',
    points: [
      '기상청 실시간 관측으로 아스팔트 온도를 추정해요',
      '체감온도와 함께 안전·주의·위험 세 단계로 알려 주고 이유를 설명해요',
      '하루 중 산책하기 좋은 시간을 골라 줘요',
      '기상특보가 발효되면 그것부터 알려요',
    ] as const,
    link: '오늘 상태 보기',
  },

  q3: {
    kicker: '질문 3',
    heading: '오늘 어디 가요?',
    lead: '점수만 주지 않아요. 왜 그런지 이유를 함께 보여 줘요.',
    /** 네 항목 목록의 이름 (#940) — 탭 목록은 화면에 제목이 없어 스크린리더가 이 이름으로 부른다 */
    tablistLabel: '기능 예시 네 가지',
    cards: {
      suitability: {
        title: '여행 적합도',
        desc: '날씨·동반 조건·혼잡도를 묶어 등급으로 답하고, 근거를 함께 보여 줘요.',
      },
      congestion: {
        title: '한산한 날',
        desc: '앞으로 30일 혼잡도 예측에서 가장 한산한 날을 골라요.',
      },
      aiPlan: {
        title: 'AI 일정',
        desc: '반려견 조건과 여행 기간을 넣으면 하루 단위 초안을 만들어요. 실제 있는 장소만 후보로 써서 없는 곳을 지어내지 않아요.',
      },
      indoor: {
        title: '비가 오면 실내로',
        desc: '일자별 날씨를 미리 브리핑하고, 비 오는 날은 가까운 실내 대안을 함께 보여 줘요.',
      },
    },
    link: 'AI 일정 만들기',
  },

  q4: {
    kicker: '질문 4',
    heading: '위급하면?',
    lead: '여행 중 가장 급한 질문도 바로 확인할 수 있게 준비했어요.',
    points: [
      '현재 위치 기준으로 동물병원·동물약국을 거리순으로 찾아요',
      '지금 진료 중인지 함께 보여 줘요',
      '여행 일정 안에서도 한 번에 들어가요',
    ] as const,
    link: '가까운 병원·약국',
  },

  data: {
    kicker: '데이터',
    heading: '무엇을 보고 판단하나요',
    lead: '화면의 모든 등급에 출처와 이유를 표시해요.',
    /** 규모 타일 라벨 — 숫자는 `SCALE_SPECIMEN` */
    scaleLabels: {
      places: '반려견 동반 가능 장소',
      emergency: '동물병원·동물약국',
      sources: '공공데이터 출처',
    },
    scaleUnits: { places: '곳', emergency: '곳', sources: '개' },
    scaleNote: '2026년 9월 적재 기준이에요.',
    /**
     * 규모 타일을 누르면 그 숫자가 어디서 왔는지 보여 준다 (#940). 개수는 `SCALE_SPECIMEN` 이고
     * 여기에는 말만 둔다. 출처 이름은 `messages.footer.sources` 를 그대로 읽는다 —
     * `sourceUses` 는 그 목록과 **같은 순서 · 같은 길이**다(테스트가 잠근다).
     */
    scaleGroupLabel: '데이터 규모 — 숫자를 누르면 어디서 모았는지 보여 줘요',
    scaleBreakdown: {
      places: '세 API 데이터를 합치고 중복을 제외했어요',
      emergency: '한국문화정보원 시설 데이터에서 동물병원·동물약국을 모았어요',
      sources: '화면마다 사용한 데이터가 달라요.',
    },
    /** 장소 막대의 조각 이름 — 순서는 `SCALE_SPECIMEN.placesBreakdown` */
    placesSegments: ['관광지', '문화시설', '음식점'] as const,
    sourceUses: [
      '관광 장소',
      '문화시설 · 긴급 시설',
      '반려동물 동반 음식점',
      '날씨 · 아스팔트 온도 · 특보',
      '지도 · 길 찾기',
    ] as const,
    /** 약속 넷의 제목 (#940) — 오른쪽 열 첫 카드 */
    rulesTitle: '이렇게 안내해요',
    rules: [
      '추천에는 항상 근거를 붙여요',
      '공공데이터는 미리 모아 두고, 화면은 그 데이터만 읽어요',
      'AI는 실제 있는 장소 목록 안에서만 골라요',
      '일정의 저장과 확정은 사용자가 해요. AI는 제안만 해요',
    ] as const,
  },

  notice: {
    title: '알아두실 점',
  },

  /** 약관 이동 행 — 라벨 목록은 `lib/legal/links.ts` `LEGAL_LINKS` 다 (#610) */
  legal: {
    title: '약관',
    description: '가입 전에도 읽을 수 있어요.',
  },

  cta: {
    heading: '가입 없이 오늘의 제주를 확인해 보세요',
    sub: '반려견을 등록하면 오늘 상태와 장소 안내가 내 반려견 기준으로 바뀌어요.',
    primary: '홈으로 가기',
    secondary: '반려견 등록하기',
  },
} as const
