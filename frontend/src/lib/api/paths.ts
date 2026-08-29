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
  },
  members: {
    signup: '/members/signup',
    me: '/members/me',
    pets: '/members/me/pets',
    pet: (petId: string) => `/members/me/pets/${petId}`,
  },
  places: {
    list: (query: string) => (query ? `/places?${query}` : '/places'),
    detail: (placeId: string) => `/places/${placeId}`,
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
