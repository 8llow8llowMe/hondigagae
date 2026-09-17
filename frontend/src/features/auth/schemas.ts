import { z } from 'zod'

import { EMAIL_PATTERN } from '@/lib/form/email-pattern'
import { PASSWORD_PATTERN } from '@/lib/form/password-pattern'
import { messages } from '@/lib/messages'

/**
 * 인증 요청 스키마. **백엔드 제약의 복제본이다** — docs/form-guide.md §5.
 * 필드명은 요청 DTO 와 같게 둔다. 다르면 서버 오류 매핑이 조용히 깨진다.
 */

/** AUTH_101 / AUTH_102 — AuthValidationMessage */
export const emailSchema = z.object({
  email: z
    .string()
    .min(1, messages.form.emailRequired)
    .pipe(z.email({ pattern: EMAIL_PATTERN, message: messages.form.emailInvalid })),
})

/** AUTH_104 */
export const codeSchema = z.object({
  code: z.string().min(1, messages.form.codeRequired),
})

/**
 * 로그인. **비밀번호 형식을 검사하지 않는다.**
 * 기존 계정의 비밀번호 규칙이 바뀌었을 수 있고, 로그인에서 형식을 막으면
 * 정상 계정이 로그인하지 못한다 — 로그인-세부명세.md D5.
 *
 * 백엔드 `POST /auth/login` 에 `@Valid` 가 없어 **서버 검증이 돌지 않는다.**
 * 이 스키마가 유일한 방어다 (BE 후속 요청 #24).
 */
export const loginSchema = z.object({
  // AUTH_101 / AUTH_102
  email: z
    .string()
    .min(1, messages.form.emailRequired)
    .pipe(z.email({ pattern: EMAIL_PATTERN, message: messages.form.emailInvalid })),
  // AUTH_103
  password: z.string().min(1, messages.form.passwordRequired),
})

/**
 * 회원가입 3단계(프로필).
 *
 * 비밀번호는 **길이 → 문자 구성** 순으로 검사한다. 백엔드 정렬 순서
 * (@Size 우선순위 1 → @Pattern 우선순위 3)와 같아야 결과가 어긋나지 않는다.
 */
export const signupProfileSchema = z.object({
  // MEMBER_103 (필수) / MEMBER_104 (길이) / MEMBER_105 (문자 구성)
  password: z
    .string()
    .min(1, messages.form.passwordRequired)
    .min(8, messages.form.passwordLength)
    .max(20, messages.form.passwordLength)
    .regex(PASSWORD_PATTERN, messages.form.passwordPattern),
  // MEMBER_106 (필수) / MEMBER_107 (길이)
  name: z.string().min(1, messages.form.nameRequired).max(10, messages.form.nameLength),
  // MEMBER_108 (필수) / MEMBER_109 (길이)
  nickname: z.string().min(1, messages.form.nicknameRequired).max(10, messages.form.nicknameLength),
})

/**
 * 가입 동의·만 14세 확인 — 이슈 #688 (백엔드 #607 · #608).
 *
 * **`signupProfileSchema` 에 합치지 않는다.** 동의는 3단계(프로필)의 값이 아니라
 * **가입 화면 전체의 값**이다: 같은 화면의 소셜 버튼도 이 동의를 받아야 `/authorize` 를
 * 부를 수 있고, 그 버튼은 1단계부터 보인다. 3단계 폼 값으로 가두면 소셜로 가입하려는
 * 사용자는 동의할 방법이 없다 (회원가입-세부명세.md D8-5).
 *
 * `z.literal(true)` 가 아니라 `z.boolean().refine(...)` 인 이유는 **추론 타입**이다.
 * `z.literal(true)` 는 타입이 `true` 라 체크 해제 상태(`false`)를 담을 수 없어 화면
 * 상태 타입으로 쓸 수 없다. 백엔드도 `boolean` 필드에 `@AssertTrue` 를 거는 같은 모양이다.
 */
export const signupConsentSchema = z.object({
  // MEMBER_115
  termsAgreed: z.boolean().refine((agreed) => agreed, messages.form.termsAgreementRequired),
  // MEMBER_116
  privacyAgreed: z.boolean().refine((agreed) => agreed, messages.form.privacyAgreementRequired),
  // MEMBER_117
  ageOver14Confirmed: z.boolean().refine((confirmed) => confirmed, messages.form.ageOver14Required),
})

/**
 * 비밀번호 재설정 2단계 (코드 + 새 비밀번호).
 *
 * **필드명이 `newPassword` 다** — 요청 DTO(`AuthPasswordResetRequest`)와 같게 둔다.
 * `password` 로 두면 서버 필드 오류가 어느 입력에도 매핑되지 않아 조용히 사라진다
 * (form-guide.md §5).
 *
 * 검사 순서는 `signupProfileSchema` 와 같다 — 길이(@Size) → 문자 구성(@Pattern).
 * 정규식은 `lib/form/password-pattern.ts` 하나를 공유한다. 복제본을 만들면 회원가입과
 * 재설정이 같은 비밀번호를 두고 통과·거부로 갈린다.
 */
export const passwordResetSchema = z.object({
  // AUTH_104
  code: z.string().min(1, messages.form.codeRequired),
  newPassword: z
    .string()
    .min(1, messages.form.passwordRequired)
    .min(8, messages.form.passwordLength)
    .max(20, messages.form.passwordLength)
    .regex(PASSWORD_PATTERN, messages.form.passwordPattern),
})

export type LoginValues = z.infer<typeof loginSchema>
export type EmailValues = z.infer<typeof emailSchema>
export type CodeValues = z.infer<typeof codeSchema>
export type SignupProfileValues = z.infer<typeof signupProfileSchema>
export type SignupConsentValues = z.infer<typeof signupConsentSchema>
export type PasswordResetValues = z.infer<typeof passwordResetSchema>
