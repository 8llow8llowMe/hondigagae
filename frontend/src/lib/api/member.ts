import { clientFetch, clientFetchVoid } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type {
  MemberMyInfo,
  MemberUpdatePayload,
  PasswordChangePayload,
  PasswordSetupPayload,
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
