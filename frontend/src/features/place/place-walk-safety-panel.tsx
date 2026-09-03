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
 * 적합도의 점수는 반려견이 기준이라 화자가 없으면 말할 수 없지만, 노면 온도와 열지수는
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
  const heatIndex = formatCelsius(data.heatIndexCelsius)
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
          열지수를 hero 로 세운다 — 적합도의 점수 자리와 같다. **`null` 이면 자리를 비운다**
          (0.0℃ 로 채우면 영하 판정으로 읽힌다).
        */}
        {heatIndex !== null && (
          <MetricValue
            value={heatIndex}
            unit={messages.place.detailTemperatureUnit}
            tone={tone}
            size="hero"
            className="shrink-0"
          />
        )}
      </div>

      {/*
        노면 온도. **중립 톤이다** — 등급을 말하는 값은 위 등급어와 hero 열지수뿐이고,
        여기에도 색을 주면 무엇이 판정인지 흐려진다 (DESIGN.md §2-3).

        **`data.temperature` 를 곁들이지 않았다.** 값은 있지만 이 응답의 `temperature` 는
        `targetDateTime` 그 시각의 기온이고, 장소 상세가 가진 기온 라벨은 적합도용
        `detailMaxTemperature`('최고기온') 하나다 — 그것을 붙이면 시각 기온을 일 최고로
        말하는 셈이 된다. 라벨을 새로 만들 만한 자리가 아니라 빼는 쪽을 택했다.
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
