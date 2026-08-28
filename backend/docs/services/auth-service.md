# Auth Service

## 책임

- 일반 로그인(이메일+비밀번호)과 소셜 로그인(카카오/네이버), JWT 발급/재발급/로그아웃(현재 기기), 다중 기기 세션
- 이메일 인증코드 발송·검증(IP 상한), 회원가입, 내 정보 관리, 프로필 이미지, 비밀번호 변경·재설정·설정/제거, 탈퇴
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
- `POST /api/v1/auth/password/reset/send-code`, `POST /api/v1/auth/password/reset` — 비밀번호 재설정
- `POST /api/v1/auth/token/reissue`, `POST /api/v1/auth/logout` (현재 기기만)

### member

- `POST /api/v1/members/signup`
- `GET /api/v1/members/me`, `PATCH /api/v1/members/me` (닉네임)
- `POST|DELETE /api/v1/members/me/profile-image`
- `POST /api/v1/members/me/password` (변경), `POST /api/v1/members/me/password/setup` (최초 설정),
  `DELETE /api/v1/members/me/password` (소셜 전용 전환)
- `POST /api/v1/members/me/withdraw`

### pet

- `GET|POST /api/v1/members/me/pets`
- `GET|PUT|DELETE /api/v1/members/me/pets/{petId}`
- `POST|DELETE /api/v1/members/me/pets/{petId}/profile-image` — MinIO 오브젝트 키(`pets/profiles/...`)를
  저장하고 응답 시점에 공개 URL 로 조립한다. 업로드/교체/회수 순서는 회원 프로필 이미지와 동일하다.
- `PUT /api/v1/members/me/pets/{petId}/representative` — 대표 반려견 지정. 회원당 하나만 유지되며,
  첫 등록 반려견이 자동 대표가 되고 대표견 삭제 시 가장 먼저 등록한 남은 반려견이 승계한다.
- 프로필에 체중(`weightKg`, 0.1~99.9kg)을 받는다 — 장소의 입장 체중 제한 판정과 AI 프롬프트에 쓰인다. 미입력 허용.

## 구현 주의점

- `security-core`의 `auth/*` 패키지는 이 서비스만 사용한다 (토큰 발급 전용).
- OAuth state, refresh token, 로그아웃 블랙리스트, 이메일 인증코드, 로그인 실패 카운터는 Redis에 저장한다.
- provider 호출은 서킷 인스턴스(`kakao`, `naver`)로 감싸고, 인가코드 만료 같은 사용자 4xx는
  `OAuthApiCallSupport`가 `AuthException`으로 변환한 뒤 `ignore-exceptions`로 서킷에서 제외한다.
- 프로필 이미지 업로드(회원·반려견 공통)는 트랜잭션 밖에서 수행한다 — 업로드 → DB 반영 → 이전 파일 삭제(실패 시 방금 올린 파일 회수) 순서다.
- 로그인 실패 응답은 계정 존재 여부를 노출하지 않는다 (미존재/비밀번호 불일치를 `AUTH_006` 하나로 통합).
- pet은 member와 raw FK(`memberId`)로만 연결한다. JPA 연관관계 어노테이션 금지 (`coding-conventions.md` §9-1).
- 로컬 실행에는 MySQL·Redis에 더해 **MinIO**가 필요하다 (`docker-compose-local.yml`).
- 고아 프로필 이미지(업로드 후 DB 반영 전에 프로세스가 죽어 남은 파일)는 새벽 스케줄러가
  회수한다 — 2일보다 오래됐고 DB 어디에서도 참조되지 않는 객체만 지운다. 삭제가 멱등이라
  다중 인스턴스 동시 실행도 안전하다 (`storage-cleanup.member-cron`/`pet-cron`).

## 서비스 간 내부 API

`GET /internal/v1/pets/{petId}/condition` — 다른 서비스가 판정에 쓰는 반려견 특성을 준다.
`GET /internal/v1/pets/representative/condition?memberId=` — 대표 반려견의 특성. 호출부가 petId 없이 요청했을 때의 기본값이다.

- **반려견 프로필의 원천은 이 서비스다.** 다른 서비스가 사본을 두는 대신 필요한 특성만
  가져가게 한다. 사본을 두면 사용자가 프로필을 고쳐도 옛 값으로 판정하는 일이 생긴다.
- 경로가 `/internal/v1` 인 것이 보호 장치다. 게이트웨이는 `/api/v1/**` 만 외부로 라우팅하므로
  이 경로는 클러스터 밖에서 닿지 않는다. Swagger 에서도 `@Hidden` 으로 감춘다.
- 그럼에도 `memberId` 를 받아 **소유권을 다시 확인한다.** 경로 격리는 네트워크 수준의 방어이고,
  호출한 서비스의 버그까지 막아 주지는 않는다. 검사는 웹 경로와 **같은 Processor** 를 쓴다.
- 응답에 **이름과 생년월을 넣지 않는다.** 날씨 적합도와 산책 위험도 판정에 필요 없고,
  서비스 경계를 넘는 개인정보는 최소로 유지한다. 견종은 단두종 판정에 실제로 쓰여 예외로 넘긴다.
- 웹 응답(`PetResponse`)과 다른 DTO 를 쓰는 이유가 이것이다 — 내보내는 범위가 다르다.

## 다중 기기 로그인 세션

- refresh 토큰은 회원당 단일 슬롯이 아니라 **기기(로그인)별 세션 키**로 저장한다. 세션 아이디는
  refresh 토큰의 jti 다. Redis 키 2종 —
  `{prefix}:auth:refreshToken:{memberId}:{sessionId}` (세션별 토큰, TTL=refresh 만료),
  `{prefix}:auth:refreshSessions:{memberId}` (세션 ZSET, score=마지막 갱신 시각).
- 기기 상한은 `auth.session.max-devices`(기본 5). 초과 시 **가장 오래 갱신되지 않은 세션**부터
  밀어내며, 밀려난 기기는 access 만료 시점에 재로그인이 필요하다(`AUTH_001`).
- 회전(reissue)은 새 sessionId 키로 교체하고 이전 키를 즉시 삭제한다 — 같은 jti 로 재발급하면
  iat 가 초 단위라 같은 초 안에서 동일 토큰이 재생성되어 회전이 무력화되기 때문이고,
  이전 토큰의 재사용(탈취 재생)도 이 삭제로 차단된다.
- 무효화 범위: 로그아웃 = 현재 세션만(`revokeCurrentSession`, 관용 처리),
  탈퇴/비밀번호 변경·재설정·제거/상태 이상 = 전 기기 세션(`revokeAllSessions`, 실패 전파·롤백).
- refresh 쿠키 `path=/api/v1/auth` — reissue 와 logout 이 함께 쿠키를 읽는다 (로그아웃이 현재
  기기 세션을 특정하려면 쿠키의 refresh 가 필요). auth 경로 밖으로는 여전히 전송되지 않는다.

## 이메일 발송 남용 방어

- `POST /email/send-code` 와 재설정 send-code 는 **IP 발송 상한**(`AUTH_016`, 429 — 기본 10회/1시간,
  `auth.email-send.ip-max-send-count`/`ip-window`) → 이메일 60초 쿨다운(`AUTH_003`, 429) 순으로
  가입 여부 판별보다 먼저 적용된다. IP 상한은 이메일 키 쿨다운으로 못 막는 "한 IP 가 여러
  이메일로 뿌리는" 남용 방어다. 두 발송 API 는 카운터를 **공유**한다 — "이 IP 가 메일을 몇 번
  보냈나"는 API 구분 없이 센다.
- 클라이언트 IP 는 `ClientIpResolver`(X-Forwarded-For → X-Real-IP → remoteAddr)로 얻고
  Redis 고정 윈도우 카운터(장애 시 fail-open — 상한은 남용 방어지 정합성 장치가 아니다)로 센다.

## 비밀번호 재설정 (일반 계정 전용)

- `POST /password/reset/send-code` — **응답은 항상 200** 이고 분기는 메일 내용으로만 전달한다:
  일반 계정=재설정 코드 / 미가입=미가입 안내 / 소셜 전용(password null)=소셜 로그인 이용 안내.
  응답으로 구분하면 계정 열거 벡터가 되기 때문이다.
- `POST /password/reset` — `{email, code, newPassword}`. 성공 시 비밀번호 교체 + **전 기기 세션
  무효화**(탈취범이 유지 중인 세션 차단). 코드 불일치 `AUTH_004`, 만료/미발급 `AUTH_005`,
  **5회 오입력 시 코드 무효화 + `AUTH_017`**(브루트포스 방어).
- 저장소는 회원가입 인증과 **키 분리**(`PasswordResetStorePort` / `RedisPasswordResetStoreAdapter`) —
  공유하면 재설정 코드로 회원가입이 통과하거나 그 반대가 된다. 코드 TTL 5분 / 쿨다운 60초는
  회원가입 인증과 동일하고, 코드 생성기는 공용(`VerificationCodeGenerator`).
- 새 비밀번호 검증 코드 대역: `AUTH_106~108` (member 비밀번호 정책과 동일 규칙).

## 계정 연결/전환 (일반 ↔ 소셜) — 프론트 연동은 `docs/auth-account-frontend-guide.md`

- **일반 → +소셜 (자동 연결)**: 일반 계정이 있는 이메일로 소셜 로그인하면 그 계정에 provider 가
  연결되고, 이후 두 로그인 수단 모두 사용 가능하다. 양쪽 다 메일함 소유가 증명된 상태(소셜=
  provider 이메일 검증, 일반=가입 시 이메일 인증)라 자동 연결이 안전하다. 연결 순간 **통보 메일**을
  발송해 본인이 아닌 연결을 즉시 감지할 수 있게 한다.
- **소셜 → +이메일 (비밀번호 최초 설정)**: `POST /members/me/password/setup` — password 가 null 인
  계정만 허용(`MEMBER_008` 로 중복 설정 거부). 로그인 수단 "추가"라 세션은 무효화하지 않는다.
- **소셜 전용 전환(비밀번호 제거)**: `DELETE /members/me/password` — 연결된 계정만 허용.
  일반 전용 계정은 `MEMBER_009` 거부(마지막 로그인 수단 제거 방지), 이미 소셜 전용이면 `MEMBER_007`.
  성공 시 password=null + **전 기기 세션 무효화** + 전환 통보 메일. "비밀번호 최초 설정"으로 복구 가능.
- `/members/me` 응답에 `hasPassword` 노출 — FE 가 (일반/소셜 전용/연결됨) 상태를 구분해
  비밀번호 메뉴(변경·설정·전환)를 분기하는 기준이다. 해시는 절대 나가지 않는다.

## 계정 정책 (의도적으로 제공하지 않는 것)

- **이메일 변경 기능은 제공하지 않는다.** 이메일은 로그인 식별자이자 DB unique 키(`uk_member_email`)로
  사실상 계정의 PK 역할이다. 소셜 자동 연결(`AUTH_008`)·재가입 차단·이메일 인증 이력이 모두 이메일에
  묶여 있어, 변경을 허용하면 이 보증들이 전부 흔들린다. 이메일을 바꾸려면 새 계정 가입이 정책이다.
- **탈퇴 시 타 서비스 데이터는 보존한다.** 개인정보(이름/닉네임/프로필/비밀번호)는 auth 에서만
  보관하며 탈퇴 시 마스킹·제거된다. 여행 일정(plan-service)에는 memberId 만 남고 개인 식별 정보가
  없어 그대로 둔다. 일정은 인증 필수라 탈퇴 후 접근 자체가 불가하다.
