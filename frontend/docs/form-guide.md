# Frontend Form Guide

> 폼 규약 정본 (T4). `docs/fe-foundation-spec.md` 의 미작성 항목을 채운다.
> 근거: 백엔드 `ValidationErrorSupport` / `ValidationErrorBody` / 각 도메인 `*ValidationMessage` 실측 (2026-08-27)
> 최초 적용: 로그인·회원가입 화면. 복잡 폼 검증: 반려견 프로필 (이슈 #12)

## 1. 결정 — zod + 자체 경량 훅

폼 라이브러리를 도입하지 않는다. `zod`(이미 의존성에 있음) + 얇은 자체 훅을 쓴다.

| 근거                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- |
| 의존성 0개 추가. 이 저장소는 런타임 의존성 9개로 보수적으로 유지하고 있다                                                   |
| 검증·오류 병합·제출 상태를 **순수 함수**로 뽑으면 현재 테스트 환경에서 그대로 테스트된다 (`testing-guide.md` §1)            |
| `component-guide.md` §5 가 상호작용 컴포넌트를 **controlled 전용**으로 못박았다. RHF 의 uncontrolled/ref 모델과 결이 다르다 |

Server Actions 를 쓰지 않는 이유: 전송 경로가 BFF 프록시(`/api/bff`)로 통일돼 있다
(`architecture-guide.md` §8). Server Action 을 섞으면 인증 주입·에러 분기가 두 벌이 된다.

**재검토 조건**: 필드 20개 이상 / 배열 필드 / 단계별 위저드가 필요해지면 이 결정을 다시 본다.

## 2. 모듈 구조

```text
src/lib/form/
  field-errors.ts   서버 400 응답 → FormErrors        순수
  validate.ts       zod safeParse → FormErrors        순수
  use-form.ts       상태 배선 + 제출 (얇게)
src/lib/messages/form.ts   클라이언트 검증 문구
```

**순수 함수에 로직을 몰고 훅은 배선만 한다.** 훅은 node 테스트 환경에서 검증할 수 없다.

## 3. 오류 표현

```ts
export type FormErrors = {
  /** 필드명 → 표시할 메시지 1개 */
  fields: Record<string, string>
  /** 특정 필드에 귀속되지 않는 오류 (로그인 실패, 이메일 중복 등) */
  form: string | null
}
```

필드 오류와 폼 전체 오류를 **한 타입에 담되 자리를 나눈다.** 백엔드가 두 종류를 모두
`resultMessage` 로 내려주기 때문이다 (§4).

## 4. 서버 400 → 필드 매핑 (핵심)

### 4.1 백엔드가 내려주는 두 가지 형태

**(a) Bean Validation 실패** — `resultMessage` 가 **객체**다.

```jsonc
{
  "dataHeader": {
    "success": false,
    "resultCode": "MEMBER_104", // 정렬된 첫 오류의 코드
    "resultMessage": {
      "message": "비밀번호는 8자 이상 20자 이하여야 합니다.", // 첫 오류의 메시지
      "errors": [
        {
          "code": "MEMBER_104",
          "field": "password",
          "message": "비밀번호는 8자 이상 20자 이하여야 합니다.",
        },
        { "code": "MEMBER_105", "field": "password", "message": "비밀번호는 공백 없이 ..." },
        { "code": "MEMBER_108", "field": "nickname", "message": "닉네임은 필수입니다." },
      ],
    },
  },
  "dataBody": null,
}
```

**(b) 도메인 예외** — `resultMessage` 가 **문자열**이다.

```jsonc
{
  "dataHeader": {
    "success": false,
    "resultCode": "MEMBER_001",
    "resultMessage": "이미 가입된 이메일 (a@b.c)입니다.",
  },
  "dataBody": null,
}
```

`resultMessage` 는 백엔드 `DataHeader` 에서 `Object` 타입이다. **`string` 으로 좁히지 않는다.**

### 4.2 매핑 규칙

1. **`errors[]` 를 순회하되 필드별 첫 오류만 채택한다. 뒤 항목으로 덮어쓰지 않는다.**
   백엔드 `ValidationErrorSupport` 가 이미 정렬해서 내려준다:
   **(1) DTO 선언 순서 → (2) 제약 우선순위 → (3) 메시지**.
   제약 우선순위는 `필수(0) → 길이(1) → 범위(2) → 형식(3)` 으로, 사용자가 먼저 고쳐야 할 것이 앞에 온다.
   덮어쓰면 이 정렬이 통째로 무의미해진다. 위 예시에서 비밀번호는 `MEMBER_104`(길이)를 보여야지
   `MEMBER_105`(문자 구성)를 보이면 안 된다.
2. `resultMessage` 가 **문자열**이면 `form` 에 넣는다. 필드 오류가 아니다.
3. 형태가 어느 쪽도 아니면 `fields` 는 비우고 `form` 에 화면 기본 문구를 넣는다.
   **빈 오류로 조용히 성공한 것처럼 보이게 두지 않는다.**
4. **서버 문구를 그대로 쓴다.** FE 에서 한국어로 다시 쓰지 않는다 (`api-integration-guide.md` §6).

### 4.3 필드명 정합성

`errors[].field` 는 백엔드 DTO 의 필드명이다. 폼 상태의 키를 **요청 DTO 필드명과 같게** 둔다.
다르면 매핑 테이블이 필요해지고, 백엔드가 필드를 바꿀 때 조용히 깨진다.

`field` 가 `"request"` 면 백엔드가 필드를 특정하지 못한 경우다 → `form` 으로 보낸다.

## 5. 클라이언트 검증

zod 스키마는 **백엔드 제약의 복제본**이다. 각 필드에 대응하는 백엔드 코드를 주석으로 남긴다.

```ts
// MEMBER_104 @Size(min=8,max=20) / MEMBER_105 @Pattern — MemberValidationMessage 실측
password: z.string().min(8, ...).max(20, ...).regex(PASSWORD_PATTERN, ...)
```

- 필드별 **첫 issue 만** 채택한다. 서버 규칙(§4.2)과 같은 동작이어야 한다.
- 클라이언트 검증은 서버 왕복을 줄이는 것이지 **대체가 아니다.** 서버 오류를 항상 다시 병합한다.
- **예외: `POST /auth/login` 은 백엔드에 `@Valid` 가 없어 서버 검증이 돌지 않는다.**
  여기서는 클라이언트 검증이 유일한 방어다 (BE 후속 요청으로 분리됨).

### 병합 순서

```text
제출 → 클라이언트 검증 실패? → 표시하고 중단 (요청 보내지 않음)
     → 통과 → 요청 → 400 → 서버 오류로 fields/form 을 교체
```

클라이언트 오류와 서버 오류를 **합치지 않고 교체한다.** 둘을 합치면 이미 고친 필드의
낡은 클라이언트 오류가 남는다.

## 6. 제출 중 중복 방지

**두 겹 모두 건다.**

| 겹                            | 이유                                                      |
| ----------------------------- | --------------------------------------------------------- |
| 버튼 `disabled` + `aria-busy` | 시각·보조기술에 상태를 알린다 (`component-guide.md` §7)   |
| 훅 내부 재진입 가드 (ref)     | `disabled` 반영 전에 Enter 키 제출이 두 번 들어갈 수 있다 |

제출 성공/실패와 무관하게 가드를 반드시 해제한다 (`finally`).

## 7. 이탈 경고

- `beforeunload` 로 **브라우저 이탈만** 다룬다. dirty 이면서 제출 중이 아닐 때만 건다.
- **App Router 내 라우트 이동은 경고하지 않는다.** Next App Router 에 이동을 가로채는 공식 API 가
  없다. 비공식 우회(router 패치, `popstate` 가로채기)는 버전 업에서 깨지므로 쓰지 않는다.
- 이 한계를 화면 설계로 보완한다: 되돌아가기 버튼에서 확인을 받거나, 입력이 짧게 유지되게 만든다.

## 8. 접근성 (폼이 보장할 것)

`component-guide.md` §7 의 `Input 계열` 계약을 폼 단위로 확장한다.

- 모든 입력에 `label` 을 연결한다 (`id` / `htmlFor`). placeholder 를 label 대신 쓰지 않는다.
- 오류 시 `aria-invalid="true"` + `aria-describedby` 로 오류 메시지를 연결한다.
- **폼 전체 오류는 `role="alert"`** 로 낸다. 제출 후 화면 변화가 없으면 스크린리더 사용자가 실패를 모른다.
- 제출 실패 시 **첫 오류 필드로 포커스를 옮긴다.**
- 비밀번호 표시 토글은 `aria-pressed` 로 상태를 알린다.

## 9. 테스트

`testing-guide.md` §1 방식(node + `renderToStaticMarkup`)을 그대로 따른다.

| 대상               | 방법                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `field-errors`     | 순수 함수 테스트. **필드 중복 시 첫 오류 채택**, 문자열 형태, 비정상 형태  |
| `validate`         | 순수 함수 테스트. 필드별 첫 issue                                          |
| 폼 컴포넌트        | props 로 `FormErrors` 를 주입해 마크업에 `aria-invalid` / 메시지 노출 확인 |
| 제출·입력 상호작용 | **테스트 불가.** 브라우저 실측으로 검증한다 (`fe-design-reviewer`)         |

## 10. 새 폼 체크리스트

- [ ] 폼 상태 키가 요청 DTO 필드명과 같다
- [ ] zod 스키마에 대응 백엔드 코드 주석이 있다
- [ ] 서버 400 을 `field-errors` 로 병합한다 (`errors[]` 형태·문자열 형태 둘 다)
- [ ] 필드별 첫 오류만 표시한다
- [ ] 폼 전체 오류가 `role="alert"` 로 나온다
- [ ] 제출 중 중복 방지가 두 겹이다
- [ ] 제출 실패 시 첫 오류 필드로 포커스가 간다
- [ ] 401 / 409 / 429 분기를 화면 문구로 확정했다
- [ ] `done-checklist.md` 를 통과했다
