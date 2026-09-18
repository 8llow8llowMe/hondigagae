'use client'

import { METRIC_TINT_TONE, METRIC_WORD_TONE } from '@/components/metric'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { formatCelsius } from '@/lib/format/celsius'
import { markGoldenWindow } from '@/lib/insight/golden-window'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_BLEED_END_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { HourlyWalkSafetyItem } from '@/types/insight'

/**
 * 시간대 곡선 — **홈 `WalkTimesSection` 에서 올라왔다** ([#626](https://github.com/8llow8llowMe/hondigagae/issues/626)).
 *
 * 출발 전 여행 브리핑(`/plans/{planId}/briefing`)이 같은 곡선을 그려야 하는데
 * **feature 간 직접 임포트는 금지**라(`architecture-guide.md` §3 — "공유가 필요하면
 * `src/lib/` 또는 `src/components/` 로 올린다`) 여기로 옮겼다. 복제하면 같은 곡선이 두
 * 벌이 되어 [#656](https://github.com/8llow8llowMe/hondigagae/issues/656) 처럼 한쪽만
 * 고쳐진다.
 *
 * **props 를 `WalkTimesResponse` 통째가 아니라 세 값으로 좁혔다.** 브리핑은 곡선만 이
 * 컴포넌트에 넘기고 **창·상태는 자기 응답(`PlanBriefingWalkTimes`)의 것을 쓴다** — 한
 * 질문에 한 곳이 답한다 (DESIGN.md §1). 두 값이 갈리는 경우(자정 경계·조건 차이)에
 * 화면이 두 답을 동시에 말하지 않게 하는 경계다.
 *
 * **문구 키는 `messages.home.*` 그대로 둔다** (명세 D8-3). 값이 같아 옮겨도 테스트는
 * 통과하지만 이 이슈가 얻는 것이 없고 홈 회귀 면만 넓어진다 — 공용 컴포넌트가 둘 이상
 * 생기면 그때 `messages.insight` 로 한 번에 옮긴다.
 *
 * ── 이하 주석은 홈에 있던 것을 그대로 옮긴 것이다 ──
 *
 * **가로 스크롤 한 줄이다.** 세로 목록으로 두면 8시간이 화면을 다 먹고, 곡선의 요점인
 * "언제부터 괜찮아지는가" 가 한눈에 안 들어온다.
 *
 * 셀마다 **시각 · 기온 · 막대 · 노면온도** 넷을 함께 둔다 (#269). 막대만 두면 색이 유일한
 * 정보가 되고, 두 온도가 이 판정의 실제 근거라 숫자로 보여야 사용자가 판단을 검증할 수 있다.
 *
 * **범례를 곡선 바로 아래 둔다.** 셀 안에는 라벨을 적을 자리가 없어 위치가 둘을 가르는데,
 * 그 위치가 무엇인지는 낱말이 말해야 한다. 섹션 맨 아래 캡션(`goldenPavementNote`)으로는
 * 부족했다 — 곡선과 캡션 사이에 다른 줄이 끼어 숫자와 이어 읽히지 않는다.
 */
export function WalkTimesCurve({
  hourly,
  goldenStart,
  goldenEnd,
}: {
  hourly: readonly HourlyWalkSafetyItem[]
  /** 추천 구간. **호출부 응답의 값이다** — 이 컴포넌트가 다시 판정하지 않는다 */
  goldenStart: string | null
  goldenEnd: string | null
}) {
  // 훅은 early return 보다 위다 — 곡선이 비는 날과 아닌 날의 훅 순서가 달라지면 안 된다
  const rail = useScrollRail<HTMLUListElement>()

  /*
    추천 구간 표시 (#312). **문장이 가리키는 시각을 곡선에서도 짚는다** — 위에서
    `17:00 – 23:00` 을 추천해 놓고 아래 셀 중 어느 것이 그 구간인지 표시가 없어,
    시각을 하나씩 대조해야 문장과 그림이 이어졌다.

    **면의 색은 이제 칸마다의 등급이다** ([#656](https://github.com/8llow8llowMe/hondigagae/issues/656)).
    #312 는 구간 전체를 `goldenLevel` 한 톤으로 칠하면서 *"칸마다 색이 갈리면 면이 아니라
    줄무늬가 된다"* 고 적었는데, 그 판단이 틀린 것으로 드러났다 — `11:00 – 23:00` 창 안에서
    14 · 15시만 주의였던 날(2026-09-15 dev 실측) 면은 그 사실을 한 번도 말하지 못했다.
    **한 톤이 감춘 것은 줄무늬가 아니라 구간 안의 차이였다.**

    #637 이 같은 사실을 헤드라인 아래 문장으로 옮겼다. 면도 같은 말을 해야 문장과 그림이
    어긋나지 않는다 — 문장이 `14–15시는 … 주의` 라고 적는데 면이 내내 한 색이면, 이 섹션이
    두 번 겪은 실패(곡선과 문장이 서로 다른 말을 한다, #270)가 다시 난다.

    **줄무늬 걱정은 칸 간격이 이미 막는다.** 칸 사이를 `gap` 이 아니라 셀 안쪽 padding 으로
    주므로 같은 등급이 이어지는 칸은 tint 가 정확히 맞닿아 한 면이 된다 — 색이 갈리는 자리에만
    경계가 생기고, 그 경계가 곧 "여기서 등급이 바뀐다" 는 정보다.

    `goldenLevel` 은 이제 곡선에서 쓰지 않는다. 헤드라인 시각의 색으로만 남는다.
  */
  const marks = markGoldenWindow(hourly, goldenStart, goldenEnd)

  // 판정 자리의 상태 문구가 이미 말했다 — 같은 문장을 두 번 두지 않는다 (#204)
  if (hourly.length === 0) return null

  return (
    /*
      **행 라벨 열 + 스크롤러.** 라벨을 스크롤러 *바깥* 형제로 둔다 — 안에 `sticky` 로
      넣으면 마스크가 왼쪽 24px 를 투명하게 지우면서 라벨까지 흐린다. 그것을 피하려면
      왼쪽 그라데이션과 "이전" 화살표를 포기해야 해서, 바깥에 두는 쪽을 골랐다.

      대신 두 열이 각자 행 높이를 갖는다. **`RowLabels` 는 `HourCell` 의 구조를 그대로
      미러링해야 한다** — 같은 `gap-1.5`, 같은 `text-caption` 줄, 같은 `h-8` 막대 자리.
      한쪽만 고치면 라벨이 숫자와 어긋난 줄에 선다. 둘을 붙여 둔 이유다.
    */
    <div className="flex items-start gap-2">
      <RowLabels />

      {/*
        **`scroll-rail` 은 화살표의 기준면이다** (`app/globals.css`). 화살표를 `<ul>` 안에
        넣으면 마스크가 화살표까지 흐리고 내용과 같이 스크롤돼 제자리에 남지 않는다
        (`ScrollRailArrows` 주석).

        **`relative` 만 주면 안 된다** — 안쪽 스크롤러의 내용 폭이 조상의 `scrollWidth` 로
        새어 `main` 이 390 → 630 이 된다. 그 클래스가 `contain: layout` 을 함께 건다.

        **넘침은 오른쪽뿐이다** (`INSET_BLEED_END_CLASS`). 왼쪽에는 라벨 열이 서 있어
        파고들 자리가 없다.
      */}
      <div className="scroll-rail min-w-0 flex-1">
        <ul
          ref={rail.ref}
          onScroll={rail.onScroll}
          className={cn(
            /*
              **칸 사이 간격을 `gap` 이 아니라 셀 안쪽 padding 으로 준다** (#312).
              `gap` 이면 추천 구간의 tint 면이 칸마다 끊겨 면이 아니라 줄무늬로 읽힌다.
              padding 은 배경이 함께 칠해지므로 이웃한 칸의 면이 정확히 맞닿는다.
              간격은 6 → 8 이 된다. 3px 씩 나눠 6 을 유지하려면 스케일 밖 값이 되고
              (DESIGN.md §4 — arbitrary value 금지), 8 은 스케일 안 값이다.
            */
            'flex overflow-x-auto',
            INSET_BLEED_END_CLASS.card,
            // 스크롤바 자리는 fade 와 화살표가 대신한다 (`app/globals.css`)
            'scrollbar-none',
            rail.fadeClassName,
          )}
        >
          {hourly.map((hour, index) => (
            <HourCell key={hour.at} hour={hour} inGoldenWindow={marks[index]?.inWindow ?? false} />
          ))}
        </ul>

        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.home.goldenCurvePrev}
          nextLabel={messages.home.goldenCurveNext}
        />
      </div>
    </div>
  )
}

/**
 * 곡선 왼쪽의 고정 행 라벨 — **범례를 대신한다.**
 *
 * 예전에는 곡선 아래 한 줄(`위는 기온 · 아래는 노면(아스팔트)`)로 위치를 설명했다.
 * 그 줄을 읽고 다시 위로 올라와 대응시켜야 했고, 셀 안에서 두 숫자를 가르는 채널은
 * 색 하나뿐이었다 (DESIGN.md §2-3 — 색이 유일한 채널이면 안 된다).
 *
 * **`aria-hidden` 이다.** 같은 낱말이 셀마다 `sr-only` 로 이미 붙어 있다 — 스크린리더는
 * 셀을 선형으로 읽으므로 바깥 라벨과 묶이지 않고, 그대로 두면 낱말이 두 번 들린다.
 *
 * **`HourCell` 과 같은 리듬으로 쌓는다.** 시각 자리(빈 줄) → 기온 → 노면. 한쪽 구조가
 * 바뀌면 다른 쪽도 같이 바꾼다 — 예전에 있던 `h-8` 막대 자리는 막대와 함께 걷었다 (#312).
 */
function RowLabels() {
  return (
    <div
      aria-hidden
      className="text-caption text-fg-muted flex shrink-0 flex-col gap-1.5 pt-0 font-medium"
    >
      {/* 시각 줄 자리. 라벨이 없지만 높이는 차지해야 아래 두 낱말이 숫자와 같은 줄에 선다 */}
      <span aria-hidden>&nbsp;</span>
      <span>{messages.home.goldenCurveRowTemperature}</span>
      <span>{messages.home.goldenCurveRowPavement}</span>
    </div>
  )
}

/**
 * 한 시각 — **시각 · 기온 · 막대 · 노면온도** ([#269](https://github.com/8llow8llowMe/hondigagae/issues/269)).
 *
 * **예전에는 숫자가 하나뿐이었다.** 노면온도만 찍혀 있어 사용자가 그것을 기온으로 읽었다 —
 * 기온 29℃ 인 날 `56.0℃` 를 보고 "온도가 잘못된 것 같다" 는 제보가 실제로 왔다. 값도
 * 계산도 정상이었고, **그 값이 무엇인지가 전달되지 않은 것**이다. `temperature` 는 응답에
 * 이미 있었는데 화면이 버리고 있었다.
 *
 * 둘을 나란히 두면 **"기온은 괜찮은데 지면이 뜨겁다"** 는 이 서비스의 요점이 그대로 간다.
 *
 * **위치가 둘을 가른다.** 3rem 폭에 `기온 29℃` 는 들어가지 않고 줄을 나누면 여러 줄짜리
 * 셀이 되어 가로 한 줄이라는 이 곡선의 성격이 사라진다. 그래서
 *  - **눈으로는** 위치(위=기온, 아래=노면)와 왼쪽 고정 행 라벨(`RowLabels`)
 *  - **보조기기에는** 낱말(`기온` · `추정 노면(아스팔트) 온도` · 등급 이름)
 *
 * 자리와 색만으로 전달하지 않는다 (DESIGN.md §2-3) — 두 채널이 같은 사실을 말한다.
 *
 * **세로 막대를 걷었다** (#312). `h-8 w-2` 고정이라 길이가 변하지 않으면서 막대의 형태를
 * 하고 있었고, 그 색은 추천 구간 표시로 옮겼다 — 이 칸의 tint 면이 그것이다.
 */
function HourCell({
  hour,
  inGoldenWindow,
}: {
  hour: HourlyWalkSafetyItem
  /** 이 칸이 서버가 추천한 구간에 드는가 (`markGoldenWindow`) */
  inGoldenWindow: boolean
}) {
  const tone = walkSafetyTone(hour.walkSafetyLevel.code)
  const temperature = formatCelsius(hour.temperature)
  const pavement = formatCelsius(hour.estimatedPavementCelsius)

  return (
    <li
      className={cn(
        // 두 칸이 맞닿아 8px 이 된다 — 스케일 안 값이다 (DESIGN.md §4: 4 · 6 · 8 …)
        'flex shrink-0 flex-col items-center gap-1.5 px-1 py-1',
        /*
          **추천 구간 tint 면 — `-100` 층이다** (#312). 예전에는 이 색이 `-500` 층 세로
          막대에 있었다. 면은 12px 숫자의 배경이 되므로 텍스트 대비 규칙에 걸린다 —
          `-500` 이 아니라 tint 층이다 (DESIGN.md §2-3).

          **톤은 이 칸의 등급에서 온다** (#656). 예전에는 구간 전체가 `goldenLevel` 한
          톤이라, 창 안에서 시각별로 안전도가 갈리는 것이 면에 나타나지 않았다.

          **표를 여기서 만들지 않는다.** 등급 톤 → 클래스 표는 `components/metric.tsx` 가
          갖는다 (이슈 #68 — 복제하면 등급 색 하나를 고칠 때 화면마다 갈린다). 등급을
          모르는 칸이 중립 면(`--band`)을 받는 근거도 그 표의 주석에 있다.

          **점선을 쓰지 않는다.** 장소 상세 혼잡도의 `점선은 아직 모르는 날이에요` 는
          **그릴 막대가 없는** 칸의 표기인데, 여기 칸에는 기온·노면 숫자가 그대로 있고
          모르는 것은 등급 하나뿐이다. 점선 테두리를 칸마다 두르면 **모르는 칸이 이어질 때
          그 사이에 선이 생겨** 바로 아래 규칙과 정면으로 어긋나기도 한다.

          라운드를 주지 않는다 — 목록·섹션에 라운드가 없다 (DESIGN.md §0). **여기서는 그것이
          면을 잇는 조건이기도 하다**: 모서리를 깎으면 같은 등급이 이어지는 칸 사이에 흰 틈이
          생겨 한 면으로 안 읽힌다.
        */
        inGoldenWindow && METRIC_TINT_TONE[tone],
      )}
      // 3rem(칸) + 8px(안쪽 여백). 예전 피치(48 + gap 6)보다 칸당 2px 넓다
      style={{ minWidth: '3.5rem' }}
    >
      <span className="text-caption text-fg-muted font-medium tabular-nums">
        {hourOnly(hour.at)}
      </span>

      {/*
        **기온에는 톤을 주지 않는다.** 사람이 외출을 정할 때 먼저 보는 값이지만 등급을
        가르는 것은 아래 노면온도이고, 두 숫자가 다 색을 가지면 무엇이 판정인지 흐려진다.
      */}
      <span className="text-caption text-fg font-medium tabular-nums">
        <span className="sr-only">{messages.home.temperatureLabel} </span>
        {temperature === null ? '—' : `${temperature}℃`}
      </span>

      {/*
        **등급 색이 노면 숫자로 내려왔다** (#312). 걷어낸 막대가 갖고 있던 정보다 —
        `-700` 층이라 12px 글자에 써도 대비가 선다 (`METRIC_WORD_TONE`, DESIGN.md §2-3).

        **색이 유일한 채널이 아니다.** 무엇의 온도인지는 왼쪽 행 라벨이 낱말로 말하고,
        등급 이름은 아래 `sr-only` 가 보조기기에 그대로 전한다.
      */}
      <span className={cn('text-caption font-medium tabular-nums', METRIC_WORD_TONE[tone])}>
        <span className="sr-only">{messages.home.pavementLabel} </span>
        {pavement === null ? '—' : `${pavement}℃`}
      </span>

      {/*
        막대와 함께 사라질 뻔한 낱말이다. 화면에서는 tint 면과 숫자가 말하지만 둘 다
        스크린리더에는 아무 말도 하지 못한다.
      */}
      <span className="sr-only">{hour.walkSafetyLevel.name}</span>
    </li>
  )
}

/** `2026-08-29T18:00:00` → `18시` */
function hourOnly(at: string): string {
  return `${at.slice(11, 13)}시`
}
