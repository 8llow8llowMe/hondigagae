# Frontend Auth Guide

> 백엔드 실측 기준 (`auth-service`, `AuthWebController`). 정본은 `http://localhost:8081/swagger-ui.html`.

## 1. 흐름 (실측)

### 일반 로그인

```text
POST /api/v1/auth/login  { email, password }
 → body   : { dataBody: { accessToken, memberId } }
 → header : Set-Cookie  (refresh token, HttpOnly)
```

### 소셜 로그인 — 2-step API 흐름

```text
1) GET /api/v1/auth/{provider}/authorize
     → { authorizationUrl }        ※ 서버 리다이렉트가 아니다
2) 사용자를 authorizationUrl 로 이동
3) GET /api/v1/auth/{provider}/login?code=&state=
     → 일반 로그인과 동일한 응답 + Set-Cookie
```

`provider`: `kakao`, `naver`

**주의**: 백엔드가 OAuth 리다이렉트를 대신 처리해 주지 않는다. FE(BFF)가 URL을 받아 이동시키고, 콜백 경로에서 `code`/`state` 를 받아 2단계를 호출해야 한다.

### 그 외

```text
POST /api/v1/auth/token/reissue   refresh 쿠키를 읽음, 요청 body 없음
POST /api/v1/auth/logout          인증 필요, refresh 쿠키 삭제
POST /api/v1/auth/email/send-code
POST /api/v1/auth/email/verify-code
POST /api/v1/members/signup
GET|PATCH /api/v1/members/me
```

## 2. 토큰 보관 (절대 규칙)

| 토큰    | 백엔드 전달 방식                       | FE 보관 위치                    |
| ------- | -------------------------------------- | ------------------------------- |
| access  | 응답 **body** (`dataBody.accessToken`) | **Next 서버 세션만**            |
| refresh | **`Set-Cookie` (HttpOnly)**            | **Next 서버만** (프록시가 흡수) |

- **`localStorage` / `sessionStorage` 에 토큰을 넣지 않는다.**
- **클라이언트 상태(Zustand)에도 토큰을 넣지 않는다.** 세션에서 파생된 얕은 값만 둔다: `memberId`, `isAuthenticated`, `me`.
- BFF 프록시(`app/api/bff/[...path]/route.ts`)가 서버 세션의 access token을 `Authorization` 헤더로 주입한다. **클라이언트 코드는 토큰의 존재를 모른다.**
- 세션·토큰을 다루는 모듈은 `src/lib/auth/` 에 두고 최상단에 `import 'server-only'` 를 둔다.

## 3. 재발급 규칙

```text
401 수신
 → POST /api/v1/auth/token/reissue  (1회만)
   ├─ 성공: 원 요청 1회 재시도
   └─ 실패: 서버 세션 비우고 로그인 화면으로
```

- **재발급은 1회만.** 무한 루프를 만들지 않는다.
- 동시에 여러 요청이 401을 받으면 **재발급을 1회로 합친다**(in-flight 공유). 각 요청이 개별 재발급을 호출하면 refresh 토큰 회전과 충돌한다.
- `POST /api/v1/auth/token/reissue` 자체가 401이면 재발급을 재시도하지 않는다.
- React Query `retry` 로 401을 재시도하지 않는다. 이 흐름이 담당한다.

## 4. 식별자

- **`memberId` 는 `string`** 이다. `number` 로 타이핑하거나 `Number(...)` 로 파싱하지 않는다.
- member 식별은 백엔드가 JWT claim으로 처리한다. **FE가 임의 헤더로 memberId를 주입하는 방식은 없다.**
- 내 정보는 `GET /api/v1/members/me`, 내 반려견은 `GET /api/v1/members/me/pets` 로 조회한다. 경로에 memberId를 넣지 않는다.

## 5. 보호 경로

`proxy.ts` 의 `PROTECTED_PATHS` 와 실제 화면 목록을 **일치시킨다.** 화면을 추가하고 가드를 빼먹으면 로그인 없이 접근된다.

> Next 16 에서 `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었고, 내보내는 함수도 `proxy` 다.
> `proxy` 는 **nodejs 런타임 고정**이며 edge 를 지원하지 않는다.

초기 보호 대상 (구현 범위 기준):

```ts
export const PROTECTED_PATHS = [
  '/mypage', // 내 정보
  '/pets', // 반려견 프로필
  '/plans', // 여행 일정
  '/ai-plans', // AI 일정 생성
]
```

- 장소 탐색(`/places`)은 **공개**다. tour-service는 security 의존이 없는 공개 조회 서비스다.
- 미인증 접근은 로그인 화면으로 보내고, 로그인 후 원래 경로로 복귀시킨다(`returnTo`).
- 같은 오리진 리다이렉트는 `src/lib/http/redirect.ts` 헬퍼를 쓴다.

## 6. 이메일 인증 UX

`send-code` → `verify-code` 2단계다. 화면에서 지킬 것:

- 재전송 쿨다운을 두고 남은 시간을 표시한다.
- 코드 만료 시간을 화면에 드러낸다 (실제 TTL은 백엔드 확인).
- 검증 실패 사유는 `resultMessage` · `fieldErrors[].message` 를 그대로 노출한다.

## 7. 로그아웃

```text
POST /api/v1/auth/logout   (인증 필요)
 → Set-Cookie 로 refresh 쿠키 삭제
```

FE는 **서버 세션도 함께 비운다.** 백엔드 쿠키만 지우고 서버 세션이 남으면 유령 로그인 상태가 된다.

## 8. refresh 쿠키 실측 (확정)

백엔드 `RefreshCookieProvider` 실측 — 2026-08-26.

| 속성     | 값                              |
| -------- | ------------------------------- |
| name     | `refreshToken`                  |
| HttpOnly | `true`                          |
| SameSite | `Strict`                        |
| Path     | `/api/v1/auth/token/reissue`    |
| Secure   | prod 프로파일에서만 `true`      |
| Max-Age  | `jwt.refresh-expiration` 설정값 |

**이 두 속성이 BFF 설계를 결정한다.**

- `Path` 가 reissue 로 제한된다 → 브라우저가 이 쿠키를 들고 있어도 다른 요청에는 전송되지 않는다.
- `SameSite=Strict` → **소셜 로그인 리다이렉트로 복귀할 때 쿠키가 전송되지 않는다.**

따라서 브라우저가 refresh 쿠키를 직접 보관하는 구성은 성립하지 않는다.
BFF가 게이트웨이 응답의 `Set-Cookie` 에서 값을 꺼내 **자체 세션에 봉인**하고,
reissue 를 호출할 때 `Cookie: refreshToken=...` 헤더로 되돌려준다.

구현: `src/lib/auth/refresh-cookie.ts` (파싱), `src/lib/auth/session.ts` (봉인),
`app/api/bff/[...path]/route.ts` (주입). 각각 테스트가 있다.

### BFF의 토큰 차단

BFF는 응답 `dataBody` 에서 `accessToken` / `refreshToken` 필드를 **제거한 뒤** 브라우저로
내려보낸다 (`stripTokens`). 로그인 응답의 body 에 access token 이 들어 있으므로,
제거하지 않으면 BFF를 쓰는 의미가 없다. 브라우저에는 `memberId` 만 남는다.

## 9. 미결 / BE 후속 요청

- 배포 도메인 확정 시 게이트웨이 `ApiGatewayCorsConfig` 허용 목록 등록 필요 (미등록이면 **POST만 빈 403**).
- 소셜 콜백 redirect URI 를 카카오/네이버 개발자 콘솔에 등록하는 주체와 값 확정 필요.
- `jwt.refresh-expiration` 실제 값 확인 후 세션 쿠키 만료를 맞춘다.
