# Auth Service

## 책임

- 일반 로그인(이메일+비밀번호)과 소셜 로그인(카카오/네이버), JWT 발급/재발급/로그아웃(현재 기기), 다중 기기 세션
- 이메일 인증코드 발송·검증(IP 상한), 회원가입, 내 정보 관리, 프로필 이미지, 비밀번호 변경·재설정·설정/제거, 탈퇴
- 반려견 프로필 관리 — AI 추천의 핵심 입력이므로 이 서비스가 단일 원천

`auth`/`member` 컨텍스트는 **BossPickSeoul auth-service와 동일한 구조**다. 여러 소셜 제공자를 붙일 것이므로
원본의 회원 모델(email 식별 + provider 연결)을 그대로 쓴다. `pet`은 혼디가개 고유 컨텍스트다.

## 컨텍스트

- `auth` — 일반 로그인, 이메일 인증, OAuth(state 검증·인가·프로필 조회), 토큰 발급/재발급/로그아웃, 로그인 실패 잠금
- `member` — 회원가입(필수 동의 · 만 14세 이상 확인 이력 포함), 내 정보 조회/수정, 프로필 이미지, 비밀번호 변경, 탈퇴
- `pet` — 반려견 프로필 CRUD

## 회원 모델 (원본과 동일)

`member` 테이블은 **email이 식별자**(`uk_member_email`)다. `provider`는 연결된 소셜 제공자이며 **null이면 일반 계정**이다.

| 컬럼 | 설명 |
|------|------|
| `email` | 회원 식별자 (unique, NOT NULL). **탈퇴 시 다이제스트로 치환된다** — 아래 "탈퇴" 절 |
| `password` | 일반 계정 비밀번호 해시. 소셜 전용 계정은 null |
| `name`, `nickname` | 이름 / 닉네임 (탈퇴 시 마스킹) |
| `profileImageUrl` | 소셜 제공자가 준 외부 CDN URL |
| `profileImageKey` | 직접 업로드한 오브젝트 키. **표시 우선순위는 key > url** |
| `role` | `SecurityRole` |
| `provider` | `OAuthProvider`(KAKAO/NAVER). null이면 일반 계정 |
| `status` | `MemberStatus`(ACTIVE/WITHDRAWN/SUSPENDED) |
| `withdrawnAt` | 탈퇴 시각. ACTIVE 회원은 null. 30일 보존 기간의 기준점 |

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
- `GET /api/v1/auth/{provider}/authorize?termsAgreed=&privacyAgreed=&ageOver14Confirmed=` — 소셜 인가 URL 생성 (state 10분 유효).
  세 값 모두 선택(기본 false)이며 최초 연동(신규 가입)에서만 쓰인다. 같은 state 를 `oauthState` HttpOnly 쿠키로도 심는다
- `GET /api/v1/auth/{provider}/login?code=&state=` — 소셜 로그인. `oauthState` 쿠키가 쿼리 state 와 일치해야 한다 (없거나 다르면 `AUTH_010`)
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
- **OAuth state 는 Redis 에만 두지 않고 `oauthState` HttpOnly 쿠키로도 심어 요청한 브라우저에 묶는다** (#681).
  콜백은 쿼리 state 와 쿠키 state 가 같을 때만 통과한다 — 아래 "state 는 쿠키로 브라우저에 묶는다" 참고.
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

## 가입 동의 (이용약관 · 개인정보 처리방침 · 만 14세 이상 확인)

가입하는 모든 경로에서 두 문서에 대한 **필수 동의**와 **만 14세 이상 확인**을 받고,
`member_consent` 에 **시각과 근거 문서 버전**을 남긴다. 동의했다는 사실만으로는 부족하다 —
나중에 문제가 되는 것은 "동의했는가"가 아니라 "**무엇에** 동의했는가"라서, 그때 화면에 떠 있던
문서를 되짚을 수 있어야 한다. 가입 한 번에 `member_consent` 3행이 같은 시각으로 남는다.

이력은 갱신하지 않고 쌓는다. 그래서 `(memberId, type)` 에 unique 를 걸지 않고 조회는
`agreedAt` 최신값을 본다 — 문서가 개정돼 재동의를 받으면 새 행이 생긴다.

**`AGE_OVER_14` 는 "동의"가 아니라 "확인"이다.** 앞의 두 항목은 문서에 대한 의사표시라 철회하면
이용계약이 끝나지만, 이 항목은 사실에 대한 자기신고라 철회라는 개념이 없다 — 나이는 되돌릴 수
있는 값이 아니다. 동의 철회·재동의 흐름을 만들 때 **이 항목을 대상에 넣지 않는다.** 같은 테이블에
담는 이유는 "가입 시점에 무엇을 묻고 무엇을 확인받았는가"가 한 자리에서 복원돼야 하기 때문이지
성격이 같아서가 아니다. 이 행의 `documentVersion` 에는 **이용약관 버전**이 들어간다 — 만 14세
미만 가입 불가를 규정하는 것이 이용약관이라, 복원해야 하는 것은 "그때 그 조항이 어떤
문장이었는가"다.

### 문서 버전의 정본은 프론트다

실제 약관/방침 본문과 버전은 `frontend/src/lib/legal/terms-of-service.ts` 와
`privacy-policy.ts` 의 `version` 에 있고, 백엔드는 본문을 갖고 있지 않다. 백엔드는 그 값을
`legal.terms-version` / `legal.privacy-version` 설정(환경변수 `LEGAL_TERMS_VERSION` /
`LEGAL_PRIVACY_VERSION`, 기본 `1.0`)으로 따라 적을 뿐이다.

**개정할 때는 프론트 상수와 이 설정을 같은 배포에 함께 올린다.** 어긋나면 화면에 보여준 버전과
이력에 남는 버전이 달라져, 남긴 증거가 오히려 틀린 증거가 된다.

운영 프로파일에도 기본값을 둔 것은 의도다. 다른 prod 설정과 달리 여기서는 환경변수 누락으로
가입 전체가 죽는 것보다 직전 버전으로라도 이력이 남는 편이 낫다.

### 만 14세 미만 가입을 막는 수단 — 자기신고 체크박스 (결정됨)

**결정됨. FE 도 이 판단을 따른다.** 다시 논의하려면 아래 근거를 반박하는 이슈를 먼저 연다.

후보는 셋이었다. (a) "만 14세 이상입니다" 자기신고 체크박스, (b) 생년월일 수집,
(c) 본인확인 서비스 연동. **(a) 를 쓴다.**

- (b) 는 반려견 여행 서비스가 **쓰지도 않는 개인정보를 더 걷게 된다.** 생년월일은 추천에도
  일정 설계에도 쓰이지 않아서, 수집하는 순간 최소수집 원칙과 정면으로 부딪힌다. 게이트 하나를
  위해 평생 보관·파기 책임이 있는 항목을 늘리는 거래는 맞지 않는다.
- (c) 는 공모전 규모에 과하다. 계약·심사·비용이 붙고, 얻는 것은 같은 게이트 하나다.

#### 소셜 provider 의 연령대 정보를 쓰지 않는 이유

카카오 `age_range` / 네이버 `age` 로 대신하면 체크박스 없이 걸러낼 수 있을 것 같지만,
**둘 다 만 14세 경계를 가르지 못한다.**

- **카카오** — [`age_range`](https://developers.kakao.com/docs/latest/ko/kakaologin/utilize#scope-user) 는
  **한국 나이**이고 구간이 `1~9` / `10~14` / `15~19` / `20~29` … 로 끊긴다
  ([REST API 응답 명세](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info-response)).
  법이 요구하는 것은 **만** 14세(개인정보 보호법 제22조의2)라 기준이 어긋난다. `15~19` 이상만
  통과시키면 한국 나이 15세인 **만 13세가 통과**하고, `20~29` 이상으로 올리면 만 14~19세
  정상 이용자를 전부 막는다. 어느 쪽으로 잘라도 틀린다.
- **네이버** — [프로필 조회 명세](https://developers.naver.com/docs/login/profile/profile.md)가 `age` 를
  "사용자 연령대"로만 적고 값 목록을 싣지 않는다. 실린 예시가 `40-49` 라 10년 단위 구간이고,
  그러면 `10-19` 한 구간이 만 14세를 **통째로 가로지른다.** 경계를 가를 방법이 아예 없다.
- **부수 비용** — 카카오 연령대를 필수 동의로 걸려면 동의 단계 설정 권한 신청(검수)이 선행되고,
  수집 항목이 늘어 개인정보 처리방침을 고쳐야 한다. 게다가 **이메일 가입 경로엔 provider 가
  없어 체크박스가 어차피 필요하므로**, 두 경로가 서로 다른 수단으로 같은 게이트를 지키게 된다.

#### 자기신고의 한계 — 알고 쓴다

**거짓 신고를 걸러내지 못한다.** 만 13세가 체크박스를 켜면 통과한다. 그럼에도 이 수준을
택한 이유는, 보호법이 요구하는 것이 "만 14세 미만임을 **알면서** 처리하지 않을 것"과 통상적
수준의 확인 조치이기 때문이다. 이 서비스는 연령을 수집하지도 활용하지도 않는 구조라
(성인 인증이 필요한 콘텐츠도, 결제도 없다) 이 수준이 과소하다고 보지 않는다. 대신
**물어봤고 확인받았다는 사실은 이력으로 남긴다** — 게이트만 걸고 기록하지 않으면 나중에
그 사실을 입증할 수 없다.

### 일반 가입 — 두 겹으로 막는다

`MemberGeneralSignupRequest` 의 `termsAgreed` / `privacyAgreed` / `ageOver14Confirmed` 에
`@AssertTrue`(`MEMBER_115` / `MEMBER_116` / `MEMBER_117`)를 건다. 세 필드는 반드시
**primitive `boolean`** 이어야 한다 — `@AssertTrue` 는 null 을 유효로 보기 때문에 래퍼 `Boolean`
을 쓰면 필드를 아예 빼고 보낸 요청이 검증을 통과해 동의 없이 가입된다. primitive 면 Jackson 이
누락을 `false` 로 채우고 검증이 잡는다.

프로세서도 진입부에서 한 번 더 확인하고, 문서 동의 위반은 `MEMBER_010`, 만 14세 확인 위반은
`MEMBER_011` 로 끊는다. **두 코드를 합치지 않는 이유는 프론트가 강조할 체크박스가 다르기
때문이다** — 하나로 뭉치면 사용자는 "동의를 다 했는데 왜 안 되지"를 겪는다. 두 검사(web 경계와
프로세서)의 관계는 아래 "동의 이력 생성은 한 곳에서만 한다"에 적어 뒀다 — **중복 검사가 아니라
지키는 대상이 다르다.**

개발용 즉시 가입(`/signup/dev`)도 동의와 만 14세 확인을 똑같이 요구하고 이력도 똑같이 남긴다.
개발 계정만 이력이 비어 있으면 이력을 읽는 쪽이 "없을 수도 있는 값"을 다루게 되고, 그 분기는
운영에서 검증되지 않는다.

### 소셜 — `/authorize` 에서 받아 state 에 싣는다

소셜은 동의·확인을 **인가 URL 생성 시점**에 받아 state 와 함께 Redis 에 보관하고, 콜백에서 신규
회원을 만들 때만 꺼내 쓴다. 콜백에서 받지 않는 이유는 **OAuth 인가코드가 1회용**이기 때문이다 —
콜백에서 누락으로 거부하면 같은 코드로는 재시도할 수 없고, 사용자는 provider 인가 화면부터
다시 밟아야 한다. 인가 전에 받아 두면 체크 없이 눌러도 우리 화면에서 되돌릴 수 있다.

값이 없는 채로 최초 연동이 일어나면 콜백에서 거부하고, **회원을 만들기 전에** 끊는다. 만들고
나서 막으면 동의 없는 계정이 남는다. 사유는 항목별로 갈라 내보낸다 — 문서 동의 누락은
`MEMBER_010`(400), 만 14세 확인 누락은 `MEMBER_011`(400). 둘 다 비면 문서 동의 누락을 먼저
안내한다.

state 에 담을 값이 여러 개가 됐지만 Redis Hash 로 바꾸지 않았다. state 의 일회성은 GETDEL 의
원자성에 기대고 있는데 GETDEL 은 Hash 에 먹지 않아, HGETALL + DEL 로 나누면 같은 state 를 두 번
소비할 수 있다. 그래서 JSON 한 덩어리로 직렬화해 단일 String 값에 넣는다. 형식을 바꾼 배포
직후에는 구버전이 남긴 맨 문자열(`KAKAO`) state 가 역직렬화 실패로 떨어지는데, 무효 state 로
처리하면 사용자는 인가부터 다시 밟는다 — TTL 10분이라 곧 사라지는 과도기 현상이다.

**필드가 늘어난 배포 직후도 같은 과도기가 있다.** JSON 에 새 필드가 없으면 record 의 canonical
생성자 인자가 primitive 기본값 `false` 로 채워진다 (jackson-databind 2.18.3 실측;
`FAIL_ON_NULL_FOR_PRIMITIVES` 는 *명시적 null* 에만 걸리고 *누락* 에는 걸리지 않으며 이 서비스는
그 설정을 켜지 않는다). 그래서 `ageOver14Confirmed` 가 없던 형식으로 저장된 state 는
`false` 로 살아나 최초 연동이 `MEMBER_011` 로 거부된다 — **의도한 방향이다.** 묻지 않은 확인을
받았다고 칠 수는 없다. 이 동작은 `RedisOAuthStateStoreAdapterTest` 가 고정한다.

### 기존 회원에게 소급 동의를 요구하지 않는다

이미 가입한 회원이 소셜로 로그인할 때 동의 값은 **무시한다**. 동의는 수집·이용 시점에 받는
것이고, 로그인할 때마다 다시 묻는 것은 동의의 의미를 희석한다. 문서 개정에 따른 재동의가
필요해지면 로그인 경로가 아니라 별도 흐름으로 다룰 일이다.

### state 는 쿠키로 브라우저에 묶는다 (#681)

`/authorize` 는 인증 없이 호출할 수 있어서, state 를 Redis 에만 두면 인가 URL 을 만든 주체와
provider 에서 인증하는 주체가 다를 수 있었다. 그러면 여기 실린 동의는 **인가 URL 발급자의
주장**일 뿐이라, 공격자가 동의를 켠 인가 URL 을 피해자에게 클릭시키면 피해자 이름으로 동의
이력이 남는다. 보호법 제22조의 "동의를 받았다는 입증"을 하려고 만든 기록을 제3자가 만들 수
있으면 증거로서의 값이 없다.

그래서 **state 를 쿠키로도 내려보내고, 콜백에서 쿼리 state 와 쿠키 state 가 일치할 때만
소비한다**(double-submit). 공격자가 발급받은 state 는 피해자 브라우저에 없으므로 콜백이 거부되고,
동의 위조뿐 아니라 소셜 로그인 CSRF 전반이 함께 막힌다.

| 항목 | 값 |
|------|-----|
| 쿠키 이름 | `oauthState` (`OAuthStateCookieProvider` 가 단독 소유) |
| 속성 | `HttpOnly` · `Secure`(local 프로필만 off) · `SameSite=Strict` · `Path=/api/v1/auth` |
| 수명 | `OAuthLoginProcessor.STATE_TTL` = 10분 — Redis state 와 **같은 상수를 참조**한다 |

refresh 쿠키와 같은 기준이다. `Secure` 판정은 "https 로 서비스되는가"이고 dev 도 https 라서
`local` 프로필만 예외다. 경로를 `/api/v1/auth` 로 잡은 것은 `/authorize`(심기)와
`/{provider}/login`(읽기)이 함께 지나는 가장 좁은 범위이기 때문이다. TTL 상수를 복제하지 않고
발급하는 쪽 값을 그대로 가져다 쓰는 이유는, 쿠키가 먼저 죽으면 **아직 유효한 state 를 가진 정상
사용자가 거부**되기 때문이다.

**`SameSite=Strict` 로도 되는 이유** — 이 저장소는 브라우저가 게이트웨이를 직접 부르지 않는다.
프론트가 provider 콜백을 자기 오리진에서 받고, 게이트웨이 호출은 **BFF 가 서버에서** 한다. 즉 이
쿠키는 브라우저↔게이트웨이 사이를 직접 오가지 않고 BFF 가 꺼내 자기 세션에 봉인했다가
되돌려준다 (refresh 토큰과 똑같은 취급 — `frontend/src/lib/auth/refresh-cookie.ts`). 그래서
크로스사이트 리다이렉트 전송 문제가 애초에 없고 속성을 가장 좁게 둘 수 있다.

**검증 순서는 쿠키 대조 → Redis `consume` 이다.** 뒤집으면 쿠키 불일치로 어차피 거부될 요청이
멀쩡한 state 를 태워 버려 정상 사용자의 재시도까지 막는다. 비교는 `MessageDigest.isEqual` 로 해
응답 시간 차이로 state 를 맞춰 볼 표면을 만들지 않는다. 소비 후에는 성공·실패 양쪽에서 쿠키를
만료시킨다 — 컨트롤러가 유스케이스 호출 **전에** 만료 헤더를 서블릿 응답에 심는 것은 실패 응답이
예외 핸들러를 타고 나가기 때문이다. `ResponseEntity` 헤더에만 달면 성공 경로에서만 지워진다
(`OAuthStateCookieFlowTest` 가 이 회귀를 고정한다).

**쿠키 없는 요청은 거부한다.** 사유는 기존 `AUTH_010 INVALID_OAUTH_STATE` 그대로다 — 공격자에게
"쿠키가 없어서 막혔다"를 알려줄 이유가 없고, 프론트 처리도 이미 있다. 배포 직후 10분(= state TTL)
동안은 구버전 프론트에서 온 콜백이 여기 걸려 사용자가 인가부터 다시 밟는다. state 저장 형식을
바꿨을 때와 같은 과도기이고, TTL 이 지나면 사라진다.

**프론트 없이는 완성되지 않는다.** BFF 가 `/authorize` 응답의 `Set-Cookie` 를 세션에 봉인했다가
콜백 호출에 되실어야 이 검증이 성립한다. 그 전까지 프론트 경로의 소셜 로그인은 전부 `AUTH_010`
으로 막히므로 **#689 와 함께 배포한다.**

### 구현 메모 — 동의 이력 생성은 한 곳에서만 한다

가입 경로가 셋(일반 · 개발용 즉시 · 소셜 최초 연동)이라 규칙을 복제하기 쉬운데, 복제되는 것은
코드 조각이 아니라 **member 컨텍스트의 규칙 셋**이다 — 필수 항목이 무엇인지, 어느 버전을
박제하는지, 항목 간 시각을 어떻게 맞추는지. 항목이 하나 추가되는 날 한 경로에만 옛 개수가
남는 어긋남은 가입 시점에 아무 증상이 없다. 그래서 `MemberConsentProcessor` 하나로 모았다.
만 14세 확인을 3번째 항목으로 붙일 때 고친 곳이 이 클래스 한 줄뿐이었던 것이 그 증거다.

이 프로세서는 **트랜잭션을 스스로 열지 않고 호출자 트랜잭션에 합류한다.** 회원 행과 동의 행은
반드시 같은 트랜잭션이어야 하는데 그 경계가 호출자마다 다른 곳(`MemberWebFacade` /
`MemberDevSignupFacade` / `OAuthLoginProcessor.login`)에 있기 때문이다. 같은 이유로 이 책임을
Facade 로 올리지 않았다 — `AuthWebFacade.oauthLogin` 은 외부 HTTP 때문에 의도적으로 무트랜잭션이라,
거기서 부르면 "회원은 있는데 동의 이력이 없는" 행이 생긴다.

프로세서 안에서도 동의·확인 여부를 한 번 더 본다(`generalSignup` / `devSignup` /
`signupOAuthMember`). web 경계의 `@AssertTrue` 와 중복이 아니다 — 그쪽이 지키는 것은 *요청 형식*
이고, 이쪽이 지키는 것은 **"우리가 남기는 행이 실제 동의·확인을 반영한다"는 불변식**이다. 가입
성공 경로가 무조건 3행을 남기기 때문에, 이 검사가 없으면 DTO 를 거치지 않는 호출자가 생기는
순간 이력의 신뢰성이 통째로 무너진다.

### 운영 DDL

`member_consent` 테이블은 local/dev 의 `ddl-auto: update` 로만 생긴다. prod 는 `ddl-auto: none`
(애플리케이션이 운영 스키마를 바꾸지 않는다)이라 **별도 DDL 적용이 필요하다.** 이 저장소 전반의
기존 조건이며 이 테이블만의 문제가 아니다.

#### `ConsentType` 에 상수를 더할 때는 기존 테이블을 손봐야 한다

Hibernate 6.6 은 `@Enumerated(EnumType.STRING)` 컬럼에 `check (type in (...))` 제약을 함께
만드는데, **`ddl-auto: update` 는 이미 있는 CHECK 제약을 갱신하지 않는다.** 그래서 테이블이
만들어진 뒤에 상수를 더하면 새 값을 넣는 순간 제약 위반으로 insert 가 막힌다.

막혀도 조용히 넘어가지 않고 **회원 생성까지 함께 롤백된다** (동의 이력과 회원이 한 트랜잭션).
확인받지 않은 회원이 남지 않는다는 뜻이라 방향은 안전하지만, 그 사이 가입은 전부 실패한다.

- **local/dev** — `member_consent` 를 한 번 drop 하면 다음 기동에 현재 상수 전부로 다시 생긴다.
  아직 감사 대상 데이터가 없는 단계라 이것이 가장 싸다.
- **prod** — 위의 별도 DDL 적용에 `ALTER TABLE` 제약 갱신을 포함한다.

`AGE_OVER_14` 가 이 상황의 첫 사례다. 동의 수집(`member_consent` 신설)과 만 14세 확인이 각각
다른 PR 로 나뉘어, 앞의 것만 dev 에 올라간 뒤 뒤의 것이 올라가면 여기에 걸린다.

## 탈퇴 — 무엇이 남고 무엇이 지워지나

**처리방침의 "파기" 절은 이 절을 그대로 옮겨 적으면 된다.** 좋은 관행이 아니라 사실을 적는 자리다.

탈퇴는 행을 즉시 지우지 않는다(논리 탈퇴). `Member.withdraw()` 가 이렇게 바꾼다.

| 항목 | 탈퇴 후 |
|------|---------|
| `email` | **HMAC-SHA256 다이제스트로 치환.** 원문은 남지 않는다 |
| `password` | 제거 (null) |
| `name`, `nickname` | `"탈퇴회원"` 으로 마스킹 |
| `profileImageUrl`, `profileImageKey` | 제거. MinIO 객체는 기존 고아 청소 스케줄러가 회수 |
| `status` | `WITHDRAWN` |
| `withdrawnAt` | 탈퇴 시각 기록 |

### 왜 원문이 아니라 다이제스트인가

**재가입 차단이라는 목적은 다이제스트로도 그대로 달성된다.** 같은 이메일인지 판정하는 데는
같은 값이 나오는지만 보면 되고, 그 값에서 개인을 복원할 필요가 없다. 원문을 남기면 처리
목적이 끝난 뒤에도 식별 가능한 개인정보를 계속 들고 있는 것이 된다 (보호법 제21조).

**단순 SHA-256 이 아니라 HMAC 인 이유** — 이메일 주소 공간은 열거 가능하다. 순수 다이제스트는
후보 이메일을 대입해 맞춰보면 뚫린다. 서버만 아는 pepper 를 키로 쓰는 HMAC 이라야 "값에서
개인을 복원할 수 없다"가 실제로 성립한다.

> **⚠️ `WITHDRAWN_EMAIL_PEPPER` 를 바꾸면 안 된다.** 바꾸는 순간 이미 저장된 다이제스트와
> 새로 계산한 값이 달라져 **재가입 차단이 조용히 뚫린다.** 오류도 로그도 나지 않는다 —
> 탈퇴한 이메일로 그냥 다시 가입된다. 한 번 정하면 고정한다. 값이 비어 있거나 **32자** 미만이면
> 기동 시점에 실패시킨다 (비밀 없는 해시로 조용히 도는 것이 최악이라서). 길이는 바이트가 아니라
> **문자 수**를 센다 — 코드가 `pepper.length()` 를 본다.
>
> dev/prod 는 기본값 없이 Vault 에서 주입한다. local 만 편의를 위해 명시적인 가짜 기본값을 둔다.

**교체를 감지하는 수단은 기동 로그의 지문뿐이다.** `WithdrawnEmailHasher` 가 기동 시 한 번
INFO 로 찍는다.

```
[WithdrawnEmailHasher] 탈퇴 이메일 해시 pepper 지문: ab12cd34
```

고정 상수의 HMAC 앞 8자(hex)다. **쓰는 법은 배포 전후 로그의 지문을 비교하는 것** — 값이
달라졌으면 pepper 가 바뀐 것이고, 그 시점부터 기존 탈퇴 행과의 대조가 어긋난다. 지문은 32비트만
노출하는 HMAC 출력이라 **이 값으로 pepper 를 역산할 수 없고**, pepper 원문은 어디에도 찍지 않는다.
(지문 산출에 쓰는 고정 상수를 바꾸면 이전 배포 로그와 비교할 수 없게 되므로 바꾸지 않는다.)

### 재가입 차단은 두 경로 모두에서 막는다

- **인증코드 발송** — `EmailVerificationProcessor.sendCode` 도 **가입과 같은 판정**(원문 +
  다이제스트)을 쓴다. 원문만 보면 탈퇴한 주소에 인증코드가 발급되고 verified 플래그까지 잡힌 뒤
  마지막 가입에서야 `MEMBER_001` 로 막힌다 — 최종 우회는 아니지만 "기가입 이메일에는 코드를 주지
  않는다"는 규칙이 탈퇴자에게만 깨진다. **같은 사실을 두 곳이 다르게 판정하지 않게 맞춰 뒀다.**
- **일반 가입** — `validateEmailNotExists` 가 원문과 다이제스트를 한 번의 쿼리로 함께 본다.
  응답은 기존과 같은 `EXIST_MEMBER_EMAIL` 이다 (계정 상태를 노출하지 않으려고 탈퇴/정지를
  구분하지 않는 기존 방침을 유지한다).
- **소셜** — 다이제스트로 바꾸면 `findByEmail(원문)` 이 탈퇴 회원을 **못 찾아** 그대로 신규
  생성 경로로 빠진다. 그러면 탈퇴자가 소셜로 재가입된다. 그래서 신규 생성 직전에
  `validateNotWithdrawn` 이 다이제스트로 한 번 더 확인하고 기존과 같은
  `MEMBER_ALREADY_WITHDRAWN` 을 던진다. **조용히 뚫리는 종류라 회귀 테스트로 고정해 뒀다.**

`OAuthLoginProcessor.resolveExistingMember` 의 `case WITHDRAWN` 은 **이제 도달하지 않는다** —
탈퇴 행이 `findByEmail(원문)` 에 잡히지 않기 때문이다. 마이그레이션 이전의 원문 행에만 해당하는
잔여 가드이므로 남겨 두되, **이 분기를 근거로 `validateNotWithdrawn` 을 "중복"이라며 지우면
그 순간 소셜 재가입이 뚫린다.** 코드에도 같은 주석을 달아 뒀다.

### 보존 기간 — 탈퇴 후 30일

30일이 지나면 `WithdrawnMemberPurgeScheduler` 가 회원 행과 그 회원의 `pet` · `member_consent`
행을 함께 지운다. 그 시점부터 같은 이메일로 다시 가입할 수 있다.

**30일인 이유** — 재가입 차단의 실질 목적은 착오 탈퇴 직후의 즉시 재가입을 막는 것이다.
그 목적에 필요한 기간을 넘겨 보관할 근거가 없다. 무기한으로 두면 "목적이 끝났는데 남아
있는 값"이라는 제21조 문제가 형태만 바꿔 되돌아온다.

`withdrawnAt` 이 null 인 행은 **기간 미경과로 취급해 지우지 않는다.** 마이그레이션 이전의
옛 탈퇴 행이 여기 해당하고, 아래 러너가 값을 채우면 대상에 들어온다.

**한 번에 1000명씩 끊어 지운다.** 대상 아이디를 통째로 `in (...)` 에 싣는 구조라, 마이그레이션이
옛 탈퇴 행의 `withdrawnAt` 을 한꺼번에 채우고 나면 그 다음 실행에서 누적분 전체가 한 번에 대상이
된다. 트랜잭션은 회차가 아니라 **배치 단위**(`WithdrawnMemberPurgeProcessor`)에 걸린다 — 회차
전체를 한 트랜잭션으로 묶으면 로그인 경로가 읽는 테이블의 잠금을 실행 내내 붙잡는다. 배치가
실제로 행을 지우므로 루프는 대상이 마르면 끝나고, 삭제가 반영되지 않는 예외 상황을 대비해
한 회차 50배치(= 최대 5만 명) 상한을 둔다. 상한에 걸리면 남은 것은 다음 회차로 넘긴다.

#### purge 이후의 `memberId` 고아 참조

30일 뒤 `member` 행이 사라져도 **plan-service 의 일정·동행 반려견 특성 스냅샷은 남는다.** 그
`memberId` 는 이제 어느 회원도 가리키지 않는다. 남은 값은 반려견 크기·활동성 같은 여행 조건뿐이라
**개인 식별 정보가 아니고 파기 대상도 아니다.** 다만 처리방침의 "파기" 절을 쓸 때 "탈퇴하면 전부
사라진다"로 적으면 사실과 다르다 — **알고 쓴다.**

### 기존 데이터 마이그레이션 (일회성)

원문으로 남아 있던 옛 탈퇴 행은 `WithdrawnEmailMigrationRunner` 가 기동 시 1회 다이제스트로
바꾼다. SQL 로는 못 한다 — MySQL 에 HMAC 내장 함수가 없다.

- 대상 판별은 **`email` 에 `@` 가 들어 있는가**로 한다. 다이제스트에는 `@` 가 없어 확실하다.
- `withdrawnAt` 이 비어 있으면 `updatedAt` 으로 채운다. **근사치다** — 탈퇴 이후 그 행을
  갱신하는 경로가 없어 가장 그럴듯한 값이지만 정확한 탈퇴 시각은 아니다.
- 멱등하다. 두 번 돌아도 안전하고 대상이 0건이면 조용히 끝난다.
- **일회성 코드다.** dev/prod 에 1회 적용된 것이 확인되면 다음 정리 PR 에서 제거한다.

#### 운영 DDL — **배포 전에 반드시 먼저 적용한다**

`member.withdrawn_at` 은 local/dev 의 `ddl-auto: update` 로만 생긴다. prod 는 `ddl-auto: none`
(애플리케이션이 운영 스키마를 바꾸지 않는다)이라 **컬럼이 자동으로 생기지 않는다.** 위
`member_consent` 의 운영 DDL 과 같은 조건이다.

```sql
ALTER TABLE member ADD COLUMN withdrawn_at TIMESTAMP NULL COMMENT '탈퇴 시각';
```

**DDL 없이 배포하면 auth-service 가 기동하지 않는다.** 기동 직후 `WithdrawnEmailMigrationRunner`
가 `m.withdrawnAt` 을 참조하는 순간 unknown column 으로 터진다. 인증 서비스가 뜨지 않으면
로그인·토큰 재발급이 전부 멈추므로 **전 서비스가 함께 멈춘다.** 한 기능이 죽는 것이 아니라
서비스 전체가 죽는 종류의 사고다.

**러너를 try-catch 로 감싸 기동을 살리지 않는다.** 그렇게 하면 컬럼이 없는 채로 서비스가 뜨고,
탈퇴 이메일 **원문이 계속 평문으로 쌓인다.** 조용히 틀린 상태로 도는 것보다 기동 실패가 낫다 —
기동 실패는 배포 즉시 드러나고 되돌릴 수 있지만, 쌓인 원문은 나중에 복구할 수 없다.

#### 배포 전 확인 쿼리 — 대소문자 중복 탈퇴 행

정규화(`EmailNormalizer`) 도입 이전에 대소문자만 다른 같은 주소로 탈퇴한 행이 둘 이상 있으면,
마이그레이션이 둘을 **같은 다이제스트로 바꾸면서** `member.email` 의 unique 제약에 걸린다.
러너가 기동 때마다 같은 자리에서 실패하므로 **기동이 영구히 막힌다.** MySQL 기본 collation 은
대소문자를 무시해서 애초에 그런 행이 저장될 수 없었으니 실제로는 거의 없지만, 되돌리기 비싼
쪽이라 배포 전에 0건을 확인한다.

```sql
select lower(email), count(*) from member
 where status = 'WITHDRAWN' and email like '%@%'
 group by 1 having count(*) > 1;
```

0건이 아니면 중복 행 중 하나만 남기고 나머지를 먼저 정리한 뒤 배포한다.

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
- **탈퇴 시 타 서비스 데이터는 보존한다.** 개인정보(이메일/이름/닉네임/프로필/비밀번호)는 auth 에서만
  보관하며 탈퇴 시 마스킹·제거·다이제스트 치환된다 (위 "탈퇴" 절). 여행 일정(plan-service)에는
  memberId 만 남고 개인 식별 정보가 없어 그대로 둔다. 일정은 인증 필수라 탈퇴 후 접근 자체가
  불가하다. **단 30일이 지나 회원 행이 삭제되면 그 memberId 는 어느 사람도 가리키지 않는
  고아 값이 된다** — plan-service 가 회원 조회에 기대는 경로가 생기면 그때 함께 손봐야 한다.
