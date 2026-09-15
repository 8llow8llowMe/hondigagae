/**
 * 백엔드 경로를 한 곳에 모은다. 전송 계층(client.ts / server.ts)이 갈려도
 * 경로·타입은 공유한다 — docs/architecture-guide.md §8.
 *
 * 여기 적힌 경로는 게이트웨이의 /api/v1 하위 경로다.
 * (브라우저는 /api/bff 프록시를 거치고, 서버는 게이트웨이를 직접 부른다)
 */
export const paths = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    reissue: '/auth/token/reissue',
    oauthAuthorize: (provider: string) => `/auth/${provider}/authorize`,
    oauthLogin: (provider: string, code: string, state: string) =>
      `/auth/${provider}/login?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    emailSendCode: '/auth/email/send-code',
    emailVerifyCode: '/auth/email/verify-code',
    /** 비밀번호 찾기 — 가입 여부와 무관하게 항상 성공한다 (계정 열거 방지) */
    passwordResetSendCode: '/auth/password/reset/send-code',
    passwordReset: '/auth/password/reset',
  },
  members: {
    signup: '/members/signup',
    me: '/members/me',
    pets: '/members/me/pets',
    pet: (petId: string) => `/members/me/pets/${petId}`,
    /** 반려견 사진 — 업로드(POST, multipart)와 삭제(DELETE)가 같은 경로다 */
    petProfileImage: (petId: string) => `/members/me/pets/${petId}/profile-image`,
    /** 대표 반려견 지정. **해제 API 는 없다** — 다른 아이를 지정하면 옮겨간다 */
    petRepresentative: (petId: string) => `/members/me/pets/${petId}/representative`,
    profileImage: '/members/me/profile-image',
    /** 변경 — 현재 비밀번호 확인. DELETE 는 같은 경로로 소셜 전용 전환이다 */
    password: '/members/me/password',
    /** 최초 설정 — 소셜 전용 계정에 이메일 로그인 수단을 추가한다 */
    passwordSetup: '/members/me/password/setup',
    withdraw: '/members/me/withdraw',
  },
  places: {
    list: (query: string) => (query ? `/places?${query}` : '/places'),
    detail: (placeId: string) => `/places/${placeId}`,
    /**
     * 주변 장소 — 지도 뷰의 "지도 이동 시 재검색" 이 쓴다.
     * **커서가 아니라 `totalCount`** 를 주므로 목록과 페이징 모델이 다르다
     * (docs/screen-inventory.md §5-1). `lat`/`lng` 가 필수라 쿼리 없이 부르지 않는다
     */
    nearby: (query: string) => `/places/nearby?${query}`,
    /** 장소 인사이트 — tour-service insight 컨텍스트 */
    suitability: (placeId: string, query: string) =>
      query ? `/places/${placeId}/suitability?${query}` : `/places/${placeId}/suitability`,
    walkSafety: (placeId: string, query: string) =>
      query ? `/places/${placeId}/walk-safety?${query}` : `/places/${placeId}/walk-safety`,
    /**
     * 기간 혼잡도 (#430). **반려견 조건을 받지 않는다** — 붐빔은 장소와 날짜의 속성이라
     * 반려견이 바뀌어도 같은 값이다 (dev Swagger 실측 2026-09-14).
     */
    congestions: (placeId: string, query: string) =>
      query ? `/places/${placeId}/congestions?${query}` : `/places/${placeId}/congestions`,
  },
  insights: {
    /**
     * 오늘의 산책 골든타임 (#158). `lat`/`lng` 가 필수라 쿼리 없이 부르지 않는다.
     *
     * **`/places/{id}/walk-safety` 와 다른 컨트롤러다** — 저쪽은 장소 하나의 "지금",
     * 이쪽은 좌표 기준 "오늘 언제" 다.
     */
    walkTimes: (query: string) => `/insights/walk-times?${query}`,
    /**
     * 제주 권역 날씨 비교 (#158). **좌표가 필요 없다** — 서버가 권역 대표 좌표를 갖고 있다.
     * `date` 는 생략하면 오늘이다.
     */
    regionalWeather: (query: string) =>
      query ? `/insights/regional-weather?${query}` : '/insights/regional-weather',
  },
  emergencies: {
    /** 주변 긴급 시설. `lat`/`lng` 가 필수라 쿼리 없이 부르지 않는다 */
    facilities: (query: string) => `/emergencies/facilities?${query}`,
  },
  favorites: {
    /** 저장한 장소 목록. 커서가 없다 — 회원당 100곳 상한이라 전량이 온다 */
    places: '/favorites/places',
    /** 저장(POST) · 해제(DELETE) 가 같은 경로다. **둘 다 멱등이다** */
    place: (placeId: string) => `/favorites/places/${placeId}`,
  },
  plans: {
    list: '/plans',
    create: '/plans',
    detail: (planId: string) => `/plans/${planId}`,
    dayItems: (planId: string, day: number) => `/plans/${planId}/days/${day}/items`,
    weather: (planId: string) => `/plans/${planId}/weather`,
    /** 일정 응급 브리핑 (#125). 반경·개수는 서버 고정이라 쿼리가 없다 */
    emergency: (planId: string) => `/plans/${planId}/emergency`,
    /** 항목 방문 체크 (#124). 해제도 같은 경로다 — 본문의 `visited` 가 방향을 정한다 */
    itemVisited: (planId: string, planItemId: string) =>
      `/plans/${planId}/items/${planItemId}/visited`,
    /**
     * 저장된 여행 준비물 (#398 BE · #586 FE). **한 경로에 세 메서드가 붙는다** —
     * 조회(`GET`) · AI 결과 저장(`PUT`, AI 항목만 교체) · 직접 추가(`POST`).
     *
     * **`aiPlans.packingList` 와 다른 서비스다.** 저쪽(ai-service)은 만들기만 하고
     * 보관하지 않는다. 보관은 여기(plan-service)다.
     */
    packingItems: (planId: string) => `/plans/${planId}/packing-items`,
    /** 항목 삭제. AI 항목과 직접 추가 항목을 구분하지 않는다 — 둘 다 지울 수 있다 */
    packingItem: (planId: string, packingItemId: string) =>
      `/plans/${planId}/packing-items/${packingItemId}`,
    /** 챙김 체크. 해제도 같은 경로다 — 본문의 `checked` 가 방향을 정한다 */
    packingItemChecked: (planId: string, packingItemId: string) =>
      `/plans/${planId}/packing-items/${packingItemId}/checked`,
    /**
     * 여행 후기 v1 (#614 BE · #615 FE). **한 경로에 세 메서드가 붙는다** —
     * 조회(`GET`) · 작성(`POST`) · 수정(`PUT`). 일정당 하나라 경로에 reviewId 가 없다.
     *
     * **완료(`COMPLETED`)된 일정만** 호출한다. 초안·확정은 `PLAN_016` 이다.
     */
    reviews: (planId: string) => `/plans/${planId}/reviews`,
  },
  aiPlans: {
    submit: '/ai-plans',
    job: (jobId: string) => `/ai-plans/jobs/${jobId}`,
    /**
     * 작업 상태 SSE 구독 (#91).
     *
     * **`clientFetch` 로 부르지 않는다** — `EventSource` 가 직접 연다. 브라우저가
     * 게이트웨이를 직접 부르지 않고 BFF 가 토큰을 붙이므로, 스키마가 안내하는
     * fetch 기반 SSE 클라이언트(`Authorization` 헤더용)가 이 저장소에는 필요 없다.
     */
    jobStream: (jobId: string) => `/ai-plans/jobs/${jobId}/stream`,
    /**
     * 작업 취소 (#250). **`POST` 인데 본문이 없다** — 대상은 경로의 `jobId` 뿐이다.
     *
     * 응답은 취소된 작업(`AiPlanJobStatusResponse`)이라 조회와 같은 모양이다.
     */
    jobCancel: (jobId: string) => `/ai-plans/jobs/${jobId}/cancel`,
    /**
     * 반려견 여행 준비물 **생성** (#155). 서버가 결과를 보관하지 않으므로 재호출하면
     * 다른 목록이 온다.
     *
     * **보관은 plan-service 가 한다** (#586). 화면은 이 경로를 매번 부르지 않고
     * `plans.packingItems` 를 먼저 읽어, 저장된 것이 없을 때만 여기에 온다 —
     * 있으면 LLM 을 다시 돌리지 않는다.
     */
    packingList: (planId: string) => `/ai-plans/packing-list/${planId}`,
  },
} as const
