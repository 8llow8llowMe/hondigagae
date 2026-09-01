import type { MockResult } from '@/lib/api/mock/auth-data'
import { memberIdOf, type MockPet, mockStore, nextPetId } from '@/lib/api/mock/store'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import type { ApiResponse } from '@/types/api'
import type { Pet, PetList } from '@/types/pet'

/**
 * 반려견 mock.
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다.** #24 최종 리뷰 I5 가 같은 실수를 잡았다 —
 * mock 이 스키마보다 엄격하면 FE 는 통과하는 입력이 mock 에서만 400 이 되어,
 * 같은 브랜치가 자기 판정을 부정한다.
 *
 * 근거: `PetWebController` · `PetSaveRequest` · `PetErrorCode` · `PetValidationMessage` ·
 * `PetCommandProcessor` · `PetQueryProcessor` 소스 실측. 계약 상세는
 * docs/features/pet/공통명세.md.
 */

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: unknown): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

/** Bean Validation 실패는 `{ message, errors: [...] }` 형태로 온다 — ValidationErrorSupport */
function failValidation(errors: { code: string; field: string; message: string }[]): MockResult {
  return fail(400, 'PET_100', {
    message: errors[0]?.message ?? '요청 값이 올바르지 않습니다.',
    errors,
  })
}

const SIZE_CODES: Record<string, { name: string; description: string }> = {
  SMALL: { name: '소형견', description: '체중 10kg 미만' },
  MEDIUM: { name: '중형견', description: '체중 10kg 이상 25kg 미만' },
  LARGE: { name: '대형견', description: '체중 25kg 이상' },
}

const LEVEL_CODES: Record<string, { activity: string; sociality: string; name: string }> = {
  LOW: {
    name: '낮음',
    activity: '짧은 산책을 선호하며 장시간 활동을 힘들어합니다.',
    sociality: '다른 개나 낯선 사람을 불편해합니다.',
  },
  MEDIUM: {
    name: '보통',
    activity: '일반적인 산책과 관광 일정을 소화합니다.',
    sociality: '상황에 따라 적응합니다.',
  },
  HIGH: {
    name: '높음',
    activity: '긴 산책과 활동적인 일정을 선호합니다.',
    sociality: '다른 개나 사람과 잘 어울립니다.',
  },
}

/** PetValidationMessage.BIRTH_YM_PATTERN 과 같은 정규식이어야 한다 */
const BIRTH_YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * 만 나이. 백엔드가 계산해 내려주는 파생값이라 mock 도 계산해야 한다.
 * `birthYm` 이 없으면 null 이다.
 *
 * `new Date()` 를 쓴다 — 이 파일은 mock 이고 실제 시각 기준이 맞다.
 */
function toAge(birthYm: string | null): number | null {
  if (birthYm === null) return null

  const [yearText, monthText] = birthYm.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null

  const now = new Date()
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month)
  return Math.max(0, Math.floor(months / 12))
}

function toPetResponse(pet: MockPet): Pet {
  const size = SIZE_CODES[pet.sizeType] ?? { name: pet.sizeType, description: '' }
  const activity = LEVEL_CODES[pet.activityLevel]
  const social = LEVEL_CODES[pet.sociality]

  return {
    petId: pet.petId,
    name: pet.name,
    breed: pet.breed,
    birthYm: pet.birthYm,
    age: toAge(pet.birthYm),
    sizeType: { code: pet.sizeType, name: size.name, description: size.description },
    weightKg: pet.weightKg,
    heatSensitive: pet.heatSensitive,
    coldSensitive: pet.coldSensitive,
    noiseSensitive: pet.noiseSensitive,
    activityLevel: {
      code: pet.activityLevel,
      name: activity?.name ?? pet.activityLevel,
      description: activity?.activity ?? '',
    },
    walkPreferred: pet.walkPreferred,
    sociality: {
      code: pet.sociality,
      name: social?.name ?? pet.sociality,
      description: social?.sociality ?? '',
    },
    profileImageUrl: pet.profileImageUrl,
    representative: pet.representative,
  }
}

/** 백엔드는 세 필수 enum 을 @NotNull 로 본다. code 목록 밖의 값은 애초에 역직렬화되지 않는다 */
function isKnown(record: Record<string, unknown>, key: string, allowed: string[]): boolean {
  const value = record[key]
  return typeof value === 'string' && allowed.includes(value)
}

/**
 * `PetSaveRequest` 검증. **필드 순서는 DTO 선언 순서를 따른다** —
 * FE 가 같은 필드의 첫 오류만 채택하므로 정렬이 화면 문구를 결정한다.
 */
function validate(raw: unknown): MockResult | null {
  if (raw === null || typeof raw !== 'object') {
    return failValidation([
      { code: 'PET_101', field: 'name', message: '반려견 이름은 필수입니다.' },
    ])
  }

  const record = raw as Record<string, unknown>
  const errors: { code: string; field: string; message: string }[] = []

  const name = typeof record.name === 'string' ? record.name : ''
  if (name.trim() === '') {
    errors.push({ code: 'PET_101', field: 'name', message: '반려견 이름은 필수입니다.' })
  } else if (name.length > 20) {
    errors.push({
      code: 'PET_102',
      field: 'name',
      message: '반려견 이름은 20자 이하만 가능합니다.',
    })
  }

  // @Size(max = 50) 뿐이다. null 과 빈 문자열 모두 통과한다
  if (typeof record.breed === 'string' && record.breed.length > 50) {
    errors.push({ code: 'PET_103', field: 'breed', message: '품종은 50자 이하만 가능합니다.' })
  }

  /*
    @DecimalMin("0.1") · @DecimalMax("99.9") · @Digits(integer = 2, fraction = 1).
    **선택 필드다** — 없거나 null 이면 통과한다. mock 이 여기서 더 엄격하면 FE 가
    통과시키는 입력이 mock 에서만 400 이 되어 자기 판정을 부정한다.
  */
  if (record.weightKg !== undefined && record.weightKg !== null) {
    const weight = record.weightKg
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0.1 || weight > 99.9) {
      errors.push({
        code: 'PET_108',
        field: 'weightKg',
        message: '체중은 0.1 ~ 99.9kg 범위여야 합니다.',
      })
    } else if (Math.round(weight * 10) !== weight * 10) {
      errors.push({
        code: 'PET_109',
        field: 'weightKg',
        message: '체중은 소수점 한 자리까지만 입력할 수 있습니다.',
      })
    }
  }

  // @Pattern 은 null 을 유효로 보지만 빈 문자열은 정규식에 걸린다 — 공통명세 S3-3.
  // **이 분기를 느슨하게 만들면 mock 이 함정을 숨겨 FE 가 잘못된 확신을 얻는다**
  if (typeof record.birthYm === 'string' && !BIRTH_YM_PATTERN.test(record.birthYm)) {
    errors.push({
      code: 'PET_104',
      field: 'birthYm',
      message: '생년월은 yyyy-MM 형식이어야 합니다.',
    })
  }

  if (!isKnown(record, 'sizeType', ['SMALL', 'MEDIUM', 'LARGE'])) {
    errors.push({ code: 'PET_105', field: 'sizeType', message: '크기 구분은 필수입니다.' })
  }
  if (!isKnown(record, 'activityLevel', ['LOW', 'MEDIUM', 'HIGH'])) {
    errors.push({ code: 'PET_106', field: 'activityLevel', message: '활동량은 필수입니다.' })
  }
  if (!isKnown(record, 'sociality', ['LOW', 'MEDIUM', 'HIGH'])) {
    errors.push({ code: 'PET_107', field: 'sociality', message: '사회성은 필수입니다.' })
  }

  return errors.length > 0 ? failValidation(errors) : null
}

/** primitive boolean 이라 누락 시 서버가 조용히 false 로 채운다 — 공통명세 S3-4 */
function toBoolean(value: unknown): boolean {
  return value === true
}

/**
 * 요청 본문 → 저장 값.
 *
 * **사진과 대표견은 여기서 다루지 않는다.** `PetSaveRequest` 에 없는 필드이고 각자
 * 전용 엔드포인트를 갖는다 — PUT 이 통째로 덮어쓴다고 해서 사진까지 날아가면 안 된다.
 */
function toStored(
  raw: Record<string, unknown>,
): Omit<MockPet, 'petId' | 'memberId' | 'deleted' | 'profileImageUrl' | 'representative'> {
  return {
    name: String(raw.name),
    breed: typeof raw.breed === 'string' ? raw.breed : null,
    birthYm: typeof raw.birthYm === 'string' ? raw.birthYm : null,
    sizeType: String(raw.sizeType),
    // 선택 필드다. 숫자가 아니면 "모름" 으로 둔다 — 0 으로 채우지 않는다
    weightKg: typeof raw.weightKg === 'number' ? raw.weightKg : null,
    heatSensitive: toBoolean(raw.heatSensitive),
    coldSensitive: toBoolean(raw.coldSensitive),
    noiseSensitive: toBoolean(raw.noiseSensitive),
    activityLevel: String(raw.activityLevel),
    walkPreferred: toBoolean(raw.walkPreferred),
    sociality: String(raw.sociality),
  }
}

// 토큰이 없거나 유효하지 않은 요청은 도메인에 닿기 전에 security-core 가 막는다 —
// `SecurityErrorCode.UNAUTHORIZED`. **`AUTH_011` 이 아니다**: 그것은
// `OAUTH_PROFILE_REQUIRED` 이고 400 이라, 401 과 짝지으면 서버가 내지 않는 조합이 된다 (#83)
const UNAUTHORIZED = () => fail(401, 'SECURITY_001', '인증이 필요합니다.')
const NOT_FOUND = () => fail(404, 'PET_001', '존재하지 않는 반려견입니다.')

/**
 * 반려견 경로를 mock 응답으로 해석한다. 대상이 아니면 null 을 반환해
 * 호출부가 실제 게이트웨이로 넘어가게 한다.
 */
export function resolvePetMock(
  path: string,
  method: string,
  body: string | null,
  accessToken: string | null,
): MockResult | null {
  if (path !== '/members/me/pets' && !path.startsWith('/members/me/pets/')) return null

  // 5개 엔드포인트가 모두 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  const store = mockStore()
  const parsed = parseBody(body)

  if (path === '/members/me/pets') {
    if (method === 'GET') return list(memberId)
    if (method === 'POST') return create(memberId, parsed)
    return null
  }

  const rest = path.slice('/members/me/pets/'.length)
  const [petId = '', sub] = rest.split('/')

  // 컨트롤러가 @PathVariable long 이라, 숫자가 아닌 id 는 404 가 아니라 400 이다 — S4-3
  if (!/^\d+$/.test(petId)) {
    return fail(400, 'PET_113', '요청 파라미터 형식이 올바르지 않습니다.')
  }

  if (sub !== undefined) return resolvePetSubResource(petId, sub, method, memberId)

  const owned = store.pets.find(
    (pet) => pet.petId === petId && pet.memberId === memberId && !pet.deleted,
  )
  // 남의 반려견도 404 다. 존재 자체를 노출하지 않는다 (403 이 아니다)
  if (owned === undefined) return NOT_FOUND()

  if (method === 'GET') return { status: 200, payload: ok(toPetResponse(owned)) }
  if (method === 'PUT') return update(owned, parsed)
  if (method === 'DELETE') return remove(owned)

  return null
}

/**
 * 하위 경로 — 대표견 지정 · 프로필 사진.
 *
 * 본체(`/members/me/pets/{petId}`)와 나눠 둔 이유: 사진 업로드는 **multipart** 라
 * `body` 가 JSON 이 아니고, 위 흐름은 전부 JSON 파싱을 전제로 한다.
 */
function resolvePetSubResource(
  petId: string,
  sub: string,
  method: string,
  memberId: string,
): MockResult | null {
  const store = mockStore()
  const owned = store.pets.find(
    (pet) => pet.petId === petId && pet.memberId === memberId && !pet.deleted,
  )
  if (owned === undefined) return NOT_FOUND()

  if (sub === 'representative' && method === 'PUT') {
    // **회원당 하나만 유지된다.** 기존 대표를 먼저 내린다 (백엔드와 같은 규칙)
    for (const pet of store.pets) {
      if (pet.memberId === memberId) pet.representative = false
    }
    owned.representative = true

    return { status: 200, payload: ok(toPetResponse(owned)) }
  }

  if (sub === 'profile-image') {
    if (method === 'POST') {
      // 실제 파일을 저장하지 않는다. 화면이 확인할 것은 "URL 이 생겼는가" 다
      owned.profileImageUrl = `https://mock.hondigagae.local/pets/${petId}.jpg`

      // **업로드 응답은 회원 쪽과 같은 모양이다** — 전체가 아니라 키와 URL 뿐이다
      return {
        status: 200,
        payload: ok({
          profileImageKey: `pets/${petId}.jpg`,
          profileImageUrl: owned.profileImageUrl,
        }),
      }
    }

    if (method === 'DELETE') {
      // 삭제 응답은 반려견 전체다 — 업로드와 모양이 다르다
      owned.profileImageUrl = null
      return { status: 200, payload: ok(toPetResponse(owned)) }
    }
  }

  return null
}

function parseBody(body: string | null): unknown {
  if (body === null || body === '') return null
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function list(memberId: string): MockResult {
  const pets = mockStore()
    .pets.filter((pet) => pet.memberId === memberId && !pet.deleted)
    .map(toPetResponse)

  // SliceResponse 가 아니다. 최대 5마리라 항상 전량이 온다
  const payload: PetList = { pets, totalCount: pets.length }
  return { status: 200, payload: ok(payload) }
}

function create(memberId: string, raw: unknown): MockResult {
  const store = mockStore()

  // 백엔드는 상한을 검증보다 먼저 본다 (PetCommandProcessor.register)
  const count = store.pets.filter((pet) => pet.memberId === memberId && !pet.deleted).length
  if (count >= MAX_PET_COUNT) {
    // PET_002 는 400 이다. 409 가 아니다 — S4-2
    return fail(400, 'PET_002', '등록할 수 있는 반려견 수를 초과했습니다.')
  }

  const invalid = validate(raw)
  if (invalid !== null) return invalid

  const stored: MockPet = {
    petId: nextPetId(store),
    memberId,
    ...toStored(raw as Record<string, unknown>),
    profileImageUrl: null,
    // 첫 아이는 자동으로 대표가 된다 (백엔드 PetCommandProcessor.register)
    representative: count === 0,
    deleted: false,
  }
  store.pets.push(stored)

  return { status: 200, payload: ok(toPetResponse(stored)) }
}

function update(target: MockPet, raw: unknown): MockResult {
  const invalid = validate(raw)
  if (invalid !== null) return invalid

  // PUT 은 부분 수정이 아니다. 10개 필드를 통째로 덮어쓴다 — S2
  Object.assign(target, toStored(raw as Record<string, unknown>))

  return { status: 200, payload: ok(toPetResponse(target)) }
}

function remove(target: MockPet): MockResult {
  // 소프트 삭제다. 일정이 참조하고 있어 행을 지우지 않는다
  target.deleted = true

  return { status: 200, payload: ok(null) }
}
