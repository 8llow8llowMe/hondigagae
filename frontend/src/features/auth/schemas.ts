import { z } from 'zod'

import { messages } from '@/lib/messages'

/**
 * 인증 요청 스키마. **백엔드 제약의 복제본이다** — docs/form-guide.md §5.
 * 필드명은 요청 DTO 와 같게 둔다. 다르면 서버 오류 매핑이 조용히 깨진다.
 */

/** MemberGeneralSignupRequest @Pattern 실측 — 백엔드와 문자 하나까지 같아야 한다 */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|])\S+$/

/**
 * zod 4 기본 이메일 정규식은 TLD 2자 이상을 요구해 `a@b.c` 같은 1자 TLD를
 * 거부한다. 백엔드는 이런 형식 제약을 두지 않으므로 더 관대한 HTML5 패턴을 쓴다.
 */
const EMAIL_PATTERN = z.regexes.html5Email

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
  email: z
    .string()
    .min(1, messages.form.emailRequired)
    .pipe(z.email({ pattern: EMAIL_PATTERN, message: messages.form.emailInvalid })),
  password: z.string().min(1, messages.form.passwordRequired),
})

/**
 * 회원가입 3단계(프로필).
 *
 * 비밀번호는 **길이 → 문자 구성** 순으로 검사한다. 백엔드 정렬 순서
 * (@Size 우선순위 1 → @Pattern 우선순위 3)와 같아야 결과가 어긋나지 않는다.
 */
export const signupProfileSchema = z.object({
  password: z
    .string()
    .min(1, messages.form.passwordRequired)
    .min(8, messages.form.passwordLength)
    .max(20, messages.form.passwordLength)
    .regex(PASSWORD_PATTERN, messages.form.passwordPattern),
  name: z.string().min(1, messages.form.nameRequired).max(10, messages.form.nameLength),
  nickname: z.string().min(1, messages.form.nicknameRequired).max(10, messages.form.nicknameLength),
})

export type LoginValues = z.infer<typeof loginSchema>
export type EmailValues = z.infer<typeof emailSchema>
export type CodeValues = z.infer<typeof codeSchema>
export type SignupProfileValues = z.infer<typeof signupProfileSchema>
