import type { WalkSafetyReasonItem, WeatherWarningItem } from '@/types/insight'

/** 서버가 특보를 판정 근거로 조립할 때 쓰는 코드 (`"{type} {level} 발효 중입니다. …"`) */
const WARNING_REASON_CODE = 'WEATHER_WARNING_ACTIVE'

/**
 * 홈 판정 카드의 근거에서 **특보 줄만** 뺀다 (#1065).
 *
 * **홈에서만 쓴다.** DESIGN.md §1(#349)은 "종류는 근거가, 행동은 배지 줄이" 맡도록 나눠
 * 두었는데, 홈은 최상단 `WeatherWarningStrip` 이 배지(`폭염 경보`)로 **종류까지** 이미 말하고
 * 판정 카드가 바로 아래라 같은 사실이 한눈에 두 번 보였다. 줄의 나머지("노면이 뜨거워 …")도
 * 다음 근거(아스팔트 58도)와 겹친다. 장소 상세는 패널마다 자기 배지를 그리는 구조라 그대로다.
 *
 * **서버 문장은 고치지 않는다 — 표시만 거른다.** 다른 소비처(장소 상세 · 일정)는 같은 문장을
 * 그대로 받는다.
 *
 * **코드 하나로 거른다.** `splitSharedReasons` 가 "코드를 나열하지 않는다" 고 한 것은 목록에서
 * **남길 것**을 코드로 고르면 서버가 새 코드를 낼 때 조용히 새기 때문이다. 여기는 반대로
 * **뺄 것 하나**를 고르므로, 서버가 새 특보 코드를 내면 그 줄은 **보인다** — 틀려도 정보를
 * 숨기는 쪽이 아니라 한 번 더 말하는 쪽으로 틀린다.
 *
 * **같은 응답의 `weatherWarning` 이 없으면 거르지 않는다.** 뺄 근거가 "위 띠가 이미 말한다"
 * 하나라, 그 전제가 서지 않는 날 줄을 지우면 특보가 화면 어디에도 없게 된다.
 */
export function withoutWarningReason(
  reasons: readonly WalkSafetyReasonItem[],
  warning: WeatherWarningItem | null,
): WalkSafetyReasonItem[] {
  if (warning === null) return [...reasons]

  return reasons.filter((reason) => reason.code !== WARNING_REASON_CODE)
}
