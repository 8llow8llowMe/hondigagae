/**
 * 인증코드 발송 응답 (#1309, BE #1293). 가입 인증(`/auth/email/send-code`)과 비밀번호 재설정
 * (`/auth/password/reset/send-code`)이 같은 모양이다 — dev 실측 2026-10-11.
 *
 * ```json
 * {"dataHeader":{"success":true,...},"dataBody":{"codeExpiresInSeconds":300,"resendAvailableInSeconds":60}}
 * ```
 *
 * **가입 여부와 무관하게 같은 값이다** (계정 열거 방지). 이 값으로 계정 존재를 판정하지 않는다.
 */
export type VerificationCodeSendResponse = {
  /** 방금 보낸 코드가 유효한 남은 초 */
  codeExpiresInSeconds: number
  /** 다시 보낼 수 있을 때까지 남은 초 */
  resendAvailableInSeconds: number
}
