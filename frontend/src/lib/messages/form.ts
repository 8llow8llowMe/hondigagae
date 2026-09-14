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
  passwordShowShort: '표시',
  passwordHideShort: '숨기기',
  toSignup: '회원가입',
  toLogin: '로그인하기',

  alreadyLoggedIn: '이미 로그인되어 있어요',
  logout: '로그아웃',
  goBack: '이어서 이용하기',

  signupTitle: '회원가입',
  stepOf: (current: number, total: number) => `${total}단계 중 ${current}단계`,
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
