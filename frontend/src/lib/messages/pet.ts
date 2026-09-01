/**
 * 반려견 화면 문구.
 *
 * 검증 문구는 **백엔드 `PetValidationMessage` 의 복제본**이다. 대응 코드를 주석으로
 * 남겨 드리프트를 추적한다 (docs/form-guide.md §5).
 *
 * `options` 의 `name`/`description` 은 예외적으로 FE 가 들고 있다. 선택지 목록을
 * 내려주는 API 가 없어서다 — 응답 metadata 는 이미 선택된 값 하나뿐이다.
 * 근거는 backend `shared-travel/pet/*` 이고, BE 요청은 공통명세 S6-1 에 남겼다.
 * **선택된 값을 표시할 때는 서버 metadata 를 그대로 쓴다.** 이 표를 조회에 쓰지 않는다.
 */
export const petMessages = {
  // 화면
  listTitle: '내 반려견',
  listDescription: '등록한 반려견의 성향을 여행 설계에 반영해요.',
  newTitle: '반려견 등록',
  editTitle: '반려견 정보 수정',

  // 빈 상태 / 오류
  emptyTitle: '등록된 반려견이 없어요',
  emptyDescription: '반려견을 등록해 맞춤 여행을 받아보세요.',
  notFoundTitle: '존재하지 않는 반려견이에요',
  notFoundDescription: '목록으로 돌아가 다시 선택해주세요.',
  loadFailedTitle: '정보를 불러오지 못했어요',
  loadFailedDescription: '잠시 후 다시 시도해주세요.',

  // 상한
  limitReached: '최대 5마리까지 등록할 수 있어요.',

  // 액션
  register: '등록하기',
  save: '저장하기',
  delete: '삭제하기',
  /**
   * 삭제 확인 — 아트보드 `혼디가개 마이페이지·내 반려견.dc.html` 의 `aria-modal` 다이얼로그.
   * `{name}` 은 목적격 조사를 붙여 치환한다 (`withObjectParticle`).
   *
   * **아트보드의 "일정 1개는 그대로 남지만" 은 쓰지 않는다** — 일정 개수를 주는 API 가 없다.
   * 셀 수 없는 것을 숫자로 적으면 그 문장이 거짓이 된다.
   */
  deleteConfirmTitle: '{name} 삭제할까요?',
  deleteConfirmDescription: '판정 기준이 사라져요. 되돌릴 수 없어요.',
  deleteDialogLabel: '반려견 삭제',
  cancel: '취소',
  backToList: '목록으로',

  // 라벨 — 어미는 해요체로 통일한다 (이슈 #15 의 어미 혼용을 되풀이하지 않는다)
  labels: {
    name: '이름',
    breed: '품종',
    birthYm: '생년월',
    sizeType: '크기',
    weightKg: '체중',
    activityLevel: '활동량',
    sociality: '사회성',
    heatSensitive: '더위에 민감해요',
    coldSensitive: '추위에 민감해요',
    noiseSensitive: '소음에 민감해요',
    walkPreferred: '산책을 좋아해요',
  },

  hints: {
    optional: '선택 입력',
    birthYm: '선택 입력 · 2017-05 형식',
    /**
     * **모르면 비워도 된다는 것을 먼저 말한다.** 크기가 이미 필수라 체중까지 필수처럼
     * 보이면 모르는 사람이 대충 적고, 그 값이 장소 필터 판정에 그대로 쓰인다.
     */
    weightKg: '선택 입력 · 입장 체중 제한이 있는 곳을 걸러 줄 때 써요',
  },

  // 검증 — PetValidationMessage 복제본
  // PET_101
  nameRequired: '반려견 이름은 필수입니다.',
  // PET_102
  nameLength: '반려견 이름은 20자 이하만 가능합니다.',
  // PET_103
  breedLength: '품종은 50자 이하만 가능합니다.',
  // PET_104
  birthYmFormat: '생년월은 yyyy-MM 형식이어야 합니다.',
  // PET_105
  sizeTypeRequired: '크기 구분은 필수입니다.',
  /*
    PET_108 · PET_109 를 하나로 합친다. 서버는 범위와 자릿수를 따로 말하지만, 입력이
    한 칸이고 고칠 방법도 같아서 나누면 사용자가 두 규칙을 외워야 한다.
  */
  weightInvalid: '체중은 0.1 ~ 99.9kg 사이, 소수점 한 자리까지 입력할 수 있어요.',
  // PET_106
  activityLevelRequired: '활동량은 필수입니다.',
  // PET_107
  socialityRequired: '사회성은 필수입니다.',

  // ── 체중 · 사진 · 대표견 (#126) ────────────────────────────────────────

  weightLabel: '체중',
  weightUnit: 'kg',
  /**
   * **모르면 비워도 된다는 것을 먼저 말한다.** 크기 구분(소형/중형/대형)이 이미 필수라
   * 체중까지 필수처럼 보이면 모르는 사람이 대충 적는다 — 그 값이 장소 필터 판정에
   * 그대로 쓰인다.
   */
  weightHelp: '모르면 비워 두세요. 입장 체중 제한이 있는 곳을 걸러 줄 때 써요.',

  photoLabel: '프로필 사진',
  photoUpload: '사진 등록',
  photoChange: '사진 변경',
  photoRemove: '사진 삭제',
  /** `{name}` 치환 */
  photoAlt: '{name} 프로필 사진',
  photoUploading: '사진을 올리는 중',

  representativeBadge: '대표',
  representativeSet: '대표로 지정',
  /** 이미 대표인 아이의 버튼 자리 — 해제 API 가 없다 (다른 아이를 지정하면 옮겨간다) */
  representativeCurrent: '대표 반려견이에요',
  /**
   * **왜 대표가 필요한지 말한다.** "대표" 만 있으면 즐겨찾기 같은 장식으로 읽힌다.
   */
  representativeHelp: 'AI 일정에서 반려견을 고르지 않으면 대표 아이를 기준으로 짜요.',
  /** `{name}` 치환 — 지정 직후 안내 */
  representativeDone: '{name}를 대표로 지정했어요.',
  representativeFailed: '대표로 지정하지 못했어요. 잠시 후 다시 시도해 주세요.',

  /** 근거: backend shared-travel PetSizeType / ActivityLevel / SocialityLevel */
  options: {
    sizeType: [
      { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
      { code: 'MEDIUM', name: '중형견', description: '체중 10kg 이상 25kg 미만' },
      { code: 'LARGE', name: '대형견', description: '체중 25kg 이상' },
    ],
    activityLevel: [
      {
        code: 'LOW',
        name: '낮음',
        description: '짧은 산책을 선호하며 장시간 활동을 힘들어합니다.',
      },
      { code: 'MEDIUM', name: '보통', description: '일반적인 산책과 관광 일정을 소화합니다.' },
      { code: 'HIGH', name: '높음', description: '긴 산책과 활동적인 일정을 선호합니다.' },
    ],
    sociality: [
      { code: 'LOW', name: '낮음', description: '다른 개나 낯선 사람을 불편해합니다.' },
      { code: 'MEDIUM', name: '보통', description: '상황에 따라 적응합니다.' },
      { code: 'HIGH', name: '높음', description: '다른 개나 사람과 잘 어울립니다.' },
    ],
  },
} as const
