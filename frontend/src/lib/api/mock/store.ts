/**
 * mock 전용 in-memory 상태 (개발 서버 프로세스 한정).
 *
 * **모듈 스코프 변수가 아니라 globalThis 에 심는다.** Next dev 는 HMR 로 모듈을
 * 다시 평가해 상태를 날려버린다. 로그인해 둔 세션이 저장 한 번에 사라지면
 * 개발이 성립하지 않는다.
 *
 * 프로덕션 빌드에서는 `isMockEnabled()` 가 항상 false 라 이 상태에 도달하지 않는다.
 */
import type { SignupConsent } from '@/lib/auth/signup-consent'

export type MockMember = {
  memberId: string
  email: string
  /**
   * **`null` 이면 비밀번호가 없는 계정이다** (소셜 전용). `hasPassword` 를 따로 들지
   * 않는 이유는 두 값이 어긋날 수 있어서다 — 최초 설정으로 비밀번호가 생기면
   * `hasPassword` 도 같이 고쳐야 하는데, 한 곳만 고치면 mock 이 실제로는 불가능한
   * 상태를 낸다. 응답의 `hasPassword` 는 이 필드에서 파생시킨다.
   */
  password: string | null
  name: string
  nickname: string
  profileImageUrl: string | null
  /** 소셜 로그인 제공자. 일반 계정이면 null — `'KAKAO'` 등 원문 문자열이다 */
  provider: string | null
}

/**
 * 저장된 반려견. 응답 DTO(`PetResponse`)가 아니라 **저장 형태**다 —
 * enum 은 code 만 들고 있고, 응답을 만들 때 metadata 객체로 부풀린다.
 * `age` 도 저장하지 않는다. 백엔드가 `birthYm` 으로 계산하는 파생값이다.
 */
export type MockPet = {
  petId: string
  memberId: string
  name: string
  breed: string | null
  birthYm: string | null
  sizeType: string
  /** 선택 입력. `null` 은 "모름" 이다 */
  weightKg: number | null
  heatSensitive: boolean
  coldSensitive: boolean
  noiseSensitive: boolean
  activityLevel: string
  walkPreferred: boolean
  sociality: string
  /** MinIO 오브젝트 키가 아니라 응답에 실리는 URL 이다 */
  profileImageUrl: string | null
  /** **회원당 하나만 참이다** — 지정하면 기존 대표가 자동 해제된다 */
  representative: boolean
  /** 백엔드가 소프트 삭제다 — 삭제 후에도 행이 남는다 */
  deleted: boolean
}

/**
 * 저장된 일정 항목. `itemType` 은 code 만 들고 있고 응답을 만들 때 metadata 로 부풀린다.
 *
 * **`day` 가 일정의 `totalDays` 를 넘을 수 있다.** 백엔드가 기간을 줄여도 항목을
 * 정리하지 않아 고아 항목이 실제로 생긴다 (`PlanCommandProcessor.updatePlan`) —
 * mock 도 그 상태를 재현해야 화면의 "여행 기간 밖 항목" 경로가 검증된다.
 *
 * **`targetId` 는 문자열이다.** 서버는 `Long` 이지만 Snowflake 라 `Number` 로 다루면
 * 정밀도를 잃는다 (`nextMemberId` 와 같은 이유).
 */
export type MockPlanItem = {
  planItemId: string
  /** 1부터 */
  day: number
  sequence: number
  /** `PLACE` / `MEAL` / `LODGING` / `WALK` / `MOVE` */
  itemType: string
  /** `WALK` 는 walk_course.id, `MOVE` 는 null. 장소가 아닌 값이 섞인다 */
  targetId: string | null
  title: string
  memo: string | null
  /** `HH:mm:ss` */
  startTime: string | null
  /**
   * 방문 체크 (#124). **일괄 교체로 만들어진 항목은 항상 `false` 다** — 백엔드가 새
   * 항목을 발급하므로 그 날의 체크가 초기화된다 (`PlanItemEntity.visited` 기본값).
   */
  visited: boolean
}

/**
 * 저장된 일정. 응답 DTO 가 아니라 **저장 형태**다 — `status` 는 code 만 들고 있고
 * 응답을 만들 때 metadata 객체로 부풀린다 (`MockPet` 과 같은 규칙).
 */
export type MockPlan = {
  planId: string
  memberId: string
  /** 대표 반려견 = `petIds[0]`. **저장 형태에도 둘 다 있다** — 백엔드가 `plan.pet_id` 컬럼을
   * 남기고 목록만 `plan_pet` 조인 테이블에 뒀기 때문이다 (#152 설계 판단 1) */
  petId: string
  /**
   * 동행 반려견 (#152). **비어 있지 않다** — 서버는 `plan_pet` 행이 없는 옛 일정을
   * `Plan.resolvePetIds()` 로 `[petId]` 로 읽는다. mock 은 저장 시점에 채워 그 규칙을
   * 재현할 필요가 없게 한다.
   */
  petIds: string[]
  areaCode: string
  sigunguCode: string | null
  title: string
  startDate: string
  endDate: string
  budget: number | null
  status: string
  /**
   * 일정 항목. **`POST /plans` 가 `items` 를 함께 받는다** — AI 초안 담기가 이 경로로
   * 항목을 실어 보낸다 (ai-plan 명세 S5). 직접 만들기는 보내지 않아 빈 배열이다.
   */
  items: MockPlanItem[]
  /**
   * 저장된 여행 준비물 (#586). **AI 결과와 사용자 항목이 한 배열에 섞여 있다** —
   * 백엔드도 한 테이블이고 `source` 로만 갈린다. 재생성이 `AI` 만 교체한다.
   */
  packingItems: MockPackingItem[]
  /**
   * AI 항목이 마지막으로 저장된 시각. **AI 항목이 하나도 없으면 null 이다** —
   * 화면이 "아직 만든 적 없다" 와 "만든 뒤 전부 지웠다" 를 이 값으로 가른다.
   */
  packingGeneratedAt: string | null
  /**
   * 여행 후기 (#614). **일정당 하나**라 배열이 아니다. 없으면 null.
   *
   * 장소 평가는 스냅샷이라 일정 항목이 사라져도 후기 행은 남는다.
   */
  review: MockPlanReview | null
  deleted: boolean
}

/** 일정 후기 하나. 응답 DTO 가 아니라 **저장 형태**다 */
export type MockPlanReview = {
  reviewId: string
  overallRating: number
  body: string | null
  items: MockPlanReviewItem[]
  createdAt: string
  updatedAt: string
}

export type MockPlanReviewItem = {
  reviewItemId: string
  planItemId: string
  placeId: string | null
  title: string
  rating: number
  comment: string | null
}

/** 준비물 항목 하나. `source` 는 `AI` / `USER` 다 */
export type MockPackingItem = {
  packingItemId: string
  category: string
  name: string
  /** 사용자 항목은 null — 서버가 `POST` 에서 `reason` 을 받지 않는다 */
  reason: string | null
  source: 'AI' | 'USER'
  checked: boolean
}

/**
 * 저장된 AI 일정 생성 작업.
 *
 * **`status` 는 code 만 들고 있다** — 응답을 만들 때 metadata 객체로 부풀린다
 * (`MockPet`·`MockPlan` 과 같은 규칙).
 *
 * `pollCount` 는 조회 횟수다. mock 에 백그라운드 워커가 없으므로 **조회할 때마다
 * 상태를 한 칸 진행시켜** PENDING → RUNNING → COMPLETED 전이를 재현한다.
 */
export type MockAiPlanJob = {
  jobId: string
  memberId: string
  /**
   * 시나리오. `normal` 완료 · `failed` 실패 · `partial` 일수 부족 ·
   * **`delisted` 는 사라진 장소를 섞어 담기를 `PLAN_004` 로 막는다.**
   */
  scenario: 'normal' | 'failed' | 'partial' | 'delisted'
  /** 동반 반려견. **`petIds` 가 `petId` 를 이긴다** — 서버 `effectivePetIds()` (#128) */
  petIds: string[]
  areaCode: string
  /**
   * 좁힌 시군구 (#251). `null` 이면 지역 전체다.
   *
   * **멱등 술어가 이것을 본다** — 실제 멱등 키는 `toParams` 해시이고 그 map 에
   * `sigunguCode` 가 들어 있다. 빼면 "제주 전체" 로 만들던 작업이 진행 중일 때
   * "제주시만" 제출이 그 작업을 그대로 되받는다.
   */
  sigunguCode: string | null
  startDate: string
  endDate: string
  budget: number | null
  requestNote: string | null
  pollCount: number
  /**
   * 그만두기로 종결됐는가 (#250). **`pollCount` 와 독립이다** — 취소는 진행 상태를 덮는다.
   *
   * 멱등 술어도 이것을 본다: 취소는 **멱등 키를 함께 풀어 주므로**(백엔드 판단) 취소된
   * 작업이 진행 중으로 남으면 "같은 조건으로 다시 만들기" 가 취소한 잡을 되받는다.
   */
  canceled: boolean
  /**
   * 취소 시점에 밟고 있던 단계 코드. 대기 중(`PENDING`)에 취소했으면 null 이다.
   *
   * **종결 상태에서도 마지막 단계가 남는다**는 계약을 mock 이 지키는 자리다.
   */
  canceledAtStep: string | null
  /**
   * 하루 재생성 대상 일정 (#128). 새 일정 생성이면 `null` 이다.
   *
   * **멱등 술어가 이것을 본다.** 실제 멱등 키는 `toParams` 해시이고 그 map 에 `planId`
   * 가 들어 있다 (`AiPlanJobProcessor:167-179`) — 들지 않으면 같은 기간의 새 일정 생성이
   * 진행 중일 때 재생성 제출이 그 작업을 되받는다.
   */
  regeneratePlanId: string | null
  /**
   * 하루 재생성 대상 일차 (#128). 새 일정 생성이면 `null` 이다.
   *
   * **초안은 재생성이어도 전체 일정을 담는다** — 서버 프롬프트가 그렇게 지시한다
   * (`AiPlanPromptFactory#appendRegenerateSection`). 이 값은 *어느 날을 다르게 낼지*
   * 를 가리킬 뿐 초안의 범위를 좁히지 않는다. mock 이 전체를 주어야 FE 의
   * "목표 일자만 뽑는다" 판단(하루재생성-세부명세 R4)이 로컬에서 검증된다.
   */
  regenerateDay: number | null
}

/**
 * 발급된 비밀번호 재설정 코드.
 *
 * **시도 횟수를 함께 든다.** 백엔드가 5회 실패에서 코드를 무효화하고 `AUTH_017` 로
 * 응답하는데(`AuthErrorCode`), 횟수를 세지 않으면 그 분기를 화면으로 확인할 수 없다.
 * 회원가입 인증코드(`pendingEmails`)와 **자료구조가 다른 이유**가 이것이다 — 그쪽은
 * 실패 상한이 없어 Set 으로 충분하다.
 */
export type MockPasswordResetCode = {
  code: string
  /** 불일치로 실패한 횟수. MAX 에 도달하면 코드가 사라진다 */
  attempts: number
}

/**
 * 저장된 즐겨찾기. 응답 DTO 가 아니라 **저장 형태**다 — 장소 요약(제목·주소 등)은 들고
 * 있지 않고, 응답을 만들 때 `MOCK_PLACES` 에서 찾아 붙인다. 백엔드도 tour-service 조회로
 * 붙이므로(`FavoritePlaceLookupPort`) 요약을 복제해 두면 두 곳이 어긋난다.
 */
export type MockFavorite = {
  favoriteId: string
  memberId: string
  placeId: string
}

export type MockStore = {
  members: MockMember[]
  /** 인증을 마친 이메일 (백엔드는 30분 TTL — mock 은 만료를 흉내 내지 않는다) */
  verifiedEmails: Set<string>
  /** 코드를 발송한 이메일 */
  pendingEmails: Set<string>
  /** 비밀번호 재설정 코드. email → 코드·시도 횟수 */
  passwordResetCodes: Map<string, MockPasswordResetCode>
  /**
   * 발급했지만 아직 쓰지 않은 OAuth state. 키는 `` `${provider}:${state}` `` 다 —
   * 백엔드도 state 를 키로 provider 를 값으로 저장하고 둘이 맞는지 대조한다.
   *
   * **값이 가입 동의다** (#688). 백엔드도 `/authorize` 에서 받은 동의를 state 와 함께
   * 보관했다가 콜백에서 꺼내 쓴다 (`RedisOAuthStateStoreAdapter`) — 인가코드가 1회용이라
   * 콜백에서 다시 받을 수 없기 때문이다. Set 으로 두면 mock 이 동의를 잊어버려
   * 미동의 최초 연동이 로컬에서만 통과한다.
   *
   * **교환에 성공하든 실패하든 조회 시점에 소비한다** (Redis `GETDEL` —
   * `RedisOAuthStateStoreAdapter.consume`). 그래서 같은 콜백 URL 을 두 번 태우면
   * 두 번째는 `AUTH_010` 이다 — **화면의 중복 실행 가드를 확인할 수 있는 성질이 이것이다.**
   * 10분 TTL 은 흉내 내지 않는다 (mock 에 시계를 두면 테스트가 시간에 묶인다).
   */
  oauthStates: Map<string, SignupConsent>
  /** OAuth code·state 조립용 순번 */
  nextOAuthSeq: number
  /** memberId 조립용 순번. Number.MAX_SAFE_INTEGER 안쪽 값만 들고 있는다 — nextMemberId() 참고 */
  nextMemberSeq: number
  pets: MockPet[]
  /** petId 조립용 순번. memberId 와 같은 이유로 Number 로 다루지 않는다 */
  nextPetSeq: number
  plans: MockPlan[]
  /** planId 조립용 순번. 위와 같은 이유 */
  nextPlanSeq: number
  /** planItemId 조립용 순번 */
  nextPlanItemSeq: number
  nextPackingItemSeq: number
  /** reviewId 조립용 순번 */
  nextReviewSeq: number
  /** reviewItemId 조립용 순번 */
  nextReviewItemSeq: number
  /** AI 일정 생성 작업. jobId 는 UUID 라 Snowflake 조립 규칙을 쓰지 않는다 */
  aiPlanJobs: MockAiPlanJob[]
  /** jobId 조립용 순번 */
  nextAiPlanJobSeq: number
  /**
   * 저장한 장소. **배열 순서가 저장 순서다** — 목록은 이것을 뒤집어 최근 저장순으로 낸다.
   * 시각을 들지 않는 이유는 mock 에 시계를 두면 테스트가 시간에 묶여서다.
   */
  favorites: MockFavorite[]
  /** favoriteId 조립용 순번 */
  nextFavoriteSeq: number
}

const STORE_KEY = Symbol.for('hondigagae.mock.store')

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: MockStore }

/** 고정 회원(데모 계정)과 같은 자리수로 맞춘 접두사. 순번은 뒤 6자리에 zero-pad 로 채운다 */
const MEMBER_ID_PREFIX = '900000000000'
const MEMBER_ID_SEQ_DIGITS = 6

/**
 * memberId 를 문자열로 안전하게 조립한다.
 *
 * **`Number` 로 다루면 안 된다.** `900000000000000002` 는 `Number.MAX_SAFE_INTEGER`
 * (9007199254740991) 를 훨씬 넘어 파싱 시점에 `900000000000000000` 으로 반올림되고,
 * 그 뒤로 `++` 를 아무리 해도 값이 바뀌지 않는다 — 회원가입을 두 번 이상 성공시키면
 * 모든 신규 회원이 같은 memberId 를 받는다. 순번(seq)만 안전한 정수 범위에서 늘리고,
 * id 자체는 접두사 + zero-pad 문자열 결합으로 만든다.
 */
export function nextMemberId(store: MockStore): string {
  const id = `${MEMBER_ID_PREFIX}${String(store.nextMemberSeq).padStart(MEMBER_ID_SEQ_DIGITS, '0')}`
  store.nextMemberSeq += 1
  return id
}

/** 백엔드 petId 는 Snowflake 다. memberId 와 같은 이유로 문자열 조립으로 만든다 */
const PET_ID_PREFIX = '123456789012'
const PET_ID_SEQ_DIGITS = 6

export function nextPetId(store: MockStore): string {
  const id = `${PET_ID_PREFIX}${String(store.nextPetSeq).padStart(PET_ID_SEQ_DIGITS, '0')}`
  store.nextPetSeq += 1
  return id
}

/**
 * planId. **커서가 `id DESC` 라 순번이 클수록 최근이다** — 백엔드와 같은 성질이어야
 * mock 에서만 페이지 순서가 뒤집히지 않는다.
 */
const PLAN_ID_PREFIX = '223456789012'
const PLAN_ID_SEQ_DIGITS = 6

export function nextPlanId(store: MockStore): string {
  const id = `${PLAN_ID_PREFIX}${String(store.nextPlanSeq).padStart(PLAN_ID_SEQ_DIGITS, '0')}`
  store.nextPlanSeq += 1
  return id
}

/** planItemId. 저장 때마다 새로 발급된다 — 백엔드가 일괄 교체에서 그렇게 한다 */
const PLAN_ITEM_ID_PREFIX = '323456789012'
const PLAN_ITEM_ID_SEQ_DIGITS = 6

export function nextPlanItemId(store: MockStore): string {
  const id = `${PLAN_ITEM_ID_PREFIX}${String(store.nextPlanItemSeq).padStart(PLAN_ITEM_ID_SEQ_DIGITS, '0')}`
  store.nextPlanItemSeq += 1
  return id
}

/** packingItemId. 발급 규칙은 `planItemId` 와 같다 — 같은 서비스의 Snowflake 다 */
const PACKING_ITEM_ID_PREFIX = '423456789012'
const PACKING_ITEM_ID_SEQ_DIGITS = 6

export function nextPackingItemId(store: MockStore): string {
  const id = `${PACKING_ITEM_ID_PREFIX}${String(store.nextPackingItemSeq).padStart(PACKING_ITEM_ID_SEQ_DIGITS, '0')}`
  store.nextPackingItemSeq += 1
  return id
}

/** reviewId. 발급 규칙은 `planItemId` 와 같다 — 같은 서비스의 Snowflake 다 */
const REVIEW_ID_PREFIX = '523456789012'
const REVIEW_ID_SEQ_DIGITS = 6

export function nextReviewId(store: MockStore): string {
  const id = `${REVIEW_ID_PREFIX}${String(store.nextReviewSeq).padStart(REVIEW_ID_SEQ_DIGITS, '0')}`
  store.nextReviewSeq += 1
  return id
}

const REVIEW_ITEM_ID_PREFIX = '623456789012'
const REVIEW_ITEM_ID_SEQ_DIGITS = 6

export function nextReviewItemId(store: MockStore): string {
  const id = `${REVIEW_ITEM_ID_PREFIX}${String(store.nextReviewItemSeq).padStart(REVIEW_ITEM_ID_SEQ_DIGITS, '0')}`
  store.nextReviewItemSeq += 1
  return id
}

/**
 * 항목 fixture 의 장소 id. `MOCK_PLACES` 와 **같은 기준값에서 파생**시킨다 —
 * 값을 따로 적으면 place fixture 가 바뀔 때 조용히 어긋나 보강이 전부 404 가 된다.
 */
const PLACE_ID_BASE = 212481712381923328n
const placeId = (ordinal: number) => String(PLACE_ID_BASE + BigInt(ordinal))

/**
 * jobId. **백엔드는 UUID 를 쓴다**(`AiPlanSubmitResponse` 예시) — Snowflake 가 아니라
 * 정밀도 문제가 없고, 경로 변수도 `@PathVariable String` 이다. 순번을 붙여 예측 가능하게
 * 만들어 두면 개발 중 같은 작업을 다시 열기 쉽다.
 */
export function nextAiPlanJobId(store: MockStore): string {
  const id = `8a64f9c0-2f1e-4c1a-9c3e-${String(store.nextAiPlanJobSeq).padStart(12, '0')}`
  store.nextAiPlanJobSeq += 1
  return id
}

/** 백엔드 favoriteId 는 Snowflake 다. 다른 id 와 같은 이유로 문자열 조립으로 만든다 */
const FAVORITE_ID_PREFIX = '345678901234'
const FAVORITE_ID_SEQ_DIGITS = 6

export function nextFavoriteId(store: MockStore): string {
  const id = `${FAVORITE_ID_PREFIX}${String(store.nextFavoriteSeq).padStart(FAVORITE_ID_SEQ_DIGITS, '0')}`
  store.nextFavoriteSeq += 1
  return id
}

function createStore(): MockStore {
  return {
    /*
      **계정 상태 3종을 모두 낼 수 있어야 한다** (마이페이지-세부명세 D7). 그러지 않으면
      `/mypage/password` 의 분기(공통명세 S2)를 화면으로 확인할 방법이 없다.
      로그인해서 상태를 바꾸는 것이 아니라 **계정을 갈아타서** 확인한다 — 비밀번호가
      없는 계정은 이메일 로그인이 불가능하므로 소셜 전용 계정은 아래 `provider` 만
      다르고 password 는 있는 `linked` 계정과 짝을 이룬다.

      `(provider: null, password: null)` = 판별 불가 조합은 **fixture 로 만들지 않는다.**
      서버 결함일 때만 나오는 상태라, 있으면 mock 이 불가능한 계정을 정상인 것처럼
      제공하게 된다. 그 분기는 렌더 테스트가 직접 값을 넣어 확인한다.
    */
    members: [
      {
        // 일반 계정 — provider null + 비밀번호 있음
        memberId: '900000000000000001',
        email: 'demo@hondigagae.dev',
        password: 'password123!',
        name: '김제주',
        nickname: '제주댕댕',
        profileImageUrl: null,
        provider: null,
      },
      {
        // 연결됨 — 소셜 + 비밀번호. 변경과 소셜 전용 전환이 둘 다 보인다
        memberId: '900000000000000002',
        email: 'linked@hondigagae.dev',
        password: 'password123!',
        name: '이연결',
        nickname: '연결이',
        profileImageUrl: null,
        provider: 'KAKAO',
      },
      {
        /*
          소셜 전용 — 비밀번호가 없다.

          **지금은 브라우저로 이 계정에 로그인할 수 없다.** 이메일 로그인은 비밀번호가
          있어야 하고, 소셜 로그인 mock(`GET /auth/{provider}/login`)은 아직 없다 —
          그것은 이슈 #85(소셜 로그인 콜백)의 범위라 여기서 만들면 그 브랜치와 충돌한다.
          `linked@` 로 로그인해 비밀번호를 없애는 경로도 **서버가 세션을 끊어서**
          그 화면에 머물 수 없다 (그게 맞는 계약이다).

          그래서 `social-only` 분기는 지금 mock 단위 테스트(`member-mock.test.ts`)와
          렌더 테스트(`my-page.test.ts` · `password-form.test.ts`)로만 확인된다.
          **#85 가 소셜 로그인 mock 을 올리면 이 계정으로 화면을 직접 볼 수 있다.**
          그때까지 이 fixture 는 응답 모양의 정본 역할만 한다.
        */
        memberId: '900000000000000003',
        email: 'social@hondigagae.dev',
        password: null,
        name: '박소셜',
        nickname: '소셜이',
        profileImageUrl: null,
        provider: 'KAKAO',
      },
    ],
    verifiedEmails: new Set<string>(),
    pendingEmails: new Set<string>(),
    passwordResetCodes: new Map<string, MockPasswordResetCode>(),
    oauthStates: new Map<string, SignupConsent>(),
    nextOAuthSeq: 1,
    nextMemberSeq: 4,
    pets: [
      {
        petId: '123456789012000001',
        memberId: '900000000000000001',
        name: '몽실이',
        breed: '말티즈',
        birthYm: '2017-05',
        sizeType: 'SMALL',
        weightKg: 3.5,
        heatSensitive: true,
        coldSensitive: false,
        noiseSensitive: true,
        activityLevel: 'MEDIUM',
        walkPreferred: true,
        sociality: 'HIGH',
        profileImageUrl: null,
        // 대표는 회원당 하나다 — 이 회원은 몽실이가 대표다
        representative: true,
        deleted: false,
      },
      {
        // breed / birthYm 이 없는 경우 — 카드에서 숨김 분기를 확인할 수 있어야 한다
        petId: '123456789012000002',
        memberId: '900000000000000001',
        name: '초코',
        breed: null,
        birthYm: null,
        sizeType: 'LARGE',
        // 체중을 모르는 아이 — 필터가 이 아이를 기준으로는 좁히지 않아야 한다
        weightKg: null,
        heatSensitive: false,
        coldSensitive: true,
        noiseSensitive: false,
        activityLevel: 'HIGH',
        walkPreferred: true,
        sociality: 'LOW',
        profileImageUrl: null,
        representative: false,
        deleted: false,
      },
      {
        // 다른 회원의 반려견 — 조회하면 404 여야 한다 (403 이 아니다)
        petId: '123456789012000099',
        memberId: '900000000000000777',
        name: '남의개',
        breed: null,
        birthYm: null,
        sizeType: 'MEDIUM',
        weightKg: 14,
        heatSensitive: false,
        coldSensitive: false,
        noiseSensitive: false,
        activityLevel: 'LOW',
        walkPreferred: false,
        sociality: 'MEDIUM',
        profileImageUrl: null,
        representative: true,
        deleted: false,
      },
    ],
    nextPetSeq: 3,
    /*
      아트보드 `혼디가개 여행 일정` 04·05 의 일정 4건.
      상태 3종과 다가오는/지난 분리를 둘 다 확인할 수 있게 짰다.

      **`COMPLETED` 를 날짜가 지난 것에만 붙이지 않았다.** 아래 `애월 하루` 는 지났지만
      `CONFIRMED` 로 남겨 뒀다 — 서버에 자동 전이가 없어 실제로 흔한 상태이고,
      화면이 상태가 아니라 날짜로 나눈다는 것을 이 fixture 가 증명해야 한다 (공통명세 S4).
    */
    plans: [
      {
        planId: '223456789012000001',
        memberId: '900000000000000001',
        petId: '123456789012000001',
        /*
          **이 하나만 동행 2마리다** (#152). 나머지를 한 마리로 두는 이유는 두 모양이
          같이 있어야 화면이 `petIds.length === 1` 분기를 로컬에서 둘 다 볼 수 있어서다.

          초코(...002)가 몽실이보다 낮게 판정되도록 mock 을 짜 뒀다 — 그래야
          **기준 반려견(basisPetId)이 대표(petIds[0])와 다른 날**이 실제로 생긴다.
        */
        petIds: ['123456789012000001', '123456789012000002'],
        areaCode: '39',
        sigunguCode: '4',
        title: '몽실이와 제주 2박 3일',
        startDate: '2026-09-12',
        endDate: '2026-09-14',
        budget: 400000,
        status: 'DRAFT',
        packingItems: [],
        packingGeneratedAt: null,
        review: null,
        deleted: false,
        /*
          3일 일정. **거리 규칙 4종을 한 fixture 에서 전부 드러낸다.**
           - 1일차 첫 항목: 숙소가 앞에 없다 → 거리 문구 없음
           - 1일차 2번째: 직전 항목 기준
           - 2일차 첫 항목: 1일차 숙소 기준, **45km 라 긴 이동 경고**
           - 2일차 WALK: targetId 가 walk_course.id 라 /places 를 부르면 안 된다
           - 2일차 마지막: **MOCK_PLACES 에 없는 targetId** — 원천에서 사라진(delisted)
             장소다. 상세 응답의 `place` 가 null 로 오는 갈래(#86·#115)와, 그 일자를
             저장하면 PLAN_004 로 막히는 편집모드 안내(E1)를 로컬에서 볼 수 있다
           - 3일차: 항목 0개 (빈 일자 안내)
           - **1일차 앞 두 항목은 `visited: true`** (#124) — 체크된 행의 모양과, 그 일자에
             초기화 경고가 뜨는 조건(체크된 항목이 있을 때만)을 로컬에서 볼 수 있다
        */
        items: [
          {
            planItemId: '323456789012000001',
            day: 1,
            sequence: 0,
            itemType: 'PLACE',
            targetId: placeId(0),
            title: '제주특별자치도립김창열미술관',
            memo: '실내라 비가 와도 괜찮아요',
            startTime: '10:00:00',
            visited: true,
          },
          {
            planItemId: '323456789012000002',
            day: 1,
            sequence: 1,
            itemType: 'MEAL',
            targetId: placeId(6),
            title: '동문재래시장',
            memo: null,
            startTime: '12:30:00',
            visited: true,
          },
          {
            planItemId: '323456789012000003',
            day: 1,
            sequence: 2,
            itemType: 'LODGING',
            targetId: placeId(3),
            title: '애월 반려견 동반 독채 펜션 하나로',
            memo: null,
            startTime: '17:00:00',
            visited: false,
          },
          {
            planItemId: '323456789012000004',
            day: 2,
            sequence: 0,
            itemType: 'PLACE',
            targetId: placeId(1),
            title: '가세오름',
            memo: null,
            startTime: null,
            visited: false,
          },
          {
            planItemId: '323456789012000005',
            day: 2,
            sequence: 1,
            itemType: 'PLACE',
            targetId: placeId(2),
            title: '오설록 티뮤지엄 카페',
            memo: null,
            startTime: null,
            visited: false,
          },
          {
            // WALK 는 walk_course.id 다. 장소를 가리키지 않아 place 가 null 이다
            planItemId: '323456789012000006',
            day: 2,
            sequence: 2,
            itemType: 'WALK',
            targetId: '777777777777000001',
            title: '오설록 주변 산책',
            memo: null,
            startTime: null,
            visited: false,
          },
          {
            /*
              **원천에서 사라진 장소다.** `MOCK_PLACES` 에 없는 id 라 상세 응답의
              `place` 가 null 로 오고, 그 일자를 저장하면 `PLAN_004` 로 막힌다 —
              담을 때는 있었지만 그 뒤 delisting 된 항목이 실제로 이 모양이다.
            */
            planItemId: '323456789012000011',
            day: 2,
            sequence: 3,
            itemType: 'PLACE',
            targetId: '212481712381923399',
            title: '사라진 전시관',
            memo: null,
            startTime: null,
            visited: false,
          },
        ],
      },
      {
        planId: '223456789012000002',
        memberId: '900000000000000001',
        petId: '123456789012000002',
        petIds: ['123456789012000002'],
        areaCode: '39',
        sigunguCode: '3',
        title: '초코와 가을 서귀포',
        startDate: '2026-10-03',
        endDate: '2026-10-04',
        budget: null,
        status: 'CONFIRMED',
        packingItems: [],
        packingGeneratedAt: null,
        review: null,
        deleted: false,
        /*
          2일 일정인데 **3일차 항목이 남아 있다.** 기간을 줄여도 서버가 항목을 정리하지
          않아 실제로 생기는 상태다 — 화면의 "여행 기간 밖 항목" 경로를 여기서 확인한다.
        */
        items: [
          {
            planItemId: '323456789012000007',
            day: 1,
            sequence: 0,
            itemType: 'PLACE',
            targetId: placeId(4),
            title: '함덕 서우봉 해변',
            memo: null,
            startTime: null,
            visited: false,
          },
          {
            planItemId: '323456789012000008',
            day: 1,
            sequence: 1,
            itemType: 'MEAL',
            targetId: placeId(6),
            title: '동문재래시장',
            memo: null,
            startTime: null,
            visited: false,
          },
          {
            planItemId: '323456789012000009',
            day: 2,
            sequence: 0,
            itemType: 'PLACE',
            targetId: placeId(7),
            title: '제주현대미술관',
            memo: null,
            startTime: null,
            visited: false,
          },
          {
            planItemId: '323456789012000010',
            day: 3,
            sequence: 0,
            itemType: 'PLACE',
            targetId: placeId(5),
            title: '제주 곶자왈 반려견 산책 트레킹 코스',
            memo: null,
            startTime: null,
            visited: false,
          },
        ],
      },
      {
        planId: '223456789012000003',
        memberId: '900000000000000001',
        petId: '123456789012000001',
        petIds: ['123456789012000001'],
        areaCode: '39',
        sigunguCode: '4',
        title: '몽실이 첫 제주',
        startDate: '2026-05-02',
        endDate: '2026-05-04',
        budget: 250000,
        status: 'COMPLETED',
        /*
          **다녀온 장소 두 곳**을 심는다. 후기 작성 폼의 장소 평가는
          `visited && PLACE/MEAL/LODGING` 만 보여 주므로, 빈 항목이면 전체 만족도만
          남기는 갈래만 로컬에서 보게 된다.
        */
        items: [
          {
            planItemId: '323456789012000020',
            day: 1,
            sequence: 0,
            itemType: 'PLACE',
            targetId: placeId(0),
            title: '제주특별자치도립김창열미술관',
            memo: null,
            startTime: '10:00:00',
            visited: true,
          },
          {
            planItemId: '323456789012000021',
            day: 2,
            sequence: 0,
            itemType: 'MEAL',
            targetId: placeId(6),
            title: '동문재래시장',
            memo: null,
            startTime: '12:30:00',
            visited: true,
          },
        ],
        packingItems: [],
        packingGeneratedAt: null,
        review: null,
        deleted: false,
      },
      {
        planId: '223456789012000004',
        memberId: '900000000000000001',
        petId: '123456789012000001',
        petIds: ['123456789012000001'],
        areaCode: '39',
        sigunguCode: '4',
        title: '애월 하루',
        startDate: '2026-04-11',
        endDate: '2026-04-11',
        budget: null,
        status: 'CONFIRMED',
        items: [],
        packingItems: [],
        packingGeneratedAt: null,
        review: null,
        deleted: false,
      },
      {
        // 다른 회원의 일정 — 목록에 섞여 나오면 안 된다
        planId: '223456789012000099',
        memberId: '900000000000000777',
        petId: '123456789012000099',
        petIds: ['123456789012000099'],
        areaCode: '39',
        sigunguCode: null,
        title: '남의 일정',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        budget: null,
        status: 'DRAFT',
        items: [],
        packingItems: [],
        packingGeneratedAt: null,
        review: null,
        deleted: false,
      },
    ],
    nextPlanSeq: 5,
    // 항목 fixture 가 1~21 을 이미 쓴다. 1 로 두면 새로 담은 항목이 시드와 같은 id 를 받는다
    nextPlanItemSeq: 22,
    nextPackingItemSeq: 1,
    nextReviewSeq: 1,
    nextReviewItemSeq: 1,
    aiPlanJobs: [],
    nextAiPlanJobSeq: 1,
    /*
      **demo 계정에 3건을 심는다.** 장소 상세의 저장 아이콘이 **이미 저장된 상태**로 뜨는
      경로와, 저장한 장소 목록(`/favorites`, #127)이 채워진 상태를 함께 보기 위해서다 —
      빈 목록만 있으면 토글의 한쪽 방향밖에 볼 수 없다.

      **셋째는 `MOCK_PLACES` 에 없는 placeId 다.** 그래야 목록의 "요약 없는 행"
      (title 이 null 인 행을 감추지 않는다 — 명세 D5) 을 브라우저에서 실제로 볼 수 있다.
      이 경로는 tour-service 조회 실패를 흉내 내는 것이라 다른 방법으로는 재현이 어렵다.
    */
    favorites: [
      { favoriteId: '345678901234000001', memberId: '900000000000000001', placeId: placeId(1) },
      { favoriteId: '345678901234000002', memberId: '900000000000000001', placeId: placeId(4) },
      {
        favoriteId: '345678901234000003',
        memberId: '900000000000000001',
        placeId: '212481712381923999',
      },
    ],
    nextFavoriteSeq: 4,
  }
}

/**
 * 저장된 상태가 **지금 코드의 모양과 맞는지** 본다.
 *
 * globalThis 에 심어 둔 상태는 HMR 을 넘어 살아남는데(그것이 목적이다), 스토어에 필드를
 * 새로 추가하면 **먼저 만들어진 상태에는 그 필드가 없다.** 그대로 쓰면 `store.plans` 가
 * `undefined` 라 mock 이 500 을 던지고, 원인이 코드가 아니라 켜 둔 개발 서버에 있어서
 * 찾는 데 오래 걸린다 — 일정 목록(#75)을 붙이며 실제로 겪었다.
 *
 * 모양이 어긋나면 버리고 새로 만든다. **`?? []` 로 덮지 않는다** — 그러면 오래된 상태로
 * 계속 굴러가면서 증상만 사라진다.
 */
function isCurrentShape(store: MockStore | undefined): store is MockStore {
  return (
    store !== undefined &&
    Array.isArray(store.members) &&
    Array.isArray(store.pets) &&
    Array.isArray(store.plans) &&
    // 계정 상태 3종 fixture 가 들어오며 members 의 모양이 바뀌었다. 이 검사가 없으면
    // 켜 둔 개발 서버의 옛 상태가 그대로 굴러가 provider 가 undefined 로 읽힌다
    store.members.every((member) => 'provider' in member) &&
    // 일정 항목이 뒤에 추가됐다. HMR 로 살아남은 낡은 스토어는 버린다 (#59 와 같은 사고)
    store.plans.every((plan) => Array.isArray(plan.items) && 'review' in plan) &&
    typeof store.nextReviewSeq === 'number' &&
    // AI 작업 목록도 같은 이유로 본다
    Array.isArray(store.aiPlanJobs) &&
    // 비밀번호 재설정·소셜 로그인 상태가 뒤에 추가됐다 (#85). 낡은 스토어는 버린다 —
    // `?? new Map()` 으로 덮으면 옛 상태로 계속 굴러가며 증상만 사라진다
    store.passwordResetCodes instanceof Map &&
    // 동의를 함께 들면서 Set → Map 이 됐다 (#688). 낡은 스토어(Set)는 여기서 버려진다
    store.oauthStates instanceof Map &&
    // 즐겨찾기가 뒤에 추가됐다 (#118). 낡은 스토어는 버린다 — 위와 같은 이유다
    Array.isArray(store.favorites)
  )
}

export function mockStore(): MockStore {
  const scope = globalThis as GlobalWithStore
  if (!isCurrentShape(scope[STORE_KEY])) scope[STORE_KEY] = createStore()
  return scope[STORE_KEY]
}

/** 테스트에서 상태를 초기화한다 */
export function resetMockStore(): void {
  ;(globalThis as GlobalWithStore)[STORE_KEY] = createStore()
}

/**
 * access token 에서 memberId 를 꺼낸다.
 *
 * mock 이 발급하는 토큰은 `mock-access-{memberId}` 이고 재발급은 `-reissued` 가 붙는다
 * (`auth-data.ts`). 형식이 다르면 인증되지 않은 것으로 본다 — 게이트웨이의 401 과 같다.
 *
 * 보호 리소스 mock 이 여럿(반려견 · 일정)이라 여기 둔다.
 */
export function memberIdOf(accessToken: string | null): string | null {
  if (accessToken === null) return null

  const matched = /^mock-access-(\d+)(?:-reissued)?$/.exec(accessToken)
  return matched?.[1] ?? null
}
