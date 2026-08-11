# Auth Service

## 책임

- 카카오 소셜 로그인, JWT 토큰 발급/재발급/로그아웃
- 회원 기본 정보 관리
- 반려견 프로필 관리 — AI 추천의 핵심 입력이므로 이 서비스가 단일 원천

## 컨텍스트

- `auth` — 카카오 OAuth, 토큰 발급/재발급, 로그아웃(블랙리스트)
- `member` — 회원 기본 정보, 탈퇴
- `pet` — 반려견 프로필 CRUD

## 반려견 프로필 모델 (기획)

AI 여행 플래너 입력에 필요한 필드를 기준으로 설계한다.

- 이름, 품종, 나이(또는 생년월), 체중/크기 구분
- 환경 민감도: 더위 민감 / 추위 민감 / 소음 민감
- 활동 성향: 활동량(저/중/고), 산책 선호, 사회성(다른 개/사람)
- 성향 분석 결과(ai-service 산출)는 pet이 소유하지 않고 조회 시 결합한다

## 주요 API (계획)

- `POST /api/v1/auth/login/kakao` — 카카오 인가코드 → JWT 발급
- `POST /api/v1/auth/token/reissue`
- `POST /api/v1/auth/logout`
- `GET /api/v1/members/me`
- `GET|POST /api/v1/members/me/pets`
- `GET|PUT|DELETE /api/v1/members/me/pets/{petId}`

## 구현 주의점

- `security-core`의 `auth/*` 패키지는 이 서비스만 사용한다 (토큰 발급 전용).
- 카카오 OAuth state, refresh token, 로그아웃 블랙리스트는 Redis에 저장한다.
- 카카오 API 호출은 서킷 인스턴스 `kakao`로 감싸고, 인가코드 만료 같은 사용자 4xx는 `ignore-exceptions`로 서킷에서 제외한다.
- pet은 member와 raw FK(`memberId`)로만 연결한다. JPA 연관관계 어노테이션 금지 (`coding-conventions.md` §9-1).
