import type { ReactNode } from 'react'

import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 등급 표시 — DESIGN.md §2-3.
 *
 * **FE 는 색만 매핑하고 문구는 서버 값(`name`)을 쓴다.** 한국어 매핑 테이블을 만들지
 * 않는다 (api-integration-guide.md §6).
 *
 * **code → tone 매핑을 여기 두지 않는다.** 축마다 코드 체계가 다르고 의미가 뒤집히기
 * 때문이다 — 혼잡도의 `LOW` 는 "한산"(좋음)이고 적합도의 `LOW` 는 "주의 필요"(나쁨)다.
 * 공용 매퍼 하나를 쓰면 "혼잡" 이 초록으로 나간다. 축별 매퍼는
 * `src/lib/insight/tone.ts` 에 있고, **호출부가 톤을 계산해 넘긴다**.
 */

export type MetricTone = 'critical' | 'high' | 'mid' | 'low' | 'unknown'

/**
 * 배지가 말하는 **축**. 붙이면 등급어 앞에 축 이름이 선다 — `적합도 보통` · `혼잡도 보통`.
 *
 * **자유 문자열이 아니라 유니온이다.** 축이 하나 늘 때 타입이 전 호출부를 가리켜야 하고,
 * `grep` 로 전수 확인이 되어야 한다.
 *
 * **두 축뿐인 이유는 충돌하는 어휘가 둘뿐이기 때문이다** (#652 · 진단 G-1·D-2). 적합도
 * `MEDIUM` 과 혼잡도 `MODERATE` 가 둘 다 `보통` 이라, 장소 상세 이름 옆 배지가 어느 축인지
 * 화면에 단서가 없었다 — 390 실측에서 문구·폭(38.74px)·tint·글자색이 전부 같았다.
 * 산책 안전(`안전·주의·위험`)·기상특보(`폭염 경보`)·속성 배지(`실내 여부 미확인`)는
 * 충돌 상대가 없거나 문구가 이미 축을 말하므로 **붙이지 않는다**
 * (`docs/features/공통/등급배지-축라벨-세부명세.md` D5 가 호출부 17곳을 전수로 갖는다).
 *
 * **`walkSafety` 는 세 번째 예외다** (#625 · 일정상세-세부명세 D15-10 미결 1). 일정 항목
 * 행에는 `#652`·장소 상세가 기댔던 "바로 위 `지금 산책` 제목" 이 없어서, `10:30 주의
 * 천지연폭포` 처럼 축 없는 등급어가 시각·장소 이름 사이에 낀다 — 스크린리더가 무엇이
 * 주의인지 말하지 못한다. **이 호출부(`plan-item-row.tsx`)에만 쓴다** — 제목이 이미 축을
 * 세운 기존 두 호출부(`about/verdict-specimen.tsx` · 장소 상세)는 그대로 둔다.
 */
export type MetricAxis = 'suitability' | 'congestion' | 'walkSafety'

/**
 * 축 → 라벨. **어휘 표이지 code→tone 매핑이 아니다** — 이 파일이 code 를 해석하지 않는다는
 * 규칙은 그대로다. 문구는 `messages` 에서 읽는다 (컴포넌트 안에 한국어 리터럴을 두지 않는다).
 */
const METRIC_AXIS_LABEL: Record<MetricAxis, string> = {
  suitability: messages.common.metricAxisSuitability,
  congestion: messages.common.metricAxisCongestion,
  walkSafety: messages.common.metricAxisWalkSafety,
}

/**
 * tint 배경 + `-700` 텍스트. `-500` 을 텍스트에 쓰면 대비가 무너진다.
 * unknown 에는 tint 를 주지 않는다 — 점선 테두리만이다 (DESIGN.md §2-3).
 */
const BADGE_TONE: Record<MetricTone, string> = {
  critical: 'bg-metric-critical-100 text-metric-critical-700',
  high: 'bg-metric-high-100 text-metric-high-700',
  mid: 'bg-metric-mid-100 text-metric-mid-700',
  low: 'bg-metric-low-100 text-metric-low-700',
  unknown: 'border border-dashed border-border-strong text-fg-muted',
}

/**
 * **같은 톤의 tint 면 위에 선 배지** — 면과 채움을 맞바꾼다
 * ([#709](https://github.com/8llow8llowMe/hondigagae/issues/709)).
 *
 * `BADGE_TONE` 은 배지가 `--bg` 위에 선다고 전제한다. 그 배지를 **자기와 같은 `-100` 면**
 * 위에 얹으면 채움과 배경이 같은 색이 되어 **대비 1.00:1** 이다 — 배지가 사라지고 글자만
 * 남는다. 홈 특보 스트립이 정확히 그 자리다 (면도 뱃지도 `--metric-mid-100`).
 *
 * 그래서 **뒤집는다**: 채움은 `--bg`, 테두리는 `-500`, 글자는 `-700`.
 *
 * | 확인한 값                        | mid      | critical |
 * | -------------------------------- | -------- | -------- |
 * | `-700` 글자 ↔ 흰 배지 면 (4.5:1) | 5.64:1   | 5.20:1   |
 * | `-500` 테두리 ↔ tint 면 (3:1)    | 3.53:1   | 3.97:1   |
 *
 * 둘 다 `BADGE_TONE` 이 tint 위에서 내는 값(5.16 · 4.55)보다 **오른다** — 뒤집기가 대비를
 * 깎지 않는다. `-500` 을 테두리에 쓰는 것은 §2-3 이 그 층에 준 역할 그대로다
 * (`-500` = 흰 배경 위 마크·**테두리**·큰 숫자).
 *
 * **`-500` 을 채움으로 쓰고 흰 글자를 얹는 안은 기각했다.** 그 층은 비텍스트 3:1 기준으로
 * 고른 것이라 글자를 얹지 않는 것이 §2-3 이다.
 *
 * **`unknown` 은 뒤집을 것이 없다** — 원래 채움이 없고 점선 테두리뿐이라 tint 위에서도 그대로
 * 읽힌다. 면만 `--bg` 로 채워 tint 에서 떼어 놓는다.
 */
const BADGE_TONE_ON_TINT: Record<MetricTone, string> = {
  critical: 'bg-bg border-metric-critical-500 text-metric-critical-700',
  high: 'bg-bg border-metric-high-500 text-metric-high-700',
  mid: 'bg-bg border-metric-mid-500 text-metric-mid-700',
  low: 'bg-bg border-metric-low-500 text-metric-low-700',
  unknown: 'bg-bg border border-dashed border-border-strong text-fg-muted',
}

/** 배지가 앉는 면. `tint` 는 **같은 톤의 `-100` 면** 위를 뜻한다 (`BADGE_TONE_ON_TINT`) */
export type MetricBadgeSurface = 'default' | 'tint'

const BADGE_SURFACE: Record<MetricBadgeSurface, Record<MetricTone, string>> = {
  default: BADGE_TONE,
  tint: BADGE_TONE_ON_TINT,
}

/**
 * `sm` · `md` 는 `Badge` 와 **같은 값**이다 (`src/components/badge.tsx`).
 *
 * 두 배지가 한 줄에 나란히 서는 곳이 있다 — 장소 행의 `동반 가능` `문화시설`(속성) 옆에
 * `실내 여부 미확인`(등급 unknown). 높이가 다르면 그 줄이 어긋나 보인다.
 *
 * **`score` 만 그 짝에서 빠진다** (#412). 이 크기는 **숫자만 담는 배지**를 위한 것이고,
 * 지금 쓰는 곳은 홈 권역 행의 `weatherScore` 하나다 — 나머지 `MetricBadge` 는 전부
 * 서버 문구(`suitabilityLevel.name` · 혼잡도 `name` · `실내 여부 미확인`)를 담는다.
 *
 * **12px 였던 것을 8px 로 내렸다** (#638). #412 가 12 를 고른 근거는 *"낱말과 숫자는 같은
 * 여백에서 다르게 보인다 — `부분 동반 가능` 을 알맞게 감싸는 8px 이 `100` 에서는 조여
 * 보인다"* 였는데, **배지가 담는 것이 `100` 에서 `100점` 으로 바뀌면서 그 전제가 약해졌다.**
 * 글자가 하나 늘어 배지가 스스로 폭을 얻었으므로 여백이 시각적 무게를 대신할 이유가 줄었다.
 *
 * **되찾은 것은 숫자 자리의 여유다.** 권역 칸은 폭이 고정(`w-44` / `lg:w-46`)이라 배지가
 * 넓어지면 숫자 자리가 **조용히** 눌린다 — 390 실측에서 `100점` + 12px 여백이면 숫자 자리에
 * 남는 폭이 63.6px 로, 가장 넓은 줄 `최고 31.0℃`(62.9)에 **0.6px** 밖에 남지 않았다.
 * 겨울의 `최저 -3.0℃` 처럼 부호 한 글자가 붙는 순간 줄이 접힌다. 8px 로 내리면 71.5px 이 된다.
 *
 * **`score` 는 `Badge` 옆에 서지 않으므로** 짝을 깨지 않는다 (값은 `md` 와 같아졌지만
 * `py` 가 아니라 **용도**가 둘을 가른다 — 여기는 숫자, `md` 는 서버 문구다). 새로 쓸 곳이
 * 생기면 그 줄에 `Badge` 가 함께 오는지 먼저 본다.
 *
 * **여백을 다시 키우려면 담는 칸을 함께 본다.** `src/styles/overlay-and-region-cell.test.ts`
 * 가 이 파일의 값을 읽어 칸 폭과 함께 검사한다.
 */
const BADGE_SIZE: Record<MetricBadgeSize, string> = {
  sm: 'h-5 px-2',
  md: 'px-2 py-1',
  score: 'px-2 py-1',
}

export type MetricBadgeSize = 'sm' | 'md' | 'score'

/**
 * 등급 배지.
 *
 * **세로 바가 없다.** 문구가 등급을 말하므로 색은 보조 채널이고, 바를 달면 목록이
 * 색 줄무늬로 읽힌다 (DESIGN.md §10).
 * **문구를 아이콘으로 대체하지 않는다.**
 */
export function MetricBadge({
  tone,
  size = 'md',
  surface = 'default',
  axis,
  children,
  className,
}: {
  tone: MetricTone
  /** `sm` 은 `Badge size="sm"` 과 나란히 설 때 (같은 `h-5`) */
  size?: MetricBadgeSize
  /**
   * 배지가 앉는 면. **`tint` 는 같은 톤의 `-100` 면 위**를 뜻한다 — 거기서는 채움과 배경이
   * 같은 색이라(1.00:1) 배지가 사라지므로 면과 채움을 맞바꾼다 (`BADGE_TONE_ON_TINT`).
   *
   * **다른 톤의 tint 위에는 주지 않는다.** 그때는 채움이 이미 배경과 갈리므로 기본이 맞고,
   * 뒤집으면 배지가 까닭 없이 흰 칩으로 뜬다.
   */
  surface?: MetricBadgeSurface
  /**
   * 주면 등급어 앞에 축 이름이 선다 — `적합도 보통`. **값과 무관하게 항상 붙는다** —
   * `보통` 일 때만 붙이면 배지 모양이 값마다 달라져 "앞 낱말이 축" 이라는 규칙을 배울 수
   * 없고, 서버가 새 충돌 어휘를 보내면 조용히 깨진다.
   *
   * 생략하면 접두어가 없다. 그것이 기본값인 이유는 **대부분의 배지가 축을 말할 필요가
   * 없기 때문이다** — `MetricAxis` 주석 참고.
   */
  axis?: MetricAxis
  /** 서버 `name` 을 그대로 넣는다 */
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        // `border-transparent` 은 장식이 아니다 — unknown 만 테두리가 있으면 같은 목록에서
        // 그 배지만 2px 높다. 투명 테두리로 자리를 미리 잡아 톤과 무관하게 높이를 맞춘다
        'text-caption inline-flex items-center rounded-sm border border-transparent font-semibold whitespace-nowrap',
        BADGE_SIZE[size],
        BADGE_SURFACE[surface][tone],
        className,
      )}
    >
      {/*
        **축 라벨은 자기 `<span>` 이고, 공백은 그 안에 있다.**

        `{label} {children}` 로 쓰면 React 가 하이드레이션 경계에 주석 노드를 끼워 실제 DOM
        과 `renderToStaticMarkup` 문자열이 갈린다 — `toContain('적합도 보통')` 이 테스트에서만
        통과하는 false-green 이 되는 자리다 (testing-guide.md §5). 그래서 라벨을 요소로 뗀다.

        **공백을 여백으로 대신하지 않는다.** 접근성 이름 계산은 인라인 노드를 이어 붙일 때
        공백을 넣어 주지 않아 배지가 `적합도보통` 한 낱말로 읽힌다 (실측:
        `textContent === '적합도보통'`). 여백은 눈에만 보이고 귀에는 없다. 공백을 라벨
        `<span>` 안에 두면 텍스트 노드가 하나라 주석 문제도 생기지 않는다.

        **`me-1`(4px)을 그 위에 더한다.** 12px 공백은 3.1px 이라 `적합도 보통` 이 390
        화면에서 한 낱말로 뭉쳐 보였다 — 낱말을 가르려고 붙인 라벨이 낱말에 붙어 버리면
        한 일이 없다. 여백은 **공백을 대신하는 것이 아니라 보태는 것**이라 귀로 읽히는
        글자는 그대로다. **2px 를 쓰지 않는다** — 스페이싱 스케일 밖이고
        `styles/token-usage.test.ts` 가 막는다 (DESIGN.md §4).

        **굵기만 한 단계 낮춘다** (본문 600 → 라벨 500). 라벨과 값이 갈려 읽히는데 색은
        그대로라 대비가 바뀌지 않는다. 크기를 줄이면 12px 밑으로 내려가고, 색을 흐리면
        MID tint 위 5.16:1 이 무너진다 (DESIGN.md §2-3).
      */}
      {axis !== undefined && (
        <span className="me-1 font-medium">{`${METRIC_AXIS_LABEL[axis]} `}</span>
      )}
      {children}
    </span>
  )
}

/**
 * 흰 배경 위 등급 **글자**에 쓰는 색. **`-700` 층이다** (DESIGN.md §2-3 — 흰 배경 대비
 * HIGH 8.64:1 · LOW 7.56:1 · CRITICAL 6.47:1 · MID 5.64:1).
 *
 * `-500` 을 쓰지 않는다 — 그 층은 마크와 22px+/900 큰 숫자 전용이고, MID 는 흰 배경에서
 * 3.85:1 이라 단어에 쓰면 대비가 무너진다.
 *
 * **내보내는 이유는 `MetricWord` 가 크기까지 못박기 때문이다** (20/800 고정). 등급 색은
 * 필요한데 그 크기는 아닌 자리가 있다 — 홈 골든타임의 추천 시각(22/700)이 그렇다.
 * 그런 자리는 이 표를 직접 쓰되 **`-700` 층 밖으로 나가지 않는다.**
 */
export const METRIC_WORD_TONE: Record<MetricTone, string> = {
  critical: 'text-metric-critical-700',
  high: 'text-metric-high-700',
  mid: 'text-metric-mid-700',
  low: 'text-metric-low-700',
  // UNKNOWN 에는 등급 색이 없다. --metric-unknown-500 은 점선 전용이다
  unknown: 'text-fg-muted',
}

/**
 * 등급을 문장 안에서 말하는 단어 — 아트보드 `장소 상세` 01·03 "몽실이에게 **적합해요**",
 * `홈` 01·02 "오늘 산책 **위험**".
 *
 * 배지(`MetricBadge`)와 역할이 다르다. 배지는 목록에서 훑는 라벨이고, 이쪽은 **그 블록의
 * 결론**이라 tint 없이 크기와 색으로 선다.
 *
 * **"한 화면에 하나뿐" 은 더 이상 아니다** (#856). 일정 상세의 일자 카드가 일자마다 하나씩
 * 세우므로 한 화면에 여럿이 선다 — 규칙은 **개수**가 아니라 **자리**다: 훑는 목록의 라벨은
 * 배지, 한 블록의 결론은 이것이다. 일자 카드에서는 판정 밴드가 그 블록이고, 등급어 위
 * 캡션이 축 이름을 갖는다.
 *
 * 크기는 **`emphasis`(20/800) 고정**이다. 아트보드가 두 화면 모두 `font-size:20px;
 * font-weight:800` 이고, 이것을 호출부가 정하게 두면 화면마다 등급어 크기가 갈린다
 * (실제로 갈려 있었다 — 홈 20px / 장소 상세 18px).
 *
 * **문구는 서버 `name` 을 그대로 넣는다.** FE 가 등급 한국어를 다시 쓰지 않는다.
 */
export function MetricWord({
  tone,
  children,
  className,
}: {
  tone: MetricTone
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('text-emphasis font-extrabold', METRIC_WORD_TONE[tone], className)}>
      {children}
    </span>
  )
}

/**
 * 등급 **면** — 글자가 얹히지 않는 채움 전용 (#430 의 기간 혼잡도 막대).
 *
 * **`-500` 층인 이유는 여기에 텍스트가 없기 때문이다.** 비텍스트 요소는 3:1 기준이라
 * `-500` 이 통과하고, tint(`-100`)로 칠하면 막대가 배경(`--band`)과 거의 구별되지 않는다.
 * **이 표로 칠한 면 위에 글자를 얹지 않는다** — 얹어야 하면 `-100` 층(`BADGE_TONE`)이다.
 *
 * **`unknown` 은 비어 있다.** `--metric-unknown-500` 은 점선 테두리 전용이라 면을 칠할 색이
 * 없고, 모르는 날을 옅은 면으로 칠하면 그것이 "낮은 값" 으로 읽힌다. 호출부가 채우기 전에
 * 값이 있는지부터 가른다.
 */
export const METRIC_FILL_TONE: Record<MetricTone, string> = {
  critical: 'bg-metric-critical-500',
  high: 'bg-metric-high-500',
  mid: 'bg-metric-mid-500',
  low: 'bg-metric-low-500',
  unknown: '',
}

/**
 * 등급 **tint 면** — `METRIC_FILL_TONE` 의 짝이다. **글자가 얹히는 면**에 쓴다
 * ([#656](https://github.com/8llow8llowMe/hondigagae/issues/656) 의 골든타임 곡선 칸).
 *
 * `-500` 면 위에는 글자를 얹지 않는다(비텍스트 3:1 기준으로 고른 층이다). 12px 숫자가 그
 * 위에 서는 자리는 텍스트 대비 규칙에 걸리므로 **`-100` 층으로 내린다** — 그 위의 `-700`
 * 글자가 tint 배경에서 4.55~7.39:1 로 AA 를 넘는다 (DESIGN.md §2-3).
 *
 * **`unknown` 은 `--metric-*` 밖이다.** 등급을 모르는 자리에 등급 색을 주지 않는 것이
 * §2-3 이고(`UNKNOWN` 에는 tint 가 없다), `METRIC_FILL_TONE` 처럼 비우지도 않는다 —
 * 이 표를 쓰는 자리는 **면이 있고 없고가 그 자체로 뜻인 자리**라(추천 구간 안/밖) 비우면
 * 모르는 칸이 구간 **밖**으로 읽힌다. 그래서 등급을 말하지 않는 중립 면(`--band`)을 준다.
 * 모른다는 사실은 같은 자리의 글자(`METRIC_WORD_TONE.unknown` = `--fg-muted`)와 `sr-only` 가
 * 낱말로 말한다 — 색이 유일한 채널이 아니다.
 *
 * `--band` 는 값이 `--metric-low-100` 과 같지만 **이 표를 쓰는 축에는 `low` 가 없다**
 * (`walkSafetyTone` 은 `SAFE`/`CAUTION`/`DANGER` → `high`/`mid`/`critical`). 두 면이 한
 * 화면에서 같이 나올 축이 생기면 그때 갈라야 한다.
 */
export const METRIC_TINT_TONE: Record<MetricTone, string> = {
  critical: 'bg-metric-critical-100',
  high: 'bg-metric-high-100',
  mid: 'bg-metric-mid-100',
  low: 'bg-metric-low-100',
  unknown: 'bg-band',
}

/**
 * `METRIC_TINT_TONE` 면의 **경계선 색** — `-500` 실선이다
 * ([#709](https://github.com/8llow8llowMe/hondigagae/issues/709)).
 *
 * **tint 면이 넓게 깔릴 때 이 선이 유일한 명도 채널이다.** 홈 특보 스트립은 `Canvas` 안이라
 * `--bg-sunken`(`#F5F6F8`) 위에 서는데, 그 바닥과 tint 의 대비가 `--metric-mid-100` **1.01:1** ·
 * `--metric-critical-100` **1.06:1** 이다 — **색상(hue)만 다르고 밝기가 같다.** 면만 깔면
 * 적록색약에게는 아무것도 칠하지 않은 것과 구별되지 않는다. §2-9 가 영업 상태 두 tint 를 두고
 * *"색만으로 가르지 않는다(1.02:1)"* 고 못박은 것과 같은 자리다.
 *
 * `-500` 은 tint 면 위에서 3.53~3.97:1 이라 **비텍스트 3:1** 을 넘는다. `--border`(tint 위
 * 1.15:1)로는 선이 있는지조차 보이지 않는다.
 *
 * **면 없이 이 선만 쓰지 않는다.** 짝으로 쓰라고 있는 표다 — 선만 남으면 §10 이 막은
 * "장식성 색 선" 이 된다.
 *
 * **`unknown` 은 등급 색이 없다** (§2-3). `METRIC_TINT_TONE` 이 그 칸에 중립 면(`--band`)을
 * 주는 것과 같은 이유로 중립 선을 준다 — `--metric-unknown-500` 은 **점선 전용**이라 실선
 * 경계에 쓰지 않는다.
 */
export const METRIC_TINT_EDGE_TONE: Record<MetricTone, string> = {
  critical: 'border-metric-critical-500',
  high: 'border-metric-high-500',
  mid: 'border-metric-mid-500',
  low: 'border-metric-low-500',
  unknown: 'border-border-strong',
}

/** 큰 숫자에 쓰는 등급 색. 22px 이상 + weight 900 에만 허용된다 (DESIGN.md §2-3). */
const VALUE_TONE: Record<MetricTone, string> = {
  critical: 'text-metric-critical-500',
  high: 'text-metric-high-500',
  mid: 'text-metric-mid-500',
  low: 'text-metric-low-500',
  unknown: 'text-fg-muted',
}

/**
 * 지표 값 — 라벨 + 숫자 + 단위.
 *
 * - 숫자에 `tabular-nums` 를 강제한다. 목록에서 자릿수가 흔들리면 값을 비교할 수 없다.
 * - **단위를 생략하지 않는다.** 값보다 작고 흐리게(`caption` + `--fg-muted`) 붙인다.
 * - `tone` 을 주지 않으면 중립(`--fg`)이다. **거리·개수 같은 중립 수치에 등급 색을
 *   쓰지 않는다** (DESIGN.md §2-3).
 * - 크기는 `display`(28/900, 큰 지표)와 `title-1`(22/900, 행 안 점수) 둘뿐이다.
 *   **그 사이 크기를 쓰지 않는다** (DESIGN.md §3-3).
 */
export function MetricValue({
  label,
  value,
  unit,
  tone,
  size = 'row',
  className,
}: {
  /** 없으면 라벨 줄을 렌더하지 않는다 */
  label?: ReactNode
  value: ReactNode
  /** ℃ / km / % / 점 — 항상 표기한다 */
  unit?: ReactNode
  /** 생략하면 중립. 등급을 말하는 값에만 준다 */
  tone?: MetricTone
  /** `hero` 28/900 · `row` 22/900 */
  size?: 'hero' | 'row'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label !== undefined && (
        <span className="text-caption text-fg-muted font-medium">{label}</span>
      )}
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-black tabular-nums',
            size === 'hero' ? 'text-display' : 'text-title-1',
            tone === undefined ? 'text-fg' : VALUE_TONE[tone],
          )}
        >
          {value}
        </span>
        {unit !== undefined && (
          <span className="text-caption text-fg-muted font-medium">{unit}</span>
        )}
      </span>
    </div>
  )
}
