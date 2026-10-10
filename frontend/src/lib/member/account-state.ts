import type { MemberMyInfo } from '@/types/member'

/**
 * 계정 상태 — `provider` × `hasPassword` 조합 (공통명세 S2).
 *
 * `MemberMyInfoResponse.hasPassword` 의 스키마 설명이 조합을 못박아 뒀다.
 * 이 판정이 `/mypage/password` 의 분기와 `/mypage` 계정 섹션의 모양을 함께 정한다.
 */
export type AccountState =
  /** `provider === null && hasPassword` — 이메일 로그인만 */
  | 'general'
  /** 소셜 연결 + 비밀번호 없음 — 최초 설정으로 이메일 로그인 수단을 추가할 수 있다 */
  | 'social-only'
  /** 소셜 연결 + 비밀번호 있음 — 변경과 소셜 전용 전환 둘 다 가능 */
  | 'linked'
  /**
   * `provider === null && !hasPassword` — **나올 수 없는 조합이다.**
   *
   * 나오면 서버 결함이다. 로그인 수단이 하나도 없다는 뜻이라 어느 동작을 제시해도
   * 틀린다. 화면은 안내 문구만 내고 **동작 버튼을 하나도 만들지 않는다** (D5).
   */
  | 'unknown'

export function toAccountState(
  member: Pick<MemberMyInfo, 'provider' | 'hasPassword'>,
): AccountState {
  const linked = member.provider !== null && member.provider.length > 0

  if (!linked) return member.hasPassword ? 'general' : 'unknown'
  return member.hasPassword ? 'linked' : 'social-only'
}

/** 비밀번호 화면이 변경 폼을 낼 수 있는가 (현재 비밀번호 + 새 비밀번호) */
export function canChangePassword(state: AccountState): boolean {
  return state === 'general' || state === 'linked'
}

/** 비밀번호 화면이 최초 설정 폼을 낼 수 있는가 */
export function canSetupPassword(state: AccountState): boolean {
  return state === 'social-only'
}

/**
 * 소셜 전용으로 전환(비밀번호 제거)할 수 있는가.
 *
 * **일반 계정은 불가하다.** 마지막 로그인 수단이 사라진다 — 백엔드도
 * `MEMBER_009`(PASSWORD_REMOVAL_NOT_ALLOWED)로 막는다.
 */
export function canRemovePassword(state: AccountState): boolean {
  return state === 'linked'
}
