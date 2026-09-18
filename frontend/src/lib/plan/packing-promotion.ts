import { planPhaseOf } from '@/lib/plan/date'
import type { PlanDetail } from '@/types/plan'

/**
 * 준비물 시간 승격 (#665 · 명세 D11-9 · 진단 PL-3).
 *
 * #653 이 준비물을 일자 뒤로 내린 근거는 _"준비물은 출발 전날 과업"_ 이었다. **바로 그
 * 출발 전날에는 근거가 뒤집힌다** — 그날 이 화면을 연 사람이 찾는 것은 짐 목록이다.
 */

/** 승격이 열리는 최대 남은 일수. `D-1` 까지가 창이다 (D11-9-1) */
export const PACKING_PROMOTION_MAX_DAYS = 1

/**
 * 준비물 카드를 일자 위로 올릴 것인가 (D11-9-1).
 *
 * **`planPhaseOf` 에 얹는다.** 산술만 보면 `startDate` 하나로도 같은 답이 난다 —
 * `days < 0` 이면 `ongoing` 이든 `past` 든 비승격이라 둘을 가릴 필요가 없다. 그런데도
 * `endDate` 를 받아 `planPhaseOf` 를 부르는 이유는 둘이다.
 *
 * 1. **`lib/plan/date.ts` 가 _"날짜 축의 판정은 여기 하나뿐이다"_ 를 못박았다.** 같은
 *    화면에서 개요 배지(`D-1`)와 준비물 자리를 **다른 셈**으로 정하면, 배지는 `D-1` 인데
 *    준비물이 안 올라오는 날이 생길 수 있다. 같은 `days` 를 쓰면 그럴 수 없다.
 * 2. **기간 역전(`endDate < startDate`) 깨진 데이터가 `past` 로 떨어져 비승격이 된다.**
 *    `startDate` 산술만 보면 역전 데이터도 승격한다.
 *
 * **출발 당일은 종일 승격이다** — 시각을 보지 않는다 (D11-9-8 미결 1). `today` 를 달력의
 * 칸으로만 쓰는 것이 이 저장소 규약이고(`lib/date/day.ts`), 시각을 보기 시작하면 SSR 과
 * 하이드레이션이 갈린다.
 *
 * **반환값이 `boolean` 인 이유**는 갈래가 둘(위/아래)뿐이고 **화면이 승격 이유를 말하지
 * 않기** 때문이다 — `DayRegenerateBlock` 같은 이유 union 이 필요 없다. 이유를 말하게
 * 되는 날 union 으로 넓힌다.
 *
 * **`today` 는 주입받는다.** 모듈 안에서 `new Date()` 를 부르지 않는다 —
 * `dayRegenerateBlock` 과 같은 분담이다.
 *
 * @returns 출발 전날·당일이면 `true`. 그 밖(여행 중 · 지난 일정 · 읽을 수 없는 날짜)은 `false`
 */
export function isPackingPromoted(
  plan: Pick<PlanDetail, 'startDate' | 'endDate'>,
  today: Date,
): boolean {
  const phase = planPhaseOf(plan.startDate, plan.endDate, today)
  return phase?.kind === 'upcoming' && phase.days <= PACKING_PROMOTION_MAX_DAYS
}
