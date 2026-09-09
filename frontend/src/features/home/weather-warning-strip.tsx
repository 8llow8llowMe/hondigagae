import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import type { WeatherWarningItem } from '@/types/insight'

/**
 * 발효 중인 기상특보 — **홈에 한 번만 선다** (#349).
 *
 * 예전에는 판정 · 골든타임 · 권역 세 섹션이 각자 `WeatherWarningBadge` 를 그렸다. 그런데
 * 세 값은 **같을 수밖에 없다** — 백엔드가 제주 전역 단일 지점(184)에서 가장 무거운 특보
 * 하나를 골라 네 응답에 함께 실어 보낸다 (`pickWeatherWarning`). 같은 사실을 세 번 말하는
 * 동안 늘어난 것은 정확성이 아니라 소음이었다.
 *
 * > GOV.UK Design System — Notification banner: _"Avoid showing more than one notification
 * > banner on the same page… only show the highest priority notification banner."_ /
 * > _"Use notification banners sparingly. There's evidence that people often miss them, and
 * > using them too often is likely to make this problem worse."_ **자주 보일수록 덜 읽힌다.**
 *
 * **`rail-layout` 위, 페이지 최상단이다.** 특보는 제주 전역의 사실이라 어느 한 열에 속하지
 * 않는다. 그리고 여기가 **유일하게 항상 뜨는 자리**다 — 판정 섹션은 기준 장소가 없으면
 * 렌더되지 않고(`resolveBasisPlaceId`), 그때 배지를 그 안에만 두었으면 첫 방문자는 특보를
 * 어디서도 못 본다. 예전에 권역 배지가 그 구멍을 막고 있었다.
 *
 * **문구를 FE 가 쓰지 않는다.** 배지는 `type.name` + `level.name`, 옆 문장은
 * `level.description` 이고 둘 다 서버 값이다 (`docs/styling-guide.md` §7).
 *
 * **`type.description` 이 아니라 `level.description` 이다.** 판정 근거의
 * `WEATHER_WARNING_ACTIVE` 문장이 서버에서 `"{type} {level} 발효 중입니다. {type.description}"`
 * 로 조립되므로, 여기에 `type.description` 을 쓰면 같은 화면에서 그 꼬리를 두 번 말하게 된다 —
 * 이 이슈가 없앤 바로 그 모양이다. `level.description` 은 그 문장에 들어가지 않고, 단계가
 * 뜻하는 **조치**를 말한다(경보: "야외 일정은 취소하는 것이 좋습니다" / 주의보: "일정을
 * 조정하는 편이 좋습니다"). 종류가 무엇인지는 근거가, 그래서 어떻게 하라는지는 여기가 맡는다.
 *
 * **밴드가 아니라 1px 선으로 끝낸다.** 아래 두 열은 다른 이야기의 시작이 아니라 이 사실을
 * 전제로 읽는 본문이다 (DESIGN.md §0).
 *
 * **`role="alert"` 를 주지 않는다.** 페이지 로드 시점에 이미 있는 내용이라 라이브 리전이
 * 아니고, alert 로 두면 스크린리더가 읽던 것을 끊는다.
 */
export function WeatherWarningStrip({ warning }: { warning: WeatherWarningItem | null }) {
  // 특보가 없는 날이 압도적으로 흔하다 — 그때 빈 줄을 남기지 않는다
  if (warning === null) return null

  return (
    /*
      **바는 전폭, 안쪽만 캡이다** (#376) — `GlobalHeader` 와 같은 구조다.
      `border-b` 는 페이지를 가로지르는 경계라 캡하면 헤더 구분선보다 짧아져 어긋난다.
      안쪽 줄은 `.content-container` 로 본문(`.rail-layout`)과 같은 세로선에 선다.
    */
    <section aria-label={messages.home.warningStripLabel} className="border-border border-b">
      <div
        className={`content-container flex flex-wrap items-center gap-x-2 gap-y-1 py-3 ${INSET_CLASS.main}`}
      >
        <WeatherWarningBadge warning={warning} />
        {warning.level.description !== null && (
          <p className="text-body-2 text-fg break-keep">{warning.level.description}</p>
        )}
      </div>
    </section>
  )
}
