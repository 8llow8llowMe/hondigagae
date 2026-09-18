import type { MetricBadgeSurface } from '@/components/metric'
import { MetricBadge } from '@/components/metric'
import { weatherWarningTone } from '@/lib/insight/tone'
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
 *
 * **단계 → 톤 매핑은 `lib/insight/tone.ts` 가 갖는다** (#709). 스트립이 같은 매핑으로 면을
 * 칠하게 되면서 이 파일 안에 두면 같은 특보의 배지와 면이 갈릴 수 있게 됐다.
 */
export function WeatherWarningBadge({
  warning,
  surface,
  className,
}: {
  warning: WeatherWarningItem | null
  /**
   * 같은 톤의 `-100` 면 위에 설 때 `tint` 를 준다 — 홈 특보 스트립이 그 자리다.
   * 안 주면 `--bg` 위 기본 채움이다 (`MetricBadge` 의 `surface`).
   */
  // `exactOptionalPropertyTypes` — 그대로 넘기려면 undefined 를 명시해야 한다
  surface?: MetricBadgeSurface | undefined
  className?: string | undefined
}) {
  if (warning === null) return null

  return (
    // `MetricBadge` 의 className 이 undefined 를 받지 않는다 (`exactOptionalPropertyTypes`)
    <MetricBadge
      tone={weatherWarningTone(warning.level.code)}
      surface={surface ?? 'default'}
      className={cn(className)}
    >
      {warning.type.name} {warning.level.name}
    </MetricBadge>
  )
}
