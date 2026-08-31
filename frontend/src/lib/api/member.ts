import { clientFetch, clientFetchForm, clientFetchVoid } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type {
  MemberMyInfo,
  MemberUpdatePayload,
  PasswordChangePayload,
  PasswordSetupPayload,
  ProfileImageUploadResult,
} from '@/types/member'

/**
 * 회원 API — 경로와 브라우저 호출부.
 *
 * 서버 컴포넌트는 이 파일의 `*Path()` 만 쓰고 전송은 server.ts 가 한다
 * (docs/architecture-guide.md §8). 아래 호출 함수는 브라우저 전용이다.
 */

export function myInfoPath(): string {
  return paths.members.me
}

export function fetchMyInfo(): Promise<MemberMyInfo> {
  return clientFetch<MemberMyInfo>(myInfoPath())
}

/**
 * 내 정보 수정. **`nickname` 하나뿐이다** — 요청 DTO 에 다른 필드가 없다.
 * 응답은 회원 정보 전체라 캐시를 `setQueryData` 로 통째로 바꿀 수 있다.
 */
export function updateMyInfo(payload: MemberUpdatePayload): Promise<MemberMyInfo> {
  return clientFetch<MemberMyInfo>(paths.members.me, { method: 'PATCH', body: payload })
}

/**
 * 업로드 파트명. **`imageFile` 이어야 한다** — 컨트롤러가
 * `@RequestPart("imageFile")` 로 받는다. 이름이 다르면 400 이다.
 */
export const PROFILE_IMAGE_PART = 'imageFile'

/**
 * 업로드 상한. 서버 `spring.servlet.multipart.max-file-size` 기본값(5MB)과
 * `infra.storage.max-file-bytes`(5242880) 의 복제본이다.
 *
 * **화면이 먼저 막는 이유**: BFF 가 재시도를 위해 본문을 통째로 메모리에 올린다
 * (`forwarded-body.ts`). 서버가 거부할 파일이 거기까지 가지 않게 하는 첫 방어선이다.
 * 서버 검증을 대신하는 것이 아니다 — 서버는 `STORAGE_002` 로 다시 막는다.
 */
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * 허용 형식. 화면의 `accept` 속성에 쓴다.
 *
 * **검증이 아니라 편의다.** 서버는 확장자나 클라이언트가 보낸 `Content-Type` 이 아니라
 * **매직 바이트**로 판정한다 (`ImageFileType`) — 위조할 수 있기 때문이다.
 */
export const PROFILE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'

/**
 * 프로필 이미지 업로드.
 *
 * **응답이 `{profileImageKey, profileImageUrl}` 뿐이다** — 삭제와 달리 회원 정보 전체가
 * 오지 않는다. 그래서 캐시는 `profileImageUrl` 만 갈아끼운다 (공통명세 S1).
 *
 * 실패: `STORAGE_002`(크기 초과) · `STORAGE_003`(형식) · `STORAGE_001`(파일 없음) — 전부 400.
 */
export function uploadProfileImage(file: File): Promise<ProfileImageUploadResult> {
  const form = new FormData()
  form.append(PROFILE_IMAGE_PART, file)

  return clientFetchForm<ProfileImageUploadResult>(paths.members.profileImage, { body: form })
}

/**
 * 프로필 이미지 삭제. **응답이 회원 정보 전체다** — 업로드와 모양이 다르다.
 * 저장된 파일도 함께 지워진다.
 */
export function removeProfileImage(): Promise<MemberMyInfo> {
  return clientFetch<MemberMyInfo>(paths.members.profileImage, { method: 'DELETE' })
}

/**
 * 비밀번호 변경.
 *
 * **성공하면 서버가 refresh 쿠키를 지운다** (`MemberWebController.changePassword` 가
 * `clearRefreshCookie()` 를 헤더에 싣는다). 즉 재로그인이 필요하다 — 호출부는
 * 캐시 무효화가 아니라 **세션 정리 + `/login` 이동**으로 끝내야 한다.
 * 명세 D3 는 invalidate 만 적고 있었다 (소스 실측으로 잡은 차이).
 *
 * 실패: `MEMBER_003`(현재 비밀번호 불일치, 400) · `MEMBER_007`(소셜 전용 계정, 400).
 */
export function changePassword(payload: PasswordChangePayload): Promise<void> {
  return clientFetchVoid(paths.members.password, { method: 'POST', body: payload })
}

/**
 * 비밀번호 최초 설정 — 소셜 전용 계정에 이메일 로그인 수단을 추가한다.
 *
 * **변경·제거와 달리 refresh 쿠키를 지우지 않는다.** 로그인 수단이 늘어날 뿐이라
 * 지금 세션을 끊을 이유가 없다. 그래서 이쪽만 `memberKeys.me()` invalidate 로 끝난다.
 *
 * 실패: `MEMBER_008`(이미 비밀번호가 있는 계정, 400).
 */
export function setupPassword(payload: PasswordSetupPayload): Promise<void> {
  return clientFetchVoid(paths.members.passwordSetup, { method: 'POST', body: payload })
}

/**
 * 소셜 전용으로 전환 — 비밀번호 제거.
 *
 * 변경과 마찬가지로 **서버가 refresh 쿠키를 지운다.** 재로그인이 필요하다.
 *
 * 실패: `MEMBER_009`(소셜이 연결되지 않은 일반 계정, 400) ·
 * `MEMBER_007`(이미 소셜 전용, 400). 화면이 `linked` 에서만 이 동작을 내지만,
 * 서버 오류는 경합 대비 2차 방어로 남긴다.
 */
export function removePassword(): Promise<void> {
  return clientFetchVoid(paths.members.password, { method: 'DELETE' })
}

/**
 * 탈퇴. **비밀번호 재확인을 받지 않는다** — 서버가 요구하지 않는다 (공통명세 S5-3).
 * 서버가 refresh 쿠키를 지우므로 이후 세션 정리 + `/login` 이동으로 끝낸다.
 */
export function withdraw(): Promise<void> {
  return clientFetchVoid(paths.members.withdraw, { method: 'POST' })
}
