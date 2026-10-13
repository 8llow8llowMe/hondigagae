import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

/**
 * 반려견 등록 뒤 다음 행동 (#1430).
 *
 * 등록하면 목록으로만 돌아가 할 일이 끊겼다. 목록이 **방금 등록한 아이**를 알아야 그 아이로
 * AI 일정 만들기를 권할 수 있는데, 등록 화면은 곧 사라지므로 그 사실을 주소에 싣는다
 * (`/pets?registered=<id>`). 클라이언트 스토어에 두지 않는 이유는 새로고침해도 같은 화면이
 * 서야 하고, 서버 데이터를 Zustand 로 복사하지 않는 규칙(architecture-guide §10)과도 맞다.
 */

/** 목록 주소의 쿼리 키 */
export const REGISTERED_PET_PARAM = 'registered'

/** 등록 성공 뒤 돌아갈 목록 주소 */
export function registeredPetListHref(petId: string): string {
  return `/pets?${REGISTERED_PET_PARAM}=${encodeURIComponent(petId)}`
}

/**
 * AI 일정 만들기 — 이 반려견으로. `?pet` 을 폼이 읽는 것은 #1431 의 일이다.
 * `petId` 는 문자열이다 (Snowflake) — 숫자로 바꾸지 않고 인코딩만 한다.
 */
export function aiPlanForPetHref(petId: string): string {
  return `/ai-plans/new?pet=${encodeURIComponent(petId)}`
}

/**
 * 쿼리 값 → 목록에 있는 반려견. **목록에 없으면 `null` 이다** — 지운 아이이거나 손으로 고친
 * 주소다. 이름을 지어내 권하지 않는다. 배열(`?registered=a&registered=b`)은 받지 않는다.
 */
export function registeredPet<T extends Pick<Pet, 'petId'>>(
  pets: readonly T[],
  raw: string | string[] | undefined,
): T | null {
  if (typeof raw !== 'string' || raw === '') return null
  return pets.find((pet) => pet.petId === raw) ?? null
}

/**
 * 목록 머리 안내 — 반려견 수에 따라 (#1430). `null` 은 셀 수 없음(로딩·오류)이다.
 * 셀 수 없을 때 기본 문장을 쓰는 것은 예전 그대로다 — 서버 프리페치로 대개 지나치는 갈래다.
 */
export function petListDescription(count: number | null): string {
  if (count === null || count <= 0) return messages.pet.listDescription
  return count >= MAX_PET_COUNT
    ? messages.pet.listDescriptionFull
    : messages.pet.listDescriptionSome
}
