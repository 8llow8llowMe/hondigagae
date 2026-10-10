import { z } from 'zod'

import { PASSWORD_PATTERN } from '@/lib/form/password-pattern'
import { messages } from '@/lib/messages'

/**
 * 회원 요청 스키마. **백엔드 제약의 복제본이다** — docs/form-guide.md §5.
 * 필드명은 요청 DTO 와 같게 둔다. 다르면 서버 오류 매핑이 조용히 깨진다.
 */

/**
 * 새 비밀번호 규칙.
 *
 * **회원가입과 같은 규칙이다** — 정규식은 `lib/form/password-pattern` 한 곳에 있고
 * 회원가입 폼도 같은 것을 쓴다. 검사 순서는 **길이 → 문자 구성**이다. 백엔드 정렬
 * (@Size 우선순위 1 → @Pattern 3)과 같아야 클라이언트와 서버의 결과가 어긋나지 않는다.
 */
// MEMBER_112 (필수) / MEMBER_104 (길이) / MEMBER_105 (문자 구성)
const newPassword = z
  .string()
  .min(1, messages.member.newPasswordRequired)
  .min(8, messages.form.passwordLength)
  .max(20, messages.form.passwordLength)
  .regex(PASSWORD_PATTERN, messages.form.passwordPattern)

/** `MemberMyInfoUpdateRequest` — MEMBER_108 (필수) / MEMBER_109 (길이) */
export const nicknameSchema = z.object({
  nickname: z
    .string()
    .min(1, messages.member.nicknameRequired)
    .max(10, messages.member.nicknameLength),
})

/**
 * `MemberPasswordChangeRequest`.
 *
 * **현재 비밀번호에는 형식을 검사하지 않는다.** 기존 계정의 비밀번호가 지금 규칙보다
 * 먼저 만들어졌을 수 있어, 형식으로 막으면 정상 계정이 변경을 못 한다 —
 * 로그인 폼과 같은 판단이다 (로그인-세부명세 D5).
 */
export const passwordChangeSchema = z.object({
  // MEMBER_111
  currentPassword: z.string().min(1, messages.member.currentPasswordRequired),
  newPassword,
})

/**
 * `MemberPasswordSetupRequest` — 요청 본문은 **`newPassword` 하나뿐이다.**
 *
 * 그런데도 `currentPassword` 자리를 남기는 이유: 변경 폼과 최초 설정 폼이 **한 벌의
 * 폼 값**을 공유하기 때문이다 (`PasswordForm`). 두 모드가 다른 값 타입을 쓰면 폼 상태·
 * 포커스 배선이 두 벌이 된다. **여기서는 검사하지 않고, 전송할 때도 싣지 않는다** —
 * `setupPassword()` 가 `newPassword` 만 담는다.
 */
export const passwordSetupSchema = z.object({
  currentPassword: z.string(),
  newPassword,
})

export type NicknameValues = z.infer<typeof nicknameSchema>
/** 비밀번호 화면의 폼 값. 변경·최초 설정이 공유한다 */
export type PasswordFormValues = z.infer<typeof passwordChangeSchema>
