/**
 * 재전송 쿨다운 계산. **순수 함수** — docs/form-guide.md §2.
 *
 * 훅은 이 함수만 호출해 배선한다("남은 초"를 직접 `setInterval` 로 1씩 감산하지
 * 않는다). 시작 시각(`startedAt`) 기준으로 매번 다시 계산하면 백그라운드 탭에서
 * 타이머가 스로틀링돼도 남은 초가 어긋나지 않는다 — 회원가입-세부명세.md D7.
 */
export function remainingSeconds(startedAt: number, durationSeconds: number, now: number): number {
  const elapsedSeconds = Math.floor((now - startedAt) / 1000)
  const remaining = durationSeconds - elapsedSeconds
  return remaining > 0 ? remaining : 0
}
