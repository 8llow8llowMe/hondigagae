/**
 * 마이페이지 문구 — 마이페이지-세부명세 D5 에 확정된 것만 담는다.
 *
 * 어미는 해요체다. 예외는 **백엔드 `MemberValidationMessage` 복제본**뿐이고,
 * 그 줄에는 바로 위에 `// MEMBER_NNN` 주석을 단다 — `message-tone.test.ts` 가
 * 그 위치를 본다.
 */
export const memberMessages = {
  myPageTitle: '내 정보',
  backToMyPage: '내 정보로 돌아가기',
  myPageDescription: '계정과 반려견을 관리해요.',

  edit: '수정',
  editProfileTitle: '내 정보 수정',

  emailLabel: '이메일',
  nicknameLabel: '닉네임',

  // MEMBER_108
  nicknameRequired: '닉네임은 필수입니다.',
  // MEMBER_109
  nicknameLength: '닉네임은 10자 이하만 가능합니다.',

  myPets: '내 반려견',
  petsEmpty: '아직 등록한 반려견이 없어요',

  accountSection: '계정',
  passwordChange: '비밀번호 변경',
  passwordSetup: '비밀번호 설정',
  /** `provider` 표시명은 서버가 주지 않는다 — src/lib/member/provider.ts 매핑 */
  linkedWith: (provider: string) => `${provider}로 연결됨`,
  version: '버전',
  versionValue: '1.0.0',

  logout: '로그아웃',
  logoutConfirmTitle: '로그아웃할까요?',
  logoutConfirmDescription: '다시 이용하려면 로그인해야 해요.',

  withdraw: '회원탈퇴',

  loadFailedTitle: '내 정보를 불러오지 못했어요',
  loadFailedDescription: '잠시 후 다시 시도해 주세요.',

  /** 프로필 이미지 */
  profileImage: '프로필 사진',
  profileImageSelect: '사진 선택',
  profileImageRemove: '사진 삭제',
  profileImageUploading: '사진을 올리는 중이에요',
  profileImageUploaded: '사진을 바꿨어요',
  profileImageRemoved: '사진을 지웠어요',
  profileImageUploadFailed: '이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.',
  /**
   * 상한을 화면이 말할 수 있다 — 서버 `spring.servlet.multipart.max-file-size` 기본값이
   * 5MB 이고 `infra.storage.max-file-bytes` 도 5242880 으로 같다 (공통명세 S5-1 해소).
   */
  profileImageHint: 'jpg · png · gif · webp, 5MB 이하',
  /** 화면이 먼저 막는 경우. 서버도 STORAGE_002 로 다시 막는다 */
  profileImageTooLarge: '5MB 이하 파일만 올릴 수 있어요.',
  save: '저장',
  cancel: '취소',

  /** 비밀번호 관리 */
  passwordTitle: '비밀번호 관리',
  currentPasswordLabel: '현재 비밀번호',
  newPasswordLabel: '새 비밀번호',
  passwordChangeSubmit: '변경하기',
  passwordSetupSubmit: '설정하기',
  passwordSetupDescription: '비밀번호를 설정하면 이메일로도 로그인할 수 있어요.',
  passwordChangedNotice: '비밀번호를 바꿨어요. 다시 로그인해 주세요.',

  // MEMBER_111
  currentPasswordRequired: '현재 비밀번호는 필수입니다.',
  // MEMBER_112
  newPasswordRequired: '새 비밀번호는 필수입니다.',

  /** 소셜 전용 전환 */
  removePasswordTitle: (provider: string) => `비밀번호를 없애고 ${provider}로만 로그인해요`,
  removePasswordDescription:
    '비밀번호를 지우면 이메일 로그인은 할 수 없어요. 다시 설정하면 되돌릴 수 있어요.',
  removePasswordSubmit: '비밀번호 없애기',
  removePasswordConfirmTitle: '비밀번호를 없앨까요?',
  removePasswordDone: '비밀번호를 없앴어요. 다시 로그인해 주세요.',

  /** 판별 불가 — 동작 버튼을 하나도 내지 않는다 (D5) */
  accountStateUnknown: '계정 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',

  /** 탈퇴 */
  withdrawTitle: '회원탈퇴',
  withdrawLead: '탈퇴하면 아래 정보가 모두 사라져요.',
  withdrawItems: ['등록한 반려견 프로필', '만든 여행 일정과 일정에 담은 장소', 'AI 일정 생성 기록'],
  withdrawIrreversible: '되돌릴 수 없고, 같은 이메일로 다시 가입할 수 없어요.',
  withdrawSubmit: '탈퇴하기',
  withdrawConfirmTitle: '정말 탈퇴할까요?',
  withdrawConfirmDescription: '지운 정보는 되돌릴 수 없어요.',
  withdrawCancel: '돌아가기',
  withdrawDone: '탈퇴가 완료됐어요. 그동안 이용해 주셔서 고마워요.',
} as const
