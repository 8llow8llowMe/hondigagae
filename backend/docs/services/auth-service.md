# Auth Service

## 책임

- 일반 로그인(이메일+비밀번호)과 소셜 로그인(카카오/네이버), JWT 발급/재발급/로그아웃(현재 기기), 다중 기기 세션
- 이메일 인증코드 발송·검증(IP 상한), 회원가입, 내 정보 관리, 프로필 이미지, 비밀번호 변경·재설정·설정/제거, 탈퇴
- 반려견 프로필 관리 — AI 추천의 핵심 입력이므로 이 서비스가 단일 원천

`auth`/`member` 컨텍스트는 **BossPickSeoul auth-service와 동일한 구조**다. 여러 소셜 제공자를 붙일 것이므로
원본의 회원 모델(email 식별 + provider 연결)을 그대로 쓴다. `pet`은 혼디가개 고유 컨텍스트다.

## 컨텍스트

- `auth` — 일반 로그인, 이메일 인증, OAuth(state 검증·인가·프로필 조회), 토큰 발급/재발급/로그아웃, 로그인 실패 잠금
- `member` — 회원가입(필수 동의 이력 포함), 내 정보 조회/수정, 프로필 이미지, 비밀번호 변경, 탈퇴
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
- 체중(kg) — `DECIMAL(4,1)` 에 숫자만 저장한다(0.1~99.9, 소수 첫째 자리). 단위 문자열은 저장하지 않는다
- **체중과 크기 구분은 어긋날 수 없다** (`PET_004`) — 30kg 소형견이 저장되면 적합도 판정이
  "소형견만 가능" 장소를 동반 가능으로 읽는다. 경계(10kg/25kg)의 단일 출처는
  `PetSizeType.fromWeight` 다. 체중이 없으면 검증하지 않는다(선택 입력) (#364)
- 환경 민감도: 더위 / 추위 / 소음
- 활동 성향: 활동량(`ActivityLevel`), 산책 선호, 사회성(`SocialityLevel`)
- 회원당 최대 5마리, 소프트 삭제(기존 일정이 참조)
- 성향 분석 결과(ai-service 산출)는 pet이 소유하지 않고 조회 시 결합한다

## API

### auth

- `POST /api/v1/auth/login` — 일반 로그인
- `GET /api/v1/auth/{provider}/authorize?termsAgreed=&privacyAgreed=` — 소셜 인가 URL 생성 (state 10분 유효).
  동의 값은 선택(기본 false)이며 최초 연동(신규 가입)에서만 쓰인다
- `GET /api/v1/auth/{provider}/login?code=&state=` — 소셜 로그인
- `POST /api/v1/auth/email/send-code`, `POST /api/v1/auth/email/verify-code`
- `POST /api/v1/auth/password/reset/send-code`, `POST /api/v1/auth/password/reset` — 비밀번호 재설정
- `GET /api/v1/auth/sessions` — 로그인 기기 목록 (최근 갱신순, current 는 refresh 쿠키로 판별)
- `DELETE /api/v1/auth/sessions/{sessionId}` — 특정 기기 로그아웃 (멱등)
- `POST /api/v1/auth/token/reissue`, `POST /api/v1/auth/logout` (현재 기기만)

### member

- `POST /api/v1/members/signup`
- `POST /api/v1/members/signup/dev` — **개발 전용.** 이메일 인증 없이 테스트 계정을 만든다.
  `@Profile("!prod")` 라 운영에서는 빈이 등록되지 않아 경로 자체가 404 다
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
- **인증 실패는 전부 `Response` 봉투 안의 401 이다** (#214). `JwtAuthProvider` 가 jjwt 예외를 종류와 무관하게
  `SecurityJwtException` 으로 바꾸고(만료 `SECURITY_002` · 서명 불일치 `SECURITY_004` · 나머지 형식·디코딩·클레임 오류
  `SECURITY_003`), 토큰 없이 인증 API 를 부르면 `JwtAuthenticationEntryPoint` 가 `SECURITY_001` 을 쓴다. 이전에는 서명부
  길이가 base64url 에 맞지 않는 토큰이 500 으로, 토큰 없는 요청이 Spring 기본 403 으로 봉투 밖에 나갔다.
  jjwt 의 `SecurityException` 은 `java.lang.SecurityException` 과 이름이 같아 import 없이 catch 하면 엉뚱한 것을 잡는다 —
  `JwtException` 부모로 받는다.
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

`GET /internal/v1/pets/representative/condition?memberId=` — 대표 반려견의 특성. 호출부가 petId 없이 요청했을 때의 기본값이다.
`GET /internal/v1/pets/conditions?memberId=&petIds=` — 여러 마리 벌크 조회. 원격 N+1 방지용이며 소유가 아닌 petId 는 응답에서 빠진다.

- 사회성(`sociality`)도 내려간다 - 필수 입력인데 내부 계약에 빠져 AI 가 버리고 있었다 (#380).
- 응답에는 이름·생년월 원문이 없다. 나이는 판정(노령견·퍼피 구분)에 실제로 필요해
  **파생값 `ageMonths`(개월 수)** 만 내보낸다 — 서비스 경계를 넘는 개인정보 최소화 방침을
  지키면서 필요한 정보만 넘기는 선이다 (#367).
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

## 가입 동의 (이용약관 · 개인정보 처리방침)

가입하는 모든 경로에서 두 문서에 대한 **필수 동의**를 받고, `member_consent` 에 **동의 시각과
문서 버전**을 남긴다. 동의했다는 사실만으로는 부족하다 — 나중에 문제가 되는 것은 "동의했는가"가
아니라 "**무엇에** 동의했는가"라서, 그때 화면에 떠 있던 문서를 되짚을 수 있어야 한다.

이력은 갱신하지 않고 쌓는다. 그래서 `(memberId, type)` 에 unique 를 걸지 않고 조회는
`agreedAt` 최신값을 본다 — 문서가 개정돼 재동의를 받으면 새 행이 생긴다.

### 문서 버전의 정본은 프론트다

실제 약관/방침 본문과 버전은 `frontend/src/lib/legal/terms-of-service.ts` 와
`privacy-policy.ts` 의 `version` 에 있고, 백엔드는 본문을 갖고 있지 않다. 백엔드는 그 값을
`legal.terms-version` / `legal.privacy-version` 설정(환경변수 `LEGAL_TERMS_VERSION` /
`LEGAL_PRIVACY_VERSION`, 기본 `1.0`)으로 따라 적을 뿐이다.

**개정할 때는 프론트 상수와 이 설정을 같은 배포에 함께 올린다.** 어긋나면 화면에 보여준 버전과
이력에 남는 버전이 달라져, 남긴 증거가 오히려 틀린 증거가 된다.

운영 프로파일에도 기본값을 둔 것은 의도다. 다른 prod 설정과 달리 여기서는 환경변수 누락으로
가입 전체가 죽는 것보다 직전 버전으로라도 이력이 남는 편이 낫다.

### 일반 가입 — 두 겹으로 막는다

`MemberGeneralSignupRequest` 의 `termsAgreed` / `privacyAgreed` 에 `@AssertTrue`
(`MEMBER_115` / `MEMBER_116`)를 건다. 두 필드는 반드시 **primitive `boolean`** 이어야 한다 —
`@AssertTrue` 는 null 을 유효로 보기 때문에 래퍼 `Boolean` 을 쓰면 필드를 아예 빼고 보낸 요청이
검증을 통과해 동의 없이 가입된다. primitive 면 Jackson 이 누락을 `false` 로 채우고 검증이 잡는다.

프로세서도 진입부에서 한 번 더 확인하고 위반이면 `MEMBER_010` 으로 끊는다. 두 검사의 관계는
아래 "동의 이력 생성은 한 곳에서만 한다"에 적어 뒀다 — **중복 검사가 아니라 지키는 대상이 다르다.**

개발용 즉시 가입(`/signup/dev`)도 동의를 똑같이 요구하고 이력도 똑같이 남긴다. 개발 계정만 이력이
비어 있으면 이력을 읽는 쪽이 "없을 수도 있는 값"을 다루게 되고, 그 분기는 운영에서 검증되지 않는다.

### 소셜 — `/authorize` 에서 받아 state 에 싣는다

소셜은 동의를 **인가 URL 생성 시점**에 받아 state 와 함께 Redis 에 보관하고, 콜백에서 신규
회원을 만들 때만 꺼내 쓴다. 콜백에서 받지 않는 이유는 **OAuth 인가코드가 1회용**이기 때문이다 —
콜백에서 동의 누락으로 거부하면 같은 코드로는 재시도할 수 없고, 사용자는 provider 인가 화면부터
다시 밟아야 한다. 인가 전에 받아 두면 동의 없이 눌러도 우리 화면에서 되돌릴 수 있다.

동의가 없는 채로 최초 연동이 일어나면 콜백에서 `MEMBER_010`(400)으로 거부하고, **회원을 만들기
전에** 끊는다. 만들고 나서 막으면 동의 없는 계정이 남는다.

state 에 담을 값이 여러 개가 됐지만 Redis Hash 로 바꾸지 않았다. state 의 일회성은 GETDEL 의
원자성에 기대고 있는데 GETDEL 은 Hash 에 먹지 않아, HGETALL + DEL 로 나누면 같은 state 를 두 번
소비할 수 있다. 그래서 JSON 한 덩어리로 직렬화해 단일 String 값에 넣는다. 형식을 바꾼 배포
직후에는 구버전이 남긴 맨 문자열(`KAKAO`) state 가 역직렬화 실패로 떨어지는데, 무효 state 로
처리하면 사용자는 인가부터 다시 밟는다 — TTL 10분이라 곧 사라지는 과도기 현상이다.

### 기존 회원에게 소급 동의를 요구하지 않는다

이미 가입한 회원이 소셜로 로그인할 때 동의 값은 **무시한다**. 동의는 수집·이용 시점에 받는
것이고, 로그인할 때마다 다시 묻는 것은 동의의 의미를 희석한다. 문서 개정에 따른 재동의가
필요해지면 로그인 경로가 아니라 별도 흐름으로 다룰 일이다.

### 알려진 한계 — state 는 브라우저에 묶여 있지 않다

`/authorize` 는 인증 없이 호출할 수 있고 state 는 Redis 에만 있으므로, 인가 URL 을 만든 주체와
provider 에서 인증하는 주체가 다를 수 있다. 즉 여기 실린 동의는 **인가 URL 발급자의 주장**이지
provider 로 인증한 본인의 확인이 아니다. 공격자가 동의를 켠 인가 URL 을 피해자에게 클릭시키면
피해자 이름으로 동의 이력이 남는다.

막으려면 state 를 HttpOnly 쿠키로 함께 내려 콜백에서 double-submit 검증해야 하는데, 콜백을
프론트가 받는 구조라 FE 와 함께 설계해야 한다. 별도 이슈로 다룬다.

### 구현 메모 — 동의 이력 생성은 한 곳에서만 한다

가입 경로가 셋(일반 · 개발용 즉시 · 소셜 최초 연동)이라 규칙을 복제하기 쉬운데, 복제되는 것은
코드 조각이 아니라 **member 컨텍스트의 규칙 셋**이다 — 필수 항목이 무엇인지, 어느 버전을
박제하는지, 항목 간 시각을 어떻게 맞추는지. 선택 동의가 하나 추가되는 날 한 경로에만 3행이
남는 어긋남은 가입 시점에 아무 증상이 없다. 그래서 `MemberConsentProcessor` 하나로 모았다.

이 프로세서는 **트랜잭션을 스스로 열지 않고 호출자 트랜잭션에 합류한다.** 회원 행과 동의 행은
반드시 같은 트랜잭션이어야 하는데 그 경계가 호출자마다 다른 곳(`MemberWebFacade` /
`MemberDevSignupFacade` / `OAuthLoginProcessor.login`)에 있기 때문이다. 같은 이유로 이 책임을
Facade 로 올리지 않았다 — `AuthWebFacade.oauthLogin` 은 외부 HTTP 때문에 의도적으로 무트랜잭션이라,
거기서 부르면 "회원은 있는데 동의 이력이 없는" 행이 생긴다.

프로세서 안에서도 동의 여부를 한 번 더 확인한다(`generalSignup` / `devSignup` / `signupOAuthMember`).
web 경계의 `@AssertTrue` 와 중복이 아니다 — 그쪽이 지키는 것은 *요청 형식*이고, 이쪽이 지키는 것은
**"우리가 남기는 동의 행이 실제 동의를 반영한다"는 불변식**이다. 가입 성공 경로가 무조건 동의 행을
남기기 때문에, 이 검사가 없으면 DTO 를 거치지 않는 호출자가 생기는 순간 이력의 신뢰성이 통째로
무너진다.

### 운영 DDL

`member_consent` 테이블은 local/dev 의 `ddl-auto: update` 로만 생긴다. prod 는 `ddl-auto: none`
(애플리케이션이 운영 스키마를 바꾸지 않는다)이라 **별도 DDL 적용이 필요하다.** 이 저장소 전반의
기존 조건이며 이 테이블만의 문제가 아니다.

## 개발용 즉시 가입 (필수: 운영 노출 금지)

`POST /api/v1/members/signup/dev` — 이메일 인증코드 없이 테스트 계정을 만든다.
dev 서버에서 계정을 만들 때마다 메일함을 열지 않아도 되게 하려는 것이다.

### 무엇을 건너뛰고 무엇을 건너뛰지 않는가

**이메일 인증 게이트만** 건너뛴다. 비밀번호 규칙, 이메일 중복(409 `MEMBER_001`), 이메일
정규화(trim + 소문자), 비밀번호 인코딩, 권한(`USER`)·상태(`ACTIVE`)는 일반 가입과 **같은
코드**를 탄다.

검증까지 함께 느슨하게 하지 않는 것이 요점이다. 개발 계정만 통과하는 값이 생기면 정작
운영에서 막히는 입력을 개발에서 못 잡는다 — 테스트 계정을 만드는 편의가 테스트의 값어치를
깎아먹는 셈이 된다.

### 운영 차단은 프로파일 하나에 걸려 있다

컨트롤러와 파사드 **둘 다** `@Profile("!prod")` 다. 운영에서는 빈이 등록되지 않고, 빈이 없으면
매핑도 없어 경로가 404 다. Swagger 도 운영에서 꺼져 있어 노출 경로가 없다
(`AuthServiceSwaggerConfig` 와 같은 장치).

컨트롤러를 `MemberWebController` 안에 메서드로 두지 않고 파일을 나눈 이유가 여기 있다 —
`@Profile` 은 빈 단위로만 동작해서 메서드에 걸 수 없다. 한 파일에 두면 결국 런타임 분기를
넣게 되고, 그 분기는 지우기도 잊기도 쉽다.

**프로파일을 잘못 준 배포**가 유일하면서 가장 그럴듯한 사고 경로다. 그래서 파사드가 기동 시
WARN 을 남긴다 — 조용히 열려 있는 것보다 시끄럽게 열려 있는 편이 낫다.

```
[DEV] 이메일 인증 없이 가입하는 개발용 API 가 활성화됐습니다.
      운영이라면 spring.profiles.active 에 prod 가 빠진 것입니다.
```

차단 자체를 테스트로 고정했다(`MemberDevSignupProfileGuardTest`) — prod 에서 빈이 없고
dev 에서 있는 것을 양쪽 다 본다. 한쪽만 보면 오타로 항상 꺼져 있는 "안전한데 쓸모없는"
상태를 놓친다.

## 계정 정책 (의도적으로 제공하지 않는 것)

- **이메일 변경 기능은 제공하지 않는다.** 이메일은 로그인 식별자이자 DB unique 키(`uk_member_email`)로
  사실상 계정의 PK 역할이다. 소셜 자동 연결(`AUTH_008`)·재가입 차단·이메일 인증 이력이 모두 이메일에
  묶여 있어, 변경을 허용하면 이 보증들이 전부 흔들린다. 이메일을 바꾸려면 새 계정 가입이 정책이다.
- **탈퇴 시 타 서비스 데이터는 보존한다.** 개인정보(이름/닉네임/프로필/비밀번호)는 auth 에서만
  보관하며 탈퇴 시 마스킹·제거된다. 여행 일정(plan-service)에는 memberId 만 남고 개인 식별 정보가
  없어 그대로 둔다. 일정은 인증 필수라 탈퇴 후 접근 자체가 불가하다.
