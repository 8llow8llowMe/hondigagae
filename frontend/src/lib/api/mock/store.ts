/**
 * mock 전용 in-memory 상태 (개발 서버 프로세스 한정).
 *
 * **모듈 스코프 변수가 아니라 globalThis 에 심는다.** Next dev 는 HMR 로 모듈을
 * 다시 평가해 상태를 날려버린다. 로그인해 둔 세션이 저장 한 번에 사라지면
 * 개발이 성립하지 않는다.
 *
 * 프로덕션 빌드에서는 `isMockEnabled()` 가 항상 false 라 이 상태에 도달하지 않는다.
 */
export type MockMember = {
  memberId: string
  email: string
  password: string
  name: string
  nickname: string
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
  heatSensitive: boolean
  coldSensitive: boolean
  noiseSensitive: boolean
  activityLevel: string
  walkPreferred: boolean
  sociality: string
  /** 백엔드가 소프트 삭제다 — 삭제 후에도 행이 남는다 */
  deleted: boolean
}

/**
 * 저장된 일정. 응답 DTO 가 아니라 **저장 형태**다 — `status` 는 code 만 들고 있고
 * 응답을 만들 때 metadata 객체로 부풀린다 (`MockPet` 과 같은 규칙).
 */
export type MockPlan = {
  planId: string
  memberId: string
  petId: string
  areaCode: string
  sigunguCode: string | null
  title: string
  startDate: string
  endDate: string
  budget: number | null
  status: string
  deleted: boolean
}

export type MockStore = {
  members: MockMember[]
  /** 인증을 마친 이메일 (백엔드는 30분 TTL — mock 은 만료를 흉내 내지 않는다) */
  verifiedEmails: Set<string>
  /** 코드를 발송한 이메일 */
  pendingEmails: Set<string>
  /** memberId 조립용 순번. Number.MAX_SAFE_INTEGER 안쪽 값만 들고 있는다 — nextMemberId() 참고 */
  nextMemberSeq: number
  pets: MockPet[]
  /** petId 조립용 순번. memberId 와 같은 이유로 Number 로 다루지 않는다 */
  nextPetSeq: number
  plans: MockPlan[]
  /** planId 조립용 순번. 위와 같은 이유 */
  nextPlanSeq: number
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

function createStore(): MockStore {
  return {
    members: [
      {
        memberId: '900000000000000001',
        email: 'demo@hondigagae.dev',
        password: 'password123!',
        name: '김제주',
        nickname: '제주댕댕',
      },
    ],
    verifiedEmails: new Set<string>(),
    pendingEmails: new Set<string>(),
    nextMemberSeq: 2,
    pets: [
      {
        petId: '123456789012000001',
        memberId: '900000000000000001',
        name: '몽실이',
        breed: '말티즈',
        birthYm: '2017-05',
        sizeType: 'SMALL',
        heatSensitive: true,
        coldSensitive: false,
        noiseSensitive: true,
        activityLevel: 'MEDIUM',
        walkPreferred: true,
        sociality: 'HIGH',
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
        heatSensitive: false,
        coldSensitive: true,
        noiseSensitive: false,
        activityLevel: 'HIGH',
        walkPreferred: true,
        sociality: 'LOW',
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
        heatSensitive: false,
        coldSensitive: false,
        noiseSensitive: false,
        activityLevel: 'LOW',
        walkPreferred: false,
        sociality: 'MEDIUM',
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
        areaCode: '39',
        sigunguCode: '4',
        title: '몽실이와 제주 2박 3일',
        startDate: '2026-09-12',
        endDate: '2026-09-14',
        budget: 400000,
        status: 'DRAFT',
        deleted: false,
      },
      {
        planId: '223456789012000002',
        memberId: '900000000000000001',
        petId: '123456789012000002',
        areaCode: '39',
        sigunguCode: '3',
        title: '초코와 가을 서귀포',
        startDate: '2026-10-03',
        endDate: '2026-10-04',
        budget: null,
        status: 'CONFIRMED',
        deleted: false,
      },
      {
        planId: '223456789012000003',
        memberId: '900000000000000001',
        petId: '123456789012000001',
        areaCode: '39',
        sigunguCode: '4',
        title: '몽실이 첫 제주',
        startDate: '2026-05-02',
        endDate: '2026-05-04',
        budget: 250000,
        status: 'COMPLETED',
        deleted: false,
      },
      {
        planId: '223456789012000004',
        memberId: '900000000000000001',
        petId: '123456789012000001',
        areaCode: '39',
        sigunguCode: '4',
        title: '애월 하루',
        startDate: '2026-04-11',
        endDate: '2026-04-11',
        budget: null,
        status: 'CONFIRMED',
        deleted: false,
      },
      {
        // 다른 회원의 일정 — 목록에 섞여 나오면 안 된다
        planId: '223456789012000099',
        memberId: '900000000000000777',
        petId: '123456789012000099',
        areaCode: '39',
        sigunguCode: null,
        title: '남의 일정',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        budget: null,
        status: 'DRAFT',
        deleted: false,
      },
    ],
    nextPlanSeq: 5,
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
    Array.isArray(store.plans)
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
