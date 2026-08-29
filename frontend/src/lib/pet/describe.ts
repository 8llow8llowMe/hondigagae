import type { Pet } from '@/types/pet'

/**
 * 반려견 한 줄 소개.
 *
 * **크기를 넣는 자리와 빼는 자리가 다르다.**
 * - 홈 프로필 카드(`말티즈 · 소형견 · 4살`) — 크기는 적합도 판정의 입력이라 보여준다
 * - 일정 필터 레일 · 만들기 폼(`말티즈 · 4살`) — 여기서는 두 마리를 구별하기만 하면 되고
 *   280 레일에 세 조각은 잘린다. 아트보드 `여행 일정` 05 도 두 조각만 쓴다
 *
 * 체중은 어디서도 쓰지 않는다 — 백엔드 `Pet` 에 필드가 없다.
 *
 * 조각이 하나도 없으면 **빈 문자열이 아니라 `null`** 이다. 호출부가 빈 줄을 렌더해
 * 자리만 차지하는 것을 막는다.
 */
export function describePet(pet: Pet, options: { size?: boolean } = {}): string | null {
  const parts = [
    pet.breed,
    options.size === true ? pet.sizeType.name : null,
    pet.age === null ? null : `${pet.age}살`,
  ].filter((part): part is string => part !== null && part !== '')

  return parts.length === 0 ? null : parts.join(' · ')
}
