'use client'

/*
  **hook 이 들어와 `'use client'` 가 필수가 됐다** (architecture-guide.md §4 — hook 하나라도
  쓰면 파일 최상단). 계산 근거 펼침이 `useState`/`useId` 를 쓴다. 이 파일은 예전에도
  `onClick`(재시도) 을 달고 있었으나 client 부모만 임포트해 우연히 굴러갔다 — 규칙대로 밝힌다.

  **지시문이 첫 줄이어야 한다.** 주석을 위에 두면 번들러에 따라 directive 로 인식되지 않는다.
*/

import { useId, useState } from 'react'

import { BasisFootnote } from '@/components/basis-footnote'
import { ClockIcon } from '@/components/icons'
import { MetricValue, MetricWord } from '@/components/metric'
import { ReasonList } from '@/components/reason-list'
import { Skeleton } from '@/components/skeleton'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatCelsius } from '@/lib/format/celsius'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { WalkSafetyResponse } from '@/types/insight'

/**
 * 좌우 인셋 — `PlaceSuitabilityPanel` 과 **같은 값을 쓴다.** 두 판정이 같은 레일에 위아래로
 * 서므로 인셋이 갈리면 등급 줄이 서로 다른 축에서 시작한다.
 */
const INSET = 'px-4 md:px-10 lg:px-6'

export type PlaceWalkSafetyPanelProps = {
  /** 조회 전이거나 실패면 null */
  data: WalkSafetyResponse | null
  loading: boolean
  failed: boolean
  onRetry: () => void
  /** 선택된 반려견. null 이면 기준 줄에서 반려견을 빼고 값만 말한다 */
  petName: string | null
}

/**
 * 산책 위험도 판정 — `GET /places/{placeId}/walk-safety` (#197).
 *
 * **적합도 패널과 답하는 질문이 다르다.** 적합도는 "오늘 여기 갈 만한가"를 **일자**
 * (`targetDate`)로 답하고, 이쪽은 "지금 나가도 되나"를 **시각**(`targetDateTime`)으로
 * 답한다. 두 판정이 같은 레일에 나란히 서기 때문에 **기준 줄이 그 차이를 말해야 한다** —
 * 같은 문구를 쓰면 사용자가 한 판정의 두 표현으로 읽고, 오후에 "오늘은 적합" 과
 * "지금은 위험" 이 동시에 뜨는 것을 모순으로 본다.
 *
 * 지키는 것:
 * - **`reasons` 에 `scoreDelta` 가 없다** (적합도와 다르다). `ReasonList` 의
 *   `informational` 을 주지 않는다 — 없는 필드로 흐림을 가르면 전부 감점으로 읽힌다
 * - **℃ 를 반드시 표기한다.** 노면 온도는 **추정치**라 라벨이 그렇게 말한다
 * - **`saferWindow` 가 없으면 줄을 렌더하지 않는다.** 안전 구간을 지어내면 사용자가
 *   그것을 허락으로 읽는다 (`GoldenWalkWindow` 와 같은 판단)
 * - **점수가 없다.** 이 응답에는 `score` 가 아예 없어 등급어가 유일한 요약이다
 *
 * **게스트에게도 렌더한다** — 적합도 패널이 `GuestBlock` 으로 갈리는 것과 다르다.
 * 적합도의 점수는 반려견이 기준이라 화자가 없으면 말할 수 없지만, 노면 온도와 체감온도는
 * **장소와 시각의 속성**이라 반려견이 없어도 값 자체가 참이다. 홈의 `WalkVerdict` 도
 * 같게 굴어(미로그인에 그대로 그린다) 두 화면이 갈리지 않는다.
 */
export function PlaceWalkSafetyPanel({
  data,
  loading,
  failed,
  onRetry,
  petName,
}: PlaceWalkSafetyPanelProps) {
  if (loading) return <PanelSkeleton />

  // 판정만 실패한 것이다. 적합도와 기본 정보는 살아 있어야 한다
  if (failed || data === null) {
    return (
      <div className={cn('flex flex-col items-start gap-2 py-4', INSET)}>
        <p className="text-body-2 text-fg-muted">{messages.place.detailWalkSafetyErrorTitle}</p>
        <button
          type="button"
          onClick={onRetry}
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.common.retry}
        </button>
      </div>
    )
  }

  const tone = walkSafetyTone(data.walkSafetyLevel.code)
  /*
    **`heatIndexCelsius` 가 아니라 `feelsLikeCelsius` 다** (#292 · BE `46f35e4`). 열지수는
    판정에서 내려와 참고값이 됐다 — 아래 `FeelsLikeBasis` 안에서만 산다.
  */
  const feelsLike = formatCelsius(data.feelsLikeCelsius)
  const pavement = formatCelsius(data.estimatedPavementCelsius)

  return (
    <div className={cn('flex flex-col gap-3 py-4', INSET)}>
      <div className="flex items-end justify-between gap-3">
        {/*
          특보 배지가 등급 줄에 함께 선다 — 적합도 패널과 같은 자리다. 경보면 서버가 등급을
          이미 내려놓았고 배지는 그렇게 된 이유를 말한다.
        */}
        <p className="text-body-1 flex flex-wrap items-center gap-x-1 gap-y-2 font-semibold">
          <span className="text-fg-muted">{messages.place.detailWalkSafetyLabel}</span>
          <MetricWord tone={tone}>{data.walkSafetyLevel.name}</MetricWord>
          <WeatherWarningBadge warning={data.weatherWarning} />
        </p>

        {/*
          체감온도를 hero 로 세운다 — 적합도의 점수 자리와 같다. **`null` 이면 자리를 비운다**
          (0.0℃ 로 채우면 영하 판정으로 읽힌다).

          **라벨을 붙인다** (#259). 예전에는 적합도의 점수 hero(`82 /100`)를 따라 뺐는데,
          점수는 단위가 스스로 말하고 온도는 그렇지 않다 — 맨 `35.0℃` 는 기온으로 읽힌다.
          게스트 경로에서는 바로 위 적합도가 **하루 최대** 체감온도를 같은 ℃ 로 내므로,
          라벨이 없으면 기준이 다른 두 숫자가 이름 없이 붙어 선다.

          **`지금 체감온도` 가 아니라 `체감온도` 다.** 시각 기준이라는 것은 위의
          `지금 산책` 제목과 아래 `{time} 기준` 각주가 이미 두 번 말한다 — 라벨까지
          '지금' 을 얹으면 같은 말이 세 번이다. 가르는 일은 하루쪽의 `최고` 가 한다.
        */}
        {feelsLike !== null && (
          <MetricValue
            label={messages.place.detailFeelsLike}
            value={feelsLike}
            unit={messages.place.detailTemperatureUnit}
            tone={tone}
            size="hero"
            className="shrink-0"
          />
        )}
      </div>

      {/*
        노면 온도. **중립 톤이다** — 등급을 말하는 값은 위 등급어와 hero 체감온도뿐이고,
        여기에도 색을 주면 무엇이 판정인지 흐려진다 (DESIGN.md §2-3).

        **`data.temperature` 를 곁들이지 않는다** (#269 에서 다시 판단했다).

        예전 근거는 "장소 상세의 기온 라벨이 하루 단위(`최고기온`) 하나뿐이라 시각 기온을
        일 최고로 말하게 된다" 였다. **그 근거는 #259 로 반쯤 사라졌다** — 이제 이 패널에
        시각 기준 라벨(`체감온도`)이 있고 하루 쪽은 `최고 체감온도` 로 갈렸다.

        그래도 붙이지 않는 이유는 다르다. **#269 가 고친 것은 라벨 없는 맨 숫자였다.**
        홈 곡선은 셀에 숫자가 하나뿐이라 사용자가 노면온도를 기온으로 읽었지만, 이
        패널은 **모든 숫자가 라벨을 달고 있어** 그 오독이 없다. 세 번째 온도를 더하면
        판정(hero)과 근거(노면)로 정리된 자리가 숫자 셋으로 흐려진다 — 기온은 서버 근거
        문장이 이미 말한다("기온 25도지만 노면(아스팔트) 온도는 약 47도로 추정됩니다").
      */}
      {pavement !== null && (
        <MetricValue
          label={messages.place.detailPavement}
          value={pavement}
          unit={messages.place.detailTemperatureUnit}
        />
      )}

      {/*
        **`informational` 을 주지 않는다.** `WalkSafetyReasonItem` 에는 `scoreDelta` 가
        없어 감점과 정보성을 가를 근거가 없다 — 적합도 패널에서 복사해 오면 없는 필드를
        읽고 전부 감점으로 흐려진다.
      */}
      <ReasonList
        reasons={data.reasons.map((reason) => ({ description: reason.description }))}
        initialCount={3}
        moreLabel={messages.home.moreReasons.replace('{n}', '%d')}
        lessLabel={messages.home.lessReasons}
      />

      <BasisLine data={data} petName={petName} />

      <SaferWindow data={data} />

      {/*
        **맨 아래다.** 접혀 있어도 44px 한 줄을 차지하므로 위에 두면 `SaferWindow` 의
        조언(실제로 행동을 바꾸는 유일한 줄)이 그만큼 밀린다. 계산 근거는 이 패널에서
        가장 깊은 층이고, 접힌 각주는 아래에 산다.
      */}
      <FeelsLikeBasis data={data} />
    </div>
  )
}

/**
 * 체감온도 계산 근거 + 참고 열지수 (#292).
 *
 * **이 자리가 생긴 이유.** BE `46f35e4` 가 판정 기준을 NOAA 열지수에서 기상청 여름철
 * 체감온도로 바꾸고 열지수를 참고값으로 내렸다. 노면온도는 라벨이 스스로 `추정` 이라고
 * 밝히는데 **hero 체감온도만 자기 출처를 말하지 않았고**, 열지수는 판정에서 내려온 뒤에도
 * 서버가 계속 내려온다 — 두 사실을 한자리에서 처리한다.
 *
 * 지키는 것:
 * - **접어 둔다.** `feelsLikeBasis` 는 산식·입력·임계 출처를 다 담은 130자 문장이다.
 *   펼쳐 두면 판정과 근거 목록 사이에 회색 벽이 서고, 그러면 아무도 읽지 않는다
 * - **참고 열지수를 평면에 세우지 않는다.** hero(판정) · 노면(근거) 로 정리된 자리에
 *   세 번째 온도를 더하면 판정값과 참고값이 같은 위계로 읽힌다 — 그것이 이 변경이
 *   고치려는 오독 그 자체다. 값과 `heatIndexBasis`("판정에는 쓰지 않으며…")를 **붙여
 *   두어** 숫자만 떼어 읽히지 않게 한다
 * - **서버 문장을 다시 쓰지 않는다.** 둘 다 완성형이다 (styling-guide.md §7)
 * - **`feelsLikeBasis` 가 없으면 서랍 자체가 없다.** 펼침 라벨이 `체감온도 계산 근거` 라고
 *   말하므로 체감온도 근거가 없는데 열지수만 담아 열면 라벨이 거짓이 된다. BE 도 두 값이
 *   같은 `temperature` 에서 나와 **함께 있거나 함께 없다** (`WalkSafetyPresenter`)
 */
function FeelsLikeBasis({ data }: { data: WalkSafetyResponse }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  if (data.feelsLikeBasis === null) return null

  const heatIndex = formatCelsius(data.heatIndexCelsius)
  const hasHeatIndex = heatIndex !== null && data.heatIndexBasis !== null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((prev) => !prev)}
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7). `ReasonList` 의 펼침과 같은 모양이다
        className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center self-start font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {open ? messages.place.detailFeelsLikeBasisClose : messages.place.detailFeelsLikeBasisOpen}
      </button>

      {/*
        **`open && (...)` 이 아니라 `hidden` 이다.** 접힘을 조건부 렌더로 만들면 위 버튼의
        `aria-controls` 가 없는 id 를 가리키고, 그 순간 보조기기에게 이 버튼은 무엇을
        여는지 알 수 없는 버튼이 된다. `ReasonList` 는 `<ul>` 자체가 늘 있어 같은 문제가
        없지만 여기는 몸통 전체가 접힘 대상이다. `hidden` 은 a11y 트리에서도 빠진다.
      */}
      <div id={bodyId} hidden={!open} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-body-2 text-fg-muted">{data.feelsLikeBasis}</p>
          {/*
            출처와 계산 입력 (#317). **홈과 같은 조각을 쓴다** — 같은 두 값을 두 화면이
            다르게 적으면 사용자는 서로 다른 사실로 읽는다.

            **위 문장에 붙여 둔다** (`gap-1`). 습도는 그 문장이 말하는 입력의 실제
            수치라, 떨어뜨리면 무엇의 습도인지 알 수 없는 단독 값이 된다.
          */}
          <BasisFootnote humidity={data.humidity} providerName={data.weatherProviderName} />
        </div>

        {hasHeatIndex && (
          <div className="flex flex-col gap-1">
            {/* 중립 톤이다 — 판정에 쓰이지 않는 값에 등급 색을 주면 두 번째 판정으로 읽힌다 */}
            <MetricValue
              label={messages.place.detailHeatIndexReference}
              value={heatIndex}
              unit={messages.place.detailTemperatureUnit}
            />
            <p className="text-body-2 text-fg-muted">{data.heatIndexBasis}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 언제·누구 기준인지.
 *
 * **`petConditionApplied` 가 false 면 반려견을 말하지 않는다.** 고른 반려견이 있어도
 * 서버가 특성을 반영하지 못했으면 "몽실이 기준" 은 거짓이다 — 일자 판정이 `basisPetId` 로
 * 같은 문제를 푸는 것과 같은 방향이고, 이 저장소가 `weatherApplied`·`congestionApplied` 를
 * 감추지 않는 이유도 같다.
 */
function BasisLine({ data, petName }: { data: WalkSafetyResponse; petName: string | null }) {
  const time = toTimeLabel(data.targetDateTime)
  const withPet = petName !== null && data.petConditionApplied

  return (
    <p className="text-caption text-fg-muted font-medium tabular-nums">
      {withPet
        ? messages.place.detailWalkSafetyBasisWithPet
            .replace('{time}', time)
            .replace('{name}', petName)
        : messages.place.detailWalkSafetyBasis.replace('{time}', time)}
    </p>
  )
}

/**
 * 더 안전한 시간대. **같은 날 안에서만 제안된다** (백엔드 스키마).
 *
 * 둘 중 하나만 와도 렌더하지 않는다 — 반쪽 구간은 시간대가 아니다.
 */
function SaferWindow({ data }: { data: WalkSafetyResponse }) {
  if (data.saferWindowStart === null || data.saferWindowEnd === null) return null

  return (
    <p className="bg-metric-high-100 text-metric-high-700 text-body-2 flex items-center gap-2 rounded-md p-3 tabular-nums">
      <ClockIcon size={20} className="shrink-0" />
      {messages.place.detailSaferWindow
        .replace('{start}', data.saferWindowStart.slice(0, 5))
        .replace('{end}', data.saferWindowEnd.slice(0, 5))}
    </p>
  )
}

/**
 * `2026-09-03T14:00:00` → `14:00`.
 *
 * **서버 문자열을 그대로 자른다.** `Date` 로 파싱하면 브라우저 타임존이 KST 가 아닌
 * 사용자에게 다른 시각이 나온다 — 홈의 `walk-times-section.tsx` 와 같은 판단이다.
 */
function toTimeLabel(targetDateTime: string): string {
  return targetDateTime.slice(11, 16)
}

/** 실제 콘텐츠와 크기를 맞춰 레이아웃 점프를 막는다 (coding-conventions.md §6) */
function PanelSkeleton() {
  return (
    <div className={cn('flex flex-col gap-3 py-4', INSET)}>
      <div className="flex items-end justify-between gap-3">
        <Skeleton variant="text" className="h-7 w-32" />
        <Skeleton variant="text" className="h-9 w-16" />
      </div>
      <Skeleton variant="text" className="h-5 w-full" />
      <Skeleton variant="text" className="h-5 w-2/3" />
    </div>
  )
}
