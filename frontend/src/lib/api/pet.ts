import { paths } from '@/lib/api/paths'

/**
 * 경로만 만든다. 전송은 client.ts / server.ts 가 나눠 담당한다
 * (docs/architecture-guide.md §8).
 */

export function petListPath(): string {
  return paths.members.pets
}

export function petDetailPath(petId: string): string {
  return paths.members.pet(petId)
}

export function petCreatePath(): string {
  return paths.members.pets
}

export function petUpdatePath(petId: string): string {
  return paths.members.pet(petId)
}

export function petDeletePath(petId: string): string {
  return paths.members.pet(petId)
}

/**
 * 등록 상한. 백엔드 `PetCommandProcessor.MAX_PET_COUNT` 의 복제본이다.
 *
 * 초과하면 서버가 `PET_002`(**400**, 409 가 아니다) 를 준다. 화면은 목록의
 * `totalCount` 로 등록 진입을 미리 막고, 서버 오류는 경합 대비 2차 방어로 쓴다
 * (공통명세 S4-2).
 */
export const MAX_PET_COUNT = 5

/** `PET_002` — 필드 검증 400 과 같은 상태코드라 resultCode 로 구분해야 한다 */
export const PET_LIMIT_EXCEEDED_CODE = 'PET_002'
