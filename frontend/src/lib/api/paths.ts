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
  },
  aiPlans: {
    submit: '/ai-plans',
    job: (jobId: string) => `/ai-plans/jobs/${jobId}`,
  },
} as const
