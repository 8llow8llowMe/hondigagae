import { splitReasons } from '@/lib/insight/reasons'
import type { CongestionItem, SuitabilityReasonItem } from '@/types/insight'

/**
 * 홈 추천 장소 카드의 순수 규칙 (#1069).
 *
 * 카드(`place-insight-card.tsx`)는 받은 값만 그리고, **무엇을 한 줄로 고를지 · 끝 카드를
 * 세울지** 는 여기서 정한다 — 렌더 분기가 아니라 판정이라 함수 단위로 잠근다.
 */

/**
 * 카드 한 장에 붙는 **그 장소만의 근거 한 줄.**
 *
 * 입력은 이미 전 카드 공통 문장을 뺀 것이다 (`splitSharedReasons` — 목록을 가진 쪽만 무엇이
 * 공통인지 안다). 남은 것 중 **감점이 먼저**, 그 안에서는 **서버 순서**다 — `reasons` 는
 * 영향이 큰 순서로 오고 그 순서가 곧 중요도다(`splitReasons`). 감점끼리 `scoreDelta` 로
 * 다시 세우지 않는다: 산식이 공개되지 않아 숫자를 읽을 근거가 없다 (홈-세부명세 D8-2).
 *
 * **문장은 서버 `description` 그대로이고 자르지 않는다.** 한 줄만 고르는 것이지 한 줄로
 * 줄이는 것이 아니다.
 *
 * 경보 날처럼 근거가 전부 공통이면 **`null`** — 카드에 근거 줄이 붙지 않는 것이 정상이다.
 */
export function pickCardReason(
  reasons: readonly SuitabilityReasonItem[],
): SuitabilityReasonItem | null {
  const { penalties, informational } = splitReasons([...reasons])

  return penalties[0] ?? informational[0] ?? null
}

/** 혼잡도 `HIGH` — tour-service `CongestionLevel` (`lib/insight/tone.ts` 표) */
const CROWDED_CODE = 'HIGH'

/**
 * 판정 줄 끝의 `· 혼잡` — **혼잡할 때만** 서버 문구를 돌려준다.
 *
 * 한산·보통·정보 없음은 카드에서 말하지 않는다. 행 시절에는 혼잡도를 늘 배지로 세웠는데
 * (`혼잡도 정보 없음` 까지), 카드는 **판정을 바꾸는 조건**만 남긴다 — 붐비는 날은 가도 되는지
 * 다시 생각하게 하지만, 한산하다는 말은 점수가 이미 한다.
 *
 * **`code` 로 가르고 문구는 서버 `name` 이다** (api-integration-guide.md §6). 코드 → 한국어
 * 표를 FE 에 두지 않는다.
 */
export function crowdedLabel(congestion: CongestionItem | null): string | null {
  if (congestion === null || congestion.level.code !== CROWDED_CODE) return null

  return congestion.level.name
}

export type PlaceCardsEnd = {
  /** 장소 목록 전체 수 — `장소 {n}곳 전체 보기` */
  total: number
  /** 점수를 내지 못해 카드로 서지 않은 수. 0 이면 안내 줄이 없다 */
  unscored: number
  /**
   * 그리드에서 차지할 칸 수 — **남은 빈 칸 전부**다. 카드가 한 장이면 빈 칸이 둘이라, 한 칸만
   * 차지하면 셋째 칸이 흰 구멍으로 남는다 (1440 실측). 캐러셀은 이 값을 쓰지 않는다.
   */
  span: number
}

/**
 * 끝 카드를 세울지 — **카드가 칸을 다 채우지 못했을 때만** 선다.
 *
 * 추천이 3곳 미만이면 그리드에 빈 칸이 남는다. 그 칸을 `장소 N곳 전체 보기` 가 채우고,
 * 점수를 못 낸 곳의 안내도 여기에 든다 — 예전 목록 아래 버튼 줄 둘(`점수를 내지 못한 곳` ·
 * `전체 보기`)이 이 한 장으로 합쳐진다. **3곳이 다 차면 끝 카드가 없다** — 목록 머리의
 * `장소 찾기` 가 그 몫을 맡는다.
 *
 * **캐러셀도 같은 규칙이다.** 칸은 그리드의 개념이지만 두 틀이 같은 카드 묶음을 담아야
 * 폭을 바꿀 때 카드가 생겼다 사라지지 않는다.
 *
 * 점수를 낸 곳이 하나도 없어도 선다 — 점수 못 낸 곳을 지우면 사용자는 그 장소가 조회되지
 * 않았다는 것조차 모른다 (#428). 카드도 점수 못 낸 곳도 없는 날은 호출부의 빈 상태다.
 */
export function placeCardsEnd({
  cards,
  unscored,
  total,
  capacity,
}: {
  /** 카드로 선 수(점수를 낸 곳) */
  cards: number
  unscored: number
  total: number
  /** 한 줄에 서는 칸 수 — 홈은 `TOP_PLACE_COUNT` */
  capacity: number
}): PlaceCardsEnd | null {
  if (cards >= capacity) return null

  return { total, unscored, span: capacity - cards }
}
