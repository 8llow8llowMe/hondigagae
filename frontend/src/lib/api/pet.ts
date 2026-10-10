import { clientFetch, clientFetchForm, clientFetchVoid } from '@/lib/api/client'
import { PROFILE_IMAGE_PART } from '@/lib/api/member'
import { paths } from '@/lib/api/paths'
import type { ProfileImageUploadResult } from '@/types/member'
import type { Pet, PetList, PetSavePayload } from '@/types/pet'

/**
 * 반려견 API — 경로와 브라우저 호출부.
 *
 * 서버 컴포넌트는 이 파일의 `*Path()` 만 쓰고 전송은 server.ts 가 한다
 * (docs/architecture-guide.md §8). 아래 호출 함수는 브라우저 전용이다.
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

export function fetchPetList(): Promise<PetList> {
  return clientFetch<PetList>(petListPath())
}

export function fetchPet(petId: string): Promise<Pet> {
  return clientFetch<Pet>(petDetailPath(petId))
}

export function createPet(payload: PetSavePayload): Promise<Pet> {
  return clientFetch<Pet>(petCreatePath(), { method: 'POST', body: payload })
}

/**
 * 수정. **부분 수정이 아니다** — 10개 필드를 통째로 덮어쓴다 (공통명세 S2).
 * `toPetSavePayload()` 가 항상 전량을 담으므로 이 계약이 자동으로 만족된다.
 */
export function updatePet(petId: string, payload: PetSavePayload): Promise<Pet> {
  return clientFetch<Pet>(petUpdatePath(petId), { method: 'PUT', body: payload })
}

/** 소프트 삭제다. `dataBody` 가 null 이라 `unwrapVoid` 경로를 쓴다 */
export function deletePet(petId: string): Promise<void> {
  return clientFetchVoid(petDeletePath(petId), { method: 'DELETE' })
}

/**
 * 반려견 사진 업로드.
 *
 * **응답이 `{profileImageKey, profileImageUrl}` 뿐이다** — 삭제와 달리 반려견 정보
 * 전체가 오지 않는다. 회원 프로필 이미지(#79)와 같은 모양이라 캐시 갱신도 같게 다룬다.
 *
 * 실패: `STORAGE_001`(파일 없음) · `STORAGE_002`(크기) · `STORAGE_003`(형식) — 전부 400.
 * 형식 판정은 확장자가 아니라 **파일 내용(매직 바이트)** 이다.
 */
export function uploadPetImage(petId: string, file: File): Promise<ProfileImageUploadResult> {
  const form = new FormData()
  // 회원 프로필과 **같은 파트명**이다 — 두 컨트롤러 모두 @RequestPart("imageFile") 다
  form.append(PROFILE_IMAGE_PART, file)

  return clientFetchForm<ProfileImageUploadResult>(paths.members.petProfileImage(petId), {
    body: form,
  })
}

/** 사진 삭제. **응답이 반려견 전체다** — 업로드와 모양이 다르다 */
export function removePetImage(petId: string): Promise<Pet> {
  return clientFetch<Pet>(paths.members.petProfileImage(petId), { method: 'DELETE' })
}

/**
 * 대표 반려견 지정.
 *
 * **해제가 없다.** 회원당 하나만 유지되므로 다른 아이를 지정하면 기존 대표가 자동으로
 * 내려간다 → 화면도 토글이 아니라 "지정" 단방향으로 만든다.
 *
 * 응답은 지정된 반려견 하나지만 **다른 아이의 `representative` 도 바뀌었다** →
 * 목록 전체를 무효화해야 한다.
 */
export function markRepresentativePet(petId: string): Promise<Pet> {
  return clientFetch<Pet>(paths.members.petRepresentative(petId), { method: 'PUT' })
}
