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
  listDescription: '내 반려견을 등록해 여행 계획을 완성해 보세요.',
  newTitle: '반려견 등록',
  editTitle: '반려견 정보 수정',
  /**
   * 수정 화면 **폼 카드**의 제목. `editTitle`(= 페이지 이름, `h1 sr-only`)과 갈라 둔다 —
   * 카드 판정 ①이 요구하는 것은 **그 카드가 담는 것의 이름**이지 페이지 이름이 아니고,
   * 같은 문구가 `h1`·`h2` 로 두 번 들리면 §1 의 "같은 사실을 두 번 말하지 않는다" 에
   * 걸린다. 카드가 하나인 등록 화면은 페이지 이름을 그대로 쓴다(#453 과 같음).
   */
  editFormTitle: '반려견 정보',

  // 빈 상태 / 오류
  emptyTitle: '등록된 반려견이 없어요',
  emptyDescription: '반려견을 등록해 맞춤 여행을 받아보세요.',
  notFoundTitle: '존재하지 않는 반려견이에요',
  notFoundDescription: '목록으로 돌아가 다시 선택해주세요.',
  loadFailedTitle: '정보를 불러오지 못했어요',
  loadFailedDescription: '잠시 후 다시 시도해주세요.',

  // 상한
  limitReached: '최대 5마리까지 등록할 수 있어요.',
  /**
   * `2/5마리`. 3층 표면으로 옮기며 **등록 버튼이 카드 머리로 올라가** 개수만 목록 위에
   * 남았다 — 버튼 옆에 붙어 있던 때와 달리 맨 숫자(`2 / 5`)로는 무엇의 개수인지 읽히지
   * 않는다. 저장한 곳의 `countOfMax` 와 같은 형식이다 (#464).
   */
  countOfMax: '{count}/{max}마리',

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
    /** 단위는 입력란 안에 서므로(#369) 라벨에서 뺀다 — 같은 말이 두 번 나온다 */
    weightKg: '체중',
    activityLevel: '활동량',
    sociality: '사회성',
    heatSensitive: '더위에 민감해요',
    coldSensitive: '추위에 민감해요',
    noiseSensitive: '소음에 민감해요',
    walkPreferred: '산책을 좋아해요',
  },

  /**
   * **'선택 입력' 이라고 적지 않는다.** 필수 필드에만 `*` 를 붙이고 있으므로 표시가
   * 없는 것이 곧 선택이다 — 같은 말을 두 번 하면 폼이 안내문으로 뒤덮인다.
   * hint 는 **입력 방법이나 쓰임새를 말할 때만** 남긴다.
   */
  hints: {
    birthYm: '숫자만 입력해도 2017-05 형식으로 맞춰져요',
    /** 값이 어디에 쓰이는지 말한다 — 그래야 모르면 비워도 되는 것이 전달된다 */
    weightKg: '입장 체중 제한이 있는 곳을 걸러 줄 때 써요. 적으면 크기가 저절로 맞춰져요',
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
  /**
   * 체중과 크기가 어긋날 때 (#369). **백엔드 `PET_004` 의 복제본이다** — 같은 경계를
   * 말해야 사용자가 두 문장을 다른 규칙으로 읽지 않는다.
   *
   * **문구를 그대로 베끼지는 않았다.** 서버 문장은 *"…기준으로 선택해 주세요"* 로 끝나는데,
   * 이 화면에서는 체중을 고치면 크기가 저절로 따라오므로 고를 것이 남아 있지 않다.
   * 여기서는 **무엇이 어긋났는지**만 말한다.
   */
  weightSizeMismatch:
    '체중과 크기 구분이 맞지 않아요. 소형견 10kg 미만 · 중형견 10kg 이상 25kg 미만 · 대형견 25kg 이상이에요.',
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
  /**
   * 단위. `weightLabel` 옆에 붙는 표시용이고, **#369 부터 등록·수정 폼의 입력란 안
   * 오른쪽에도 이 값이 선다** (`Input` 의 `suffix`). 값에는 들어가지 않는다.
   */
  weightUnit: 'kg',
  /**
   * **모르면 비워도 된다는 것을 먼저 말한다.** 크기 구분(소형/중형/대형)이 이미 필수라
   * 체중까지 필수처럼 보이면 모르는 사람이 대충 적는다 — 그 값이 장소 필터 판정에
   * 그대로 쓰인다.
   */
  weightHelp: '모르면 비워 두세요. 입장 체중 제한이 있는 곳을 걸러 줄 때 써요.',

  /**
   * 사진·대표 카드의 제목·부제 (#464). 3층 표면으로 옮기며 이 블록이 **자기 카드**가
   * 됐고, 카드 판정 ①("자기 제목이 있는가")을 만족시킬 이름이 필요해졌다.
   *
   * 부제가 말하는 것이 이 카드를 폼과 가르는 이유 그대로다 — 사진·대표는
   * `PetSaveRequest` 밖의 전용 엔드포인트라 **저장 버튼과 생명주기가 다르다.**
   * 한 카드로 묶으면 "저장을 안 눌렀는데 왜 바뀌었나" 가 된다.
   *
   * 제목의 `대표 반려견` 은 본문 문구(`대표 반려견이에요` · `대표로 지정`)와 같은 명사다 —
   * 한 화면에서 같은 것을 `대표 지정` / `대표 반려견` 으로 나눠 부르지 않는다.
   */
  photoSectionTitle: '사진과 대표 반려견',
  /**
   * **사실만 말한다.** 초안은 `여기서 바꾼 것은 저장 버튼과 상관없이 바로 반영돼요.` 였는데
   * 그 `저장하기` 는 **다음 카드 맨 아래**라 이 문장을 읽는 시점에 390 에서 화면 밖이다 —
   * 아직 보지 못한 컨트롤을 기준으로 부정형으로 말하게 된다.
   */
  photoSectionDescription: '사진과 대표는 바꾸는 즉시 반영돼요.',

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
