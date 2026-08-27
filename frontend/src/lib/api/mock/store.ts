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
  }
}

export function mockStore(): MockStore {
  const scope = globalThis as GlobalWithStore
  scope[STORE_KEY] ??= createStore()
  return scope[STORE_KEY]
}

/** 테스트에서 상태를 초기화한다 */
export function resetMockStore(): void {
  ;(globalThis as GlobalWithStore)[STORE_KEY] = createStore()
}
