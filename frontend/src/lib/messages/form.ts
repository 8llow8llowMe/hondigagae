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
} as const
