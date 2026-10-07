import {
  CloudIcon,
  PartlyCloudyIcon,
  RainIcon,
  SleetIcon,
  SnowIcon,
  SunIcon,
} from '@/components/icons'
import type { WeatherGlyphResolution, WeatherIconKind } from '@/lib/insight/weather-icon'
import { cn } from '@/lib/utils/cn'

/** 그림 종류 → 컴포넌트. 이 표에 없는 종류는 `resolveWeatherGlyph` 가 만들지 않는다 */
const WEATHER_ICONS: Record<WeatherIconKind, typeof SunIcon> = {
  sun: SunIcon,
  'partly-cloudy': PartlyCloudyIcon,
  cloud: CloudIcon,
  rain: RainIcon,
  snow: SnowIcon,
  sleet: SleetIcon,
}

/**
 * 그림 종류 → 색 — `DESIGN.md` §9-1 (2026-09-09 결정) (#342).
 *
 * **등급 색이 아니다.** `--weather-*` 는 하늘상태·강수형태 전용 축이고 점수·판정은
 * `--metric-*` 가 소유한다. 두 축을 섞지 않는다.
 *
 * **흐림(`cloud`)만 색이 없다** — 부모의 `--fg-muted` 를 물려받는다. 회색 구름이
 * 관습색이라 칠할 색이 따로 없고, 해가 안 보이는 것을 앰버로 그리면 틀린 그림이 된다.
 */
const WEATHER_COLORS: Record<WeatherIconKind, string> = {
  sun: 'text-weather-sun',
  'partly-cloudy': 'text-weather-sun',
  cloud: '',
  rain: 'text-weather-rain',
  sleet: 'text-weather-rain',
  snow: 'text-weather-snow',
}

/**
 * 날씨 그림 — `DESIGN.md` §9-1 (2026-09-08 결정) (#314). 홈 권역 칸에서 시작해 지도 미리보기의
 * 판정 카드(#1233)가 함께 쓴다 — 같은 하늘을 두 화면이 다른 그림으로 그리지 않게 여기 둔다.
 *
 * **선 아이콘이다.** §9-1 이 이모지도 허용하지만 *"한 화면에서 이모지와 선 아이콘을 섞지
 * 않는다"* 고 못박았고, 홈에는 이미 선 아이콘만 서 있다 (병원 배너 · 시계 · 셰브론).
 * 이 자리에만 이모지를 두면 그 규칙을 이 화면이 어긴다.
 *
 * **날씨 전용 색을 쓴다** (#342). `--weather-*` 는 등급(`--metric-*`)과 다른 축이다 —
 * #314 는 배지와 같은 축으로 읽힐 것을 걱정해 무채색으로 갔지만, 다섯 칸을 훑을 때
 * 비 오는 권역을 찾는 것이 이 자리의 용도라 색이 그 일을 한다. 흐림만 색이 없다.
 *
 * **`sr-only` 로 서버 `name` 을 남긴다.** 아이콘은 스크린리더에 아무 말도 못 한다.
 *
 * **숫자를 대체하지 않는다.** 아이콘이 대신하는 것은 낱말(`맑음`)이지 `24–31℃` ·
 * `강수 0%` 같은 측정값이 아니다 (§9-1).
 */
export function WeatherGlyph({
  glyph,
  size = 24,
}: {
  glyph: WeatherGlyphResolution
  /** 24 = 홈 권역 칸(줄 왼쪽의 독립 자리), 20 = 지도 미리보기 근거 줄(#1233 — 아이콘 행 조밀) */
  size?: 20 | 24
}) {
  // 그림이 없는 코드는 서버 낱말을 그대로 적는다 — 빈 자리로 두지도, 틀린 그림을 그리지도 않는다
  if (glyph.kind === null) return <span>{glyph.name}</span>

  const Icon = WEATHER_ICONS[glyph.kind]

  /*
    **기본 24px 이다** (§9 "24px 기본"). 16px 인라인이던 것을 키웠다 — 값 줄 안에 흐르는
    글자가 아니라 줄 왼쪽의 독립된 자리다. 아이콘 행이 조밀한 자리는 20(§9 "20px 조밀").
  */
  return (
    <span className={cn('inline-flex shrink-0 items-center', WEATHER_COLORS[glyph.kind])}>
      <Icon size={size} />
      <span className="sr-only">{glyph.name}</span>
    </span>
  )
}
