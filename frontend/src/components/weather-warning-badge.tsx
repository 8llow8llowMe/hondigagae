import type { MetricTone } from '@/components/metric'
import { MetricBadge } from '@/components/metric'
import { cn } from '@/lib/utils/cn'
import type { WeatherWarningItem } from '@/types/insight'

/**
 * 발효 중인 기상특보 배지 (#158).
 *
 * **이 배지가 없어도 정보는 화면에 있다.** 서버가 판정 근거에 `WEATHER_WARNING_ACTIVE` 문장을
 * 함께 보내므로 `ReasonList` 가 이미 "폭염 경보 발효 중입니다…" 를 그린다. 이 배지는 그
 * 한 문장을 문단 밖으로 올리는 강조일 뿐이다 — **근거 목록을 대체하지 않는다.**
 *
 * **`Badge` 가 아니라 `MetricBadge` 를 쓴다.** `danger` 는 시스템 오류(5xx) 톤이고
 * `accent` 는 AI 생성 표시 전용이다 (DESIGN.md §2-5·§2-6). 기상특보는 둘 다 아니라
 * **판정 축의 위험 상태**라 등급과 같은 `--metric-*` 을 쓴다.
 */
export function WeatherWarningBadge({
  warning,
  className,
}: {
  warning: WeatherWarningItem | null
  // `exactOptionalPropertyTypes` — 그대로 넘기려면 undefined 를 명시해야 한다
  className?: string | undefined
}) {
  if (warning === null) return null

  return (
    // `MetricBadge` 의 className 이 undefined 를 받지 않는다 (`exactOptionalPropertyTypes`)
    <MetricBadge tone={warningTone(warning.level.code)} className={cn(className)}>
      {warning.type.name} {warning.level.name}
    </MetricBadge>
  )
}

/**
 * 특보 단계 → 톤.
 *
 * **모르는 코드는 경보로 읽는다.** 백엔드 `WeatherWarningLevel.from` 이 "경보" 를 먼저 보고
 * 못 알아봤을 때 낮은 쪽으로 접지 않는 것과 같은 이유다 — 표기가 바뀌었을 뿐인데 태풍경보를
 * 주의보 색으로 그리면 그 화면이 위험을 축소해 말한다.
 *
 * 주의보에 `low`(회색)를 쓰지 않는다. 그 톤은 "적합도 낮음 · 정보 없음" 쪽으로 읽혀
 * "조건이 나빠지고 있다" 는 뜻이 사라진다. `mid`(앰버)가 주의에 맞는 색이다.
 */
function warningTone(levelCode: string): MetricTone {
  return levelCode === 'ADVISORY' ? 'mid' : 'critical'
}
