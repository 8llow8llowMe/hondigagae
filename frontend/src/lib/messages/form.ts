/**
 * 폼 문구.
 *
 * 클라이언트 검증 문구는 **백엔드 ValidationMessage 의 복제본**이다.
 * 대응 코드를 주석으로 남겨 드리프트를 추적한다 — docs/form-guide.md §5.
 * 서버가 내려준 문구는 여기에 넣지 않는다. 그대로 렌더한다.
 */
export const formMessages = {
  // AUTH_101 / MEMBER_101
  emailRequired: '이메일은 필수입니다.',
  // AUTH_102 / MEMBER_102
  emailInvalid: '이메일 형식이 올바르지 않습니다.',
  // AUTH_104
  codeRequired: '인증코드는 필수입니다.',
  // AUTH_103 / MEMBER_103
  passwordRequired: '비밀번호는 필수입니다.',
  // MEMBER_104
  passwordLength: '비밀번호는 8자 이상 20자 이하여야 합니다.',
  // MEMBER_105
  passwordPattern: '비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.',
  // MEMBER_106
  nameRequired: '이름은 필수입니다.',
  // MEMBER_107
  nameLength: '이름은 10자 이하만 가능합니다.',
  // MEMBER_108
  nicknameRequired: '닉네임은 필수입니다.',
  // MEMBER_109
  nicknameLength: '닉네임은 10자 이하만 가능합니다.',
  // MEMBER_115
  termsAgreementRequired: '이용약관에 동의해야 가입할 수 있습니다.',
  // MEMBER_116
  privacyAgreementRequired: '개인정보 처리방침에 동의해야 가입할 수 있습니다.',
  // MEMBER_117
  ageOver14Required: '만 14세 이상만 가입할 수 있습니다.',

  /*
    새 비밀번호 규칙 안내 — 입력란 아래 `Field.hint` (#1080). 가입 3단계 · 비밀번호 재설정 ·
    마이페이지 변경/설정이 같은 문구를 쓴다.

    **백엔드 문구의 복제본이 아니다.** 위 `passwordLength`(MEMBER_104) · `passwordPattern`
    (MEMBER_105)은 틀린 뒤의 문장이라 둘로 갈리고 "…해야 합니다" 로 끝난다 — 미리 보여 줄
    자리에는 규칙 **전체**(길이 + 문자 구성)를 한 줄로 준다. 규칙의 정본은 여전히 스키마
    (`lib/form/password-pattern.ts` + `.min(8).max(20)`)다. 규칙이 바뀌면 여기도 고친다.

    틀리면 이 줄 대신 오류가 선다 (`Field` 는 hint 와 error 를 함께 그리지 않는다).
  */
  passwordRule: '8~20자, 영문 · 숫자 · 특수문자 각 1자 이상',

  /** 응답 형태를 해석하지 못했을 때의 최후 문구 */
  submitFailed: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
} as const

/** 인증 화면 문구 */
export const authMessages = {
  loginTitle: '로그인',
  loginSubmit: '로그인',
  loginSubmitting: '로그인 중',
  emailLabel: '이메일',
  passwordLabel: '비밀번호',
  /*
    비밀번호 표시 토글의 이름 (`aria-label`) — `PasswordInput` 의 기본값이다 (#1080).
    로그인 · 회원가입 3단계 · 비밀번호 찾기 2단계가 쓴다. 칸이 둘인 마이페이지는 대상을
    붙인 자기 문구를 넘긴다 (`memberMessages.currentPasswordShow` 등).

    **아이콘은 `aria-hidden` 이라 이 문구가 버튼의 유일한 이름이다.** 예전에는 입력란
    **옆**에 선 텍스트 버튼이라 `표시` / `숨기기` 두 글자였는데, 눈 아이콘이 입력란
    **안**으로 들어가면서 그 짧은 형태는 쓸 자리가 없어져 지웠다 — 소리로만 듣는 쪽에
    `표시` 는 무엇을 표시하는지 말해 주지 않는다.
  */
  passwordShow: '비밀번호 표시',
  passwordHide: '비밀번호 숨기기',
  toSignup: '회원가입',
  toLogin: '로그인하기',

  alreadyLoggedIn: '이미 로그인되어 있어요',
  logout: '로그아웃',
  goBack: '이어서 이용하기',

  signupTitle: '회원가입',
  stepOf: (current: number, total: number) => `${total}단계 중 ${current}단계`,
  /*
    회원가입 하단의 로그인 입구 (#1083). 질문과 링크를 나눈다 — **링크 글자는 "로그인"
    하나다.** 질문까지 링크로 묶으면 접근 가능한 이름이 문장이 되어 링크 목록에서 무엇을
    하는 링크인지 한눈에 안 읽힌다.
  */
  haveAccountPrompt: '이미 계정이 있나요?',
  haveAccountLink: '로그인',
  /*
    2·3단계에서 "어느 이메일로 진행 중인가" 를 라벨과 함께 보인다 (#1083). 이메일만 덩그러니
    두면 무엇을 가리키는 값인지 읽히지 않는다. 단계마다 그 이메일의 역할이 달라 라벨도 둘이다.
  */
  codeRecipientLabel: '받는 이메일',
  signupEmailLabel: '가입할 이메일',
  sendCode: '인증코드 받기',
  sendingCode: '전송 중',
  codeSent: '메일로 인증코드를 보냈어요.',
  codeLabel: '인증코드',
  verifyCode: '확인',
  verifyingCode: '확인 중',
  codeVerified: '이메일 인증이 완료됐어요.',
  resendCode: '재전송',
  resendCooldown: (seconds: number) => `재전송 (${seconds}초 후 가능)`,
  changeEmail: '이메일 다시 입력',
  nameLabel: '이름',
  nicknameLabel: '닉네임',
  signupSubmit: '가입하기',
  signingUp: '가입 중',
  signupDone: '가입이 완료됐어요. 로그인해 주세요.',

  /*
    가입 동의·만 14세 확인 (이슈 #688).

    **세 항목 다 필수라 "선택" 이 없다.** 라벨에 `(필수)` 를 붙이는 것은 장식이 아니라,
    선택 동의가 섞인 다른 서비스의 가입 화면을 겪은 사용자가 "안 켜도 되는 것" 으로
    읽는 것을 막는다. 실제로 셋 다 켜지 않으면 가입이 400 으로 막힌다.

    **거부 문구는 여기에 없다.** `MEMBER_115/116/117` · `MEMBER_010/011` 의
    `resultMessage` 를 그대로 쓴다 (클라이언트 검증 문구는 `formMessages` 의 복제본).
  */
  consentHeading: '가입 동의',
  /*
    전체 동의 (#1083). **세 항목이 전부 필수라 "전체" 가 곧 "필수 전체" 다** — 선택 동의가
    생기면 이 문구와 `setAllSignupConsent` 의 범위를 함께 다시 정해야 한다.
  */
  consentAllLabel: '모두 동의해요',
  termsConsentLabel: '(필수) 이용약관에 동의해요',
  privacyConsentLabel: '(필수) 개인정보 처리방침에 동의해요',
  ageConsentLabel: '(필수) 만 14세 이상이에요',
  /* 링크 글자는 짧게 두고, 무엇의 전문인지는 접근 가능한 이름이 말한다 (WCAG 2.5.3) */
  consentDocumentLinkText: '전문 보기',
  consentDocumentLinkLabel: (title: string) => `${title} 전문 보기 (새 창)`,
  /*
    소셜 버튼이 비활성인 이유. **버튼만 흐리게 두지 않는다** — 왜 못 누르는지 보이지
    않으면 사용자는 고장으로 읽는다.
  */
  socialConsentRequired: '소셜 계정으로 가입하려면 위 동의 항목에 모두 체크해 주세요.',
  /*
    소셜 콜백이 `MEMBER_010` / `MEMBER_011` 로 실패했을 때의 다음 행동.

    목적지가 `/login` 이 아닌 이유: 동의는 `/authorize` 단계에서만 실을 수 있고
    (인가코드 1회용), 로그인 화면의 소셜 버튼은 동의를 싣지 않는다.

    **"회원가입에서" 라고 말하지 않는다** (#707). 목적지가 회원가입 화면이 아니라
    `/signup/social/{provider}` — 동의 3종만 있는 전용 화면으로 바뀌었다. 제공자를
    특정하지 못할 때만 `/signup` 으로 떨어지므로, 두 목적지에 다 맞는 말로 둔다.
  */
  toSignupConsent: '가입 동의하기',

  /*
    소셜 최초 연동 전용 동의 화면 (#707).

    **이 화면에는 이메일 폼도 단계 표시도 없다.** 콜백에서 튕겨 돌아온 사용자에게
    필요한 것은 동의 3종뿐인데, 회원가입 화면으로 보내면 쓸 일 없는 이메일 입력과
    **다른 제공자 버튼**까지 함께 보인다 — 후자는 누르는 순간 다른 이메일의 다른
    가입이 된다.
  */
  socialSignupConsentTitle: '가입 동의만 하면 돼요',
  /*
    이 화면에서 남은 일 하나를 말한다 (#1083 에서 단순화).

    #707 초안은 **왜** 제공자를 한 번 더 거치는지(인가코드 1회용 · 동의 화면 생략)까지
    설명했는데, 두 줄이 넘고 "보안상 방금 받은 인증" 같은 기술 용어가 섞였다. 사용자에게
    필요한 것은 이유가 아니라 **무엇을 누르면 끝나는지**다. "또 처음부터" 로 읽히는 것은
    "한 번 더 누르면 끝나요" 가 막는다 — 남은 일이 버튼 하나라는 말이기 때문이다.

    **버튼 문구를 그대로 부른다** (`socialLoginLabel`). 버튼이 `카카오 로그인` 인데 안내가
    "카카오로 계속하기" 를 말하면 사용자는 찾는 버튼이 없다고 읽는다 (DESIGN.md §2-8).
  */
  socialSignupConsentNotice: (provider: string) =>
    `아래 항목에 동의하고 ${provider} 로그인을 한 번 더 누르면 가입이 끝나요.`,

  /*
    비밀번호 찾기 (이슈 #85 · 비밀번호찾기-세부명세.md D5).

    **"가입되지 않은 이메일이에요" 류의 문구를 만들지 않는다.** 서버가 계정 존재
    여부를 일부러 감추는데(항상 성공 응답) 화면이 그것을 흘리면 계정 열거가 된다.
    발송 성공 문구는 이메일 존재 여부와 무관하게 늘 `resetCodeSent` 하나다.
  */
  forgotPassword: '비밀번호를 잊으셨나요?',
  resetTitle: '비밀번호 찾기',
  resetEmailHeading: '가입한 이메일을 알려주세요',
  resetEmailDescription: '비밀번호를 새로 만들 수 있는 코드를 보내드려요.',
  resetSendCode: '코드 받기',
  resetSendingCode: '보내는 중',
  resetCodeSent: '메일을 보냈어요. 받은 편지함을 확인해 주세요.',
  resetCodeHeading: '메일로 받은 코드를 입력해 주세요',
  newPasswordLabel: '새 비밀번호',
  resetSubmit: '비밀번호 재설정',
  resetSubmitting: '재설정 중',
  resetDoneTitle: '비밀번호를 바꿨어요',
  resetDoneDescription:
    '보안을 위해 모든 기기에서 로그아웃했어요. 새 비밀번호로 다시 로그인해 주세요.',
  toLoginScreen: '로그인으로',

  /*
    소셜 로그인 · 콜백 (이슈 #85 · 소셜콜백-세부명세.md D5).

    **오류 문구를 여기에 만들지 않는다.** 여덟 개 오류 코드 전부 서버 `resultMessage`
    가 이미 행동을 안내한다 (AUTH_008 은 어느 소셜로 가입됐는지까지 말해 준다).
    여기 있는 것은 우리가 쓰는 라벨과, 서버 문구가 없을 때의 최후 문구뿐이다.
  */
  /*
    **"…로 계속하기" 가 아니라 "… 로그인" 이다** (공식 마크 도입, 소셜콜백-세부명세 D8-1).

    각 사 브랜드 가이드는 자기 마크를 단 버튼의 **문구까지 정한다.** Figma
    `카카오 네이버 로그인 디자인 가이드 (Community)` 의 두 컴포넌트가 각각
    `카카오 로그인`(node `122:59`) · `네이버 로그인`(node `122:123`) 을 들고 있고,
    "…로 계속하기" 는 어느 쪽 허용 문구에도 없다. 마크를 다는 이상 문구도 따라간다.

    **회원가입 화면에서도 "로그인" 이다.** 미가입 이메일이면 서버가 자동으로 가입시켜
    두 화면의 결과가 같으므로(정본 D8-3) 그 자리에서 실제로 일어나는 일이 로그인이다.
  */
  socialLoginLabel: (provider: string) => `${provider} 로그인`,
  socialRetryLabel: (provider: string) => `${provider} 다시 시도`,
  oauthExchanging: '로그인하고 있어요',
  oauthInvalidTitle: '잘못된 접근이에요',
  oauthInvalidDescription: '로그인 화면에서 다시 시도해 주세요.',
  oauthFailedTitle: '로그인하지 못했어요',
} as const
