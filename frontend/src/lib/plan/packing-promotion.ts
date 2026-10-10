import { planPhaseOf } from '@/lib/plan/date'
import type { PlanDetail, PlanPackingListResponse } from '@/types/plan'

/**
 * 준비물 자리 (#665 승격 · **#732 내용 조건**).
 *
 * #653 이 준비물을 일자 뒤로 내린 근거는 _"준비물은 출발 전날 과업"_ 이었다. **바로 그
 * 출발 전날에는 근거가 뒤집힌다** — 그날 이 화면을 연 사람이 찾는 것은 짐 목록이다.
 *
 * **그런데 #665 는 시간만 보고 올렸다.** 그래서 출발 전날에 올라온 카드가 **비어 있었다** —
 * 설명 두 문단과 `AI로 준비물 챙기기` 버튼이 전부였고, 승격의 보상이 "빈 상태를 더 잘
 * 보이는 자리로 옮긴 것" 이 됐다. 자리는 **내용이 있을 때** 값을 갖는다.
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
 * **여기는 시간 축만 본다.** 내용까지 합친 자리 판정은 `packingPlacement` 다 (#732) —
 * 시간은 일정에서 바로 나오고 내용은 별도 조회라, 둘을 한 함수에 섞으면 조회가 오기 전에
 * "창이 열렸는지" 를 물을 방법이 없어진다.
 *
 * **`today` 는 주입받는다.** 모듈 안에서 `new Date()` 를 부르지 않는다 —
 * `dayRegenerateBlock` 과 같은 분담이다.
 *
 * @returns 출발 전날·당일이면 `true`. 그 밖(여행 중 · 지난 일정 · 읽을 수 없는 날짜)은 `false`
 */
export function isPackingPromotionWindow(
  plan: Pick<PlanDetail, 'startDate' | 'endDate'>,
  today: Date,
): boolean {
  const phase = planPhaseOf(plan.startDate, plan.endDate, today)
  return phase?.kind === 'upcoming' && phase.days <= PACKING_PROMOTION_MAX_DAYS
}

/**
 * 준비물 카드가 서는 자리 (#732 · #665 의 갈래를 셋으로 넓힌다).
 *
 * | 값 | 뜻 |
 * |----|-----|
 * | `promoted` | 위 레일 — 창이 열렸고 **담을 것이 실제로 있다.** 요약 모드로 선다 |
 * | `strip` | 기본 자리 + 개요 아래 **한 줄 스트립**. 창은 열렸는데 목록이 비었다 |
 * | `default` | 기본 자리(일자 뒤). 창이 닫혔거나 아직 목록을 못 읽었다 |
 *
 * **비었을 때 올리지 않는 것이 이 함수가 생긴 이유다.** 빈 카드를 맨 위로 올리면 그날 이
 * 화면을 연 사람이 가장 먼저 만나는 것이 "아직 아무것도 없어요" 가 된다. 대신 한 줄
 * 스트립이 그 자리에서 **유도만** 한다 — 진입점은 남기고 면적은 주지 않는다.
 *
 * **`null` 은 "비었다" 가 아니라 "아직 못 읽었다" 다** (`PackingListPanel` 의 `list` 와 같은
 * 규약). 그때는 기본 자리를 지킨다 — 조회가 끝나기도 전에 스트립을 띄웠다가 목록이 도착해
 * 걷어내면, 화면이 한 번 더 흔들리기만 하고 알려 준 것이 없다.
 *
 * **`today` 는 주입받는다** (`isPackingPromotionWindow` 와 같은 분담).
 */
export type PackingPlacement = 'promoted' | 'strip' | 'default'

export function packingPlacement(
  plan: Pick<PlanDetail, 'startDate' | 'endDate'>,
  today: Date,
  /** 저장된 목록. **아직 못 읽었으면 `null`** — 빈 목록(`items: []`)과 다른 값이다 */
  list: PlanPackingListResponse | null,
): PackingPlacement {
  if (!isPackingPromotionWindow(plan, today)) return 'default'
  if (list === null) return 'default'

  return list.items.length > 0 ? 'promoted' : 'strip'
}
