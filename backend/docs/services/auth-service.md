# Auth Service

## 책임

- 일반 로그인(이메일+비밀번호)과 소셜 로그인(카카오/네이버), JWT 발급/재발급/로그아웃
- 이메일 인증코드 발송·검증, 회원가입, 내 정보 관리, 프로필 이미지, 비밀번호 변경, 탈퇴
- 반려견 프로필 관리 — AI 추천의 핵심 입력이므로 이 서비스가 단일 원천

`auth`/`member` 컨텍스트는 **BossPickSeoul auth-service와 동일한 구조**다. 여러 소셜 제공자를 붙일 것이므로
원본의 회원 모델(email 식별 + provider 연결)을 그대로 쓴다. `pet`은 혼디가개 고유 컨텍스트다.

## 컨텍스트

- `auth` — 일반 로그인, 이메일 인증, OAuth(state 검증·인가·프로필 조회), 토큰 발급/재발급/로그아웃, 로그인 실패 잠금
- `member` — 회원가입, 내 정보 조회/수정, 프로필 이미지, 비밀번호 변경, 탈퇴
- `pet` — 반려견 프로필 CRUD

## 회원 모델 (원본과 동일)

`member` 테이블은 **email이 식별자**(`uk_member_email`)다. `provider`는 연결된 소셜 제공자이며 **null이면 일반 계정**이다.

| 컬럼 | 설명 |
|------|------|
| `email` | 회원 식별자 (unique, NOT NULL) |
| `password` | 일반 계정 비밀번호 해시. 소셜 전용 계정은 null |
| `name`, `nickname` | 이름 / 닉네임 (탈퇴 시 마스킹) |
| `profileImageUrl` | 소셜 제공자가 준 외부 CDN URL |
| `profileImageKey` | 직접 업로드한 오브젝트 키. **표시 우선순위는 key > url** |
| `role` | `SecurityRole` |
| `provider` | `OAuthProvider`(KAKAO/NAVER). null이면 일반 계정 |
| `status` | `MemberStatus`(ACTIVE/WITHDRAWN/SUSPENDED) |

**동일 이메일 자동 연결**: 일반 계정으로 가입한 이메일로 소셜 로그인하면 `Member.withProvider()`로 계정을 연결한다.
이미 다른 provider로 연결된 계정이면 `AUTH_008`로 거절해 어느 소셜로 들어와야 하는지 알려준다.

**소셜 제공자 추가 방법**: `OAuthProvider`에 상수를 추가하고, `adapter/out/oauth/{provider}` 아래에
`*ApiClient` / `*AuthorizationUrlProvider` / `*MemberQueryAdapter`를 원본 패턴대로 추가한 뒤
`OAuthClientConfig`와 라우터(`OAuthAuthorizationUrlRouter`, `OAuthMemberQueryRouter`)에 등록한다.
컨트롤러는 `{provider}` PathVariable이라 그대로 동작한다.

## 반려견 프로필 모델 (혼디가개 고유)

- 이름, 품종, 생년월(yyyy-MM), 크기 구분(`PetSizeType`)
- 환경 민감도: 더위 / 추위 / 소음
- 활동 성향: 활동량(`ActivityLevel`), 산책 선호, 사회성(`SocialityLevel`)
- 회원당 최대 5마리, 소프트 삭제(기존 일정이 참조)
- 성향 분석 결과(ai-service 산출)는 pet이 소유하지 않고 조회 시 결합한다

## API

### auth

- `POST /api/v1/auth/login` — 일반 로그인
- `GET /api/v1/auth/{provider}/authorize` — 소셜 인가 URL 생성 (state 10분 유효)
- `GET /api/v1/auth/{provider}/login?code=&state=` — 소셜 로그인
- `POST /api/v1/auth/email/send-code`, `POST /api/v1/auth/email/verify-code`
- `POST /api/v1/auth/token/reissue`, `POST /api/v1/auth/logout`

### member

- `POST /api/v1/members/signup`
- `GET /api/v1/members/me`, `PATCH /api/v1/members/me` (닉네임)
- `POST|DELETE /api/v1/members/me/profile-image`
- `POST /api/v1/members/me/password`, `POST /api/v1/members/me/withdraw`

### pet

- `GET|POST /api/v1/members/me/pets`
- `GET|PUT|DELETE /api/v1/members/me/pets/{petId}`

## 구현 주의점

- `security-core`의 `auth/*` 패키지는 이 서비스만 사용한다 (토큰 발급 전용).
- OAuth state, refresh token, 로그아웃 블랙리스트, 이메일 인증코드, 로그인 실패 카운터는 Redis에 저장한다.
- provider 호출은 서킷 인스턴스(`kakao`, `naver`)로 감싸고, 인가코드 만료 같은 사용자 4xx는
  `OAuthApiCallSupport`가 `AuthException`으로 변환한 뒤 `ignore-exceptions`로 서킷에서 제외한다.
- 프로필 이미지 업로드는 트랜잭션 밖에서 수행한다 — 업로드 → DB 반영 → 이전 파일 삭제(실패 시 방금 올린 파일 회수) 순서다.
- 로그인 실패 응답은 계정 존재 여부를 노출하지 않는다 (미존재/비밀번호 불일치를 `AUTH_006` 하나로 통합).
- pet은 member와 raw FK(`memberId`)로만 연결한다. JPA 연관관계 어노테이션 금지 (`coding-conventions.md` §9-1).
- 로컬 실행에는 MySQL·Redis에 더해 **MinIO**가 필요하다 (`docker-compose-local.yml`).
