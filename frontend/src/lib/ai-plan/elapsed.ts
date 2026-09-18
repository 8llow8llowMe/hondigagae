/**
 * 대기 화면의 경과 시간 표기 (#710).
 *
 * **남은 시간이 아니라 지난 시간이다.** 서버는 남은 시간을 주지 않고(명세 S2) 화면이
 * 예측하면 지어낸 진행률이 된다 — 지난 시간은 관측값이라 틀릴 수가 없다. 이 표시의 쓸모는
 * 정확도가 아니라 **"멈춘 것이 아니다" 를 1초마다 증명하는 것**이다.
 *
 * `AiPlanJobStep` 넷 중 `DRAFTING`(LLM 호출)이 전체의 90% 이상을 먹어서, 사람이 보는
 * 거의 모든 시간이 `4 / 4단계` 한 칸이다. 단계 표시만으로는 그 구간에서 화면이 아무 말도
 * 하지 않는다.
 *
 * **`prefers-reduced-motion` 에서는 이것이 유일한 생존 신호다** — `app/globals.css` 가
 * 모든 애니메이션을 한 프레임(0.01ms)으로 줄이므로 맥동은 그 사용자에게 보이지 않는다.
 *
 * 순수 함수라 node 환경 테스트로 덮는다.
 */

/**
 * 경과 시간을 `12초` · `1분 12초` · `2분` 으로 적는다.
 *
 * **1초 전에는 `null` 이다.** `0초 지남` 은 아무것도 말하지 않으면서 자리만 차지하고,
 * 첫 tick(`TICK_MS` 1초) 전까지 반드시 지나는 상태다 — 첫 프레임에 보였다 사라지는 줄이
 * 생기면 카드 높이가 한 번 튄다.
 *
 * 음수·`NaN`·`Infinity` 도 `null` 이다. 시계는 `Date.now()` 차이라 기기 시간이 뒤로 가면
 * 음수가 나올 수 있고, 그때 `-3초 지남` 을 그리면 버그를 사용자에게 보여 주는 것이 된다.
 */
export function formatElapsed(elapsedMs: number): string | null {
  if (!Number.isFinite(elapsedMs)) return null

  const seconds = Math.floor(elapsedMs / 1000)
  if (seconds < 1) return null
  if (seconds < 60) return `${seconds}초`

  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60

  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`
}
