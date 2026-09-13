import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ImageIcon } from '@/components/icons'
import { MetricBadge, type MetricTone, MetricValue } from '@/components/metric'
import { imageSrc } from '@/lib/image/remote-host'
import { splitReasons } from '@/lib/insight/reasons'
import { congestionTone, suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { placeIllustration } from '@/lib/place/illustration'
import { cn } from '@/lib/utils/cn'
import type {
  CongestionItem,
  PlaceSuitabilityResponse,
  SuitabilityReasonItem,
} from '@/types/insight'
import type { PlaceSummary } from '@/types/place'

/**
 * 서버가 "판정하지 않았다" 를 말하는 코드. 적합도 등급 · 혼잡도 · 동반 가능 여부가
 * 모두 이 값을 쓴다 — **낱말(`정보 없음`)이 아니라 이 코드로 거른다** (#530).
 */
const UNKNOWN_CODE = 'UNKNOWN'

/**
 * 적합도 행 — 아트보드 `01 홈 · P2` (모바일) / `02 홈` 우측 (데스크톱).
 *
 * **카드가 아니라 전폭 행이다.** 구분선은 좌우 인셋 16(모바일) / 40(데스크톱).
 *
 * `firstImage` 가 null 이어도 **같은 크기의 "이미지 없음" 타일**을 남긴다 — 행 높이가
 * 흔들리면 목록을 훑을 수 없다.
 *
 * ### 두 축을 쓴다 — 폭 축은 컨테이너, 인셋 축은 뷰포트 (#530)
 *
 * **접기는 `@container` 다** (`place-row.tsx` 와 같은 방식). 고정 열 둘(태그 144 · 판정
 * 112)을 `md:`(뷰포트)로 켜 두었더니 **768 에서 본문에 200px 대만 남아** 근거 문장이 넉
 * 줄로 쪼개졌고, 1024 에서는 좌측 레일 400 을 빼고 나면 본문이 **76px** 이었다. 뷰포트는
 * 이 행이 실제로 받은 폭을 모른다 — 같은 1024 라도 한 컬럼이면 행이 895px 이다.
 *
 * 그래서 `@2xl`(672)부터만 3단이다. **672 는 "본문에 320 이상 남는 폭"** 이다 —
 * 썸네일 96 + gap 20 + 태그 144 + gap 20 + 판정 112 + gap 20 = 412 가 열들의 몫이라,
 * 672 에서 본문이 260, 1280 의 744 에서 332 다. 그 아래는 접는다.
 *
 * **바뀌는 것은 열 구성뿐이다. 밀도는 `md:` 로 남는다** — 인셋 · gap · 세로 여백 ·
 * 썸네일 크기 · 근거 문장. 이유가 둘이다. (1) 좌우 인셋은 담는 카드의 제목(`px-4 md:px-5`)
 * 과 같은 축이어야 한다 — 갈리면 같은 카드 안에서 제목과 행의 왼쪽 세로선이 폭에 따라
 * 어긋난다 (`lib/ui/inset.ts` 머리주석의 "지그재그"). (2) 나머지는 **화면이 작다**는 사실에
 * 딸린 값이지 행이 좁다는 사실에 딸린 값이 아니다 — 390px 에서 썸네일을 줄이면 목록을
 * 알아보는 유일한 단서를 가장 좁은 화면에서 뺏는 것이 되고, 근거 두 줄을 넣을 세로 공간도
 * 거기에만 없다. `.scroll-rail` 화살표가 폭이 아니라 입력 방식으로 갈리는 것과 같은 결이다.
 *
 * ### 접은 모양
 *
 * 태그는 **제목 위**로(`order-first`), 등급 배지와 점수는 **제목 줄 오른쪽**으로 합친다.
 * 고정 열이 없어지니 본문이 행 전체를 쓴다. **DOM 순서는 제목 → 메타 → 태그 그대로다** —
 * 스크린리더는 이름을 먼저 읽는다. 시각 순서만 바꾼다 (`place-row.tsx` 와 같은 규약).
 */
export function PlaceInsightRow({
  data,
  place,
  collapsed = false,
  reasons = data.reasons,
}: {
  data: PlaceSuitabilityResponse
  /** 목록 응답의 장소. 썸네일·주소·실내 여부는 인사이트 응답에 없다 */
  place: PlaceSummary | undefined
  /**
   * 2·3등을 접는다 — #307. `DESIGN.md` §1 의 *"낮은 우선순위는 접는다"*.
   *
   * **이제 모든 폭에서 접힌다** (#530). 예전에는 접는 것(근거 · 속성 태그)이 전부 `md:`
   * 전용이라 모바일 출력이 접기 전과 같았고, **같은 행이 폭에 따라 접힘을 지키기도
   * 무시하기도 했다.** 태그가 접은 모양에서도 제목 위에 자리를 갖게 되면서 그 예외가
   * 사라졌다.
   *
   * **접는 것은 안 바뀌는 값이다** — 근거 문장과 속성 태그(동반 가능 여부 · 실내/야외).
   * **혼잡도는 접지 않는다**: 오늘의 판정이고 섹션 부제가 이미 말한 값이라, 2·3등에서
   * 지우면 그 문장이 화면에서 근거를 잃는다.
   *
   * **썸네일 축소는 `md:` 에 남는다.** 390px 에서 96 → 48 까지 줄이면 목록을 알아보는
   * 유일한 단서를 가장 좁은 화면에서 뺏는 것이 된다.
   *
   * **펼치는 장치를 두지 않는다.** 행 전체가 `<Link>` 라 그 안의 `<button>` 은 무효
   * HTML 이고, 근거 전문은 이미 상세 화면이 갖고 있다 (`place-suitability-panel`).
   * 펼침 상태를 URL 에 두지 않는다는 판단도 함께 사라진다 — 상태 자체가 없다.
   */
  collapsed?: boolean
  /**
   * 이 행에 적을 근거 (#304). **기본값은 응답 그대로**라, 목록 밖에서 이 행 하나만 쓰는
   * 곳은 지금까지와 같다.
   *
   * 홈 목록은 `splitSharedReasons` 로 **전 카드 공통 문장을 뺀 것**을 넘긴다. 날씨는
   * 장소별 근거가 아니라 화면의 전제라, 카드마다 같은 문장을 반복하면 세 장소의 실제
   * 차이가 그 문장 아래 묻힌다. 뺀 문장은 목록 위에 한 번 선다.
   *
   * **행이 스스로 걸러내지 않는다.** 무엇이 공통인지는 다른 카드를 봐야 알 수 있고,
   * 그것은 목록을 가진 쪽만 안다.
   */
  reasons?: SuitabilityReasonItem[]
}) {
  const tone = suitabilityTone(data.suitabilityLevel.code)
  const { penalties, informational } = splitReasons(reasons)
  // 근거 문장은 좁은 행에 둘 세로 공간이 없다 — 그때는 상세에서 읽는다
  const lines = [...penalties, ...informational].slice(0, 2)

  return (
    <li>
      <Link
        href={`/places/${data.placeId}`}
        className={cn(
          'focus-visible:ring-brand-500 @container flex items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:gap-5 md:px-10',
          collapsed ? 'md:py-3' : 'md:py-5',
        )}
      >
        <Thumbnail place={place} collapsed={collapsed} />

        {/*
          `<a>` 는 flow content 를 담을 수 있으므로 행 내부 래퍼는 `div` 다.
          **`span` 으로 두면 안 된다** — `MetricValue` 가 `div` 를 렌더해 `span` 안의 `div`
          가 되고, 무효 HTML 이라 하이드레이션 경고가 난다.

          **`flex flex-col` 이다** — 접힌 모양에서 태그가 `order-first` 로 제목 위에 서려면
          이 래퍼가 flex 컨테이너여야 한다.
        */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="text-title-2 text-fg min-w-0 flex-1 font-semibold break-words">
              {data.placeTitle}
            </span>

            {/*
              접은 모양의 판정 — **등급 배지와 점수를 제목 줄 오른쪽에 합친다.** 예전에는
              배지만 여기 서고 점수는 메타 아래 제 줄을 따로 썼다. 등급어와 수치는 같은
              판정을 두 해상도로 말하는 것이라 떨어뜨릴 이유가 없고, 붙이면 행이 한 줄
              짧아진다.
            */}
            <div className="flex shrink-0 items-center gap-1.5 @2xl:hidden">
              <MetricBadge tone={tone}>{data.suitabilityLevel.name}</MetricBadge>
              <Score score={data.score} tone={tone} size="row" />
            </div>
          </div>

          <p className="text-caption text-fg-muted mt-1 font-medium tabular-nums">
            {metaLine(place)}
          </p>

          {/* 근거는 데스크톱에만. 모바일은 상세에서 읽는다 — 접힌 행은 근거를 접는다 */}
          {!collapsed && lines.length > 0 && (
            <div className="mt-1.5 hidden md:block">
              {lines.map((reason, index) => (
                <p
                  key={`${index}-${reason.code}`}
                  className={cn(
                    'text-body-2 break-keep',
                    reason.scoreDelta === 0 ? 'text-fg-muted' : 'text-fg',
                  )}
                >
                  {reason.description}
                </p>
              ))}
            </div>
          )}

          {/*
            접은 모양의 태그 — **제목 위**(`order-first`). DOM 은 제목 → 메타 → 태그 그대로라
            스크린리더는 이름을 먼저 읽는다 (`place-row.tsx` 와 같은 규약).

            **접힌 행은 혼잡도만 남긴다** (`attributes={false}`). 접는 것은 **안 바뀌는
            값**(동반 가능 여부 · 실내/야외)이다 — 그건 장소를 고른 뒤 상세에서 읽으면 되고,
            세 행에 같은 무게로 서면 위계가 안 읽힌다. 혼잡도는 다르다: **오늘의 판정**이고
            섹션 부제가 "날씨·혼잡도 반영" 이라고 이미 말한 값이라, 2·3등에서 지우면 그
            문장이 화면에서 근거를 잃는다 (`CongestionBadge` 머리주석 — 이 배지가 생긴
            이유가 그것이다).

            **아래 고정 열은 접힌 행에 아예 없다.** 그쪽은 144px 짜리 열이라 남기면 접기
            전후 폭이 같아지지만, 여기는 배지 하나가 태그 줄에 붙을 뿐이다.

            실측(접힌 행 / 1등 행): 375 는 **110 / 110** 으로 80px 썸네일이 양쪽 높이를 잡아
            차이가 없고, 768 은 **110 / 176**, 1024 는 **110 / 220** 이다. 접기 전 76 에서
            34 늘었지만 1등과의 간격이 66~110 이라 위계는 크기가 그대로 만든다. 1280 이상
            (3단)은 이 줄이 `@2xl:hidden` 이라 **88 그대로**다.
          */}
          <RowTags
            place={place}
            congestion={data.congestion}
            attributes={!collapsed}
            className="order-first mb-1.5 @2xl:hidden"
          />
        </div>

        {/*
          넓은 행의 속성 태그 열 — 동반 가능 여부를 첫 태그로, 혼잡도는 마지막.

          **속성 배지와 등급 배지가 한 줄에 섞인다.** `components/metric.tsx` 가 두 배지의
          크기를 같은 값으로 못박아 둔 이유가 이 자리다 — 높이가 갈리면 줄이 어긋난다.
          속성(동반 가능 · 실내)은 안 바뀌는 값이고 혼잡도는 오늘의 판정이라, 순서로
          그 둘을 가른다.

          **`place` 가 없어도 이 열은 남는다.** 혼잡도는 `place` 가 아니라 적합도 응답에서
          오므로, 목록 응답이 비어도 혼잡도는 말할 수 있다.
        */}
        {!collapsed && (
          <RowTags
            place={place}
            congestion={data.congestion}
            // 속성 태그는 1등에서만. 접힌 행에 남기면 접기 전후 폭이 같아 위계가 안 읽힌다
            className="hidden w-36 shrink-0 justify-end self-start @2xl:flex"
          />
        )}

        {/*
          넓은 행의 판정 열 — **배지가 점수 바로 위**, 행의 오른쪽 끝.

          배지를 제목 옆에 두면 제목 길이에 따라 x 가 흔들리고 근거 문장과 같은 폭에서
          경쟁한다. 점수 위로 모으면 둘이 한 덩어리로 읽힌다 — 등급어와 수치는 같은
          판정을 두 해상도로 말하는 것이라 붙어 있어야 한다.

          **`self-start` 다.** 행은 썸네일 높이로 세로 중앙 정렬이라, 이것이 없으면 덩어리가
          가운데로 내려와 "오른쪽 위" 가 되지 않는다.

          **폭은 `w-28`.** 가장 긴 배지("판단 근거 부족")가 한 줄에 들어가는 값이다.
          점수(`82 /100`)보다 배지가 넓어 열 폭은 배지가 정한다.
        */}
        <div
          className={cn(
            'hidden w-28 shrink-0 flex-col items-end gap-1.5 self-start @2xl:flex',
            // 접힌 행은 세로 가운데 — 근거가 없어 덩어리 하나뿐이라 위로 붙일 이유가 없다
            collapsed && 'self-center',
          )}
        >
          {/*
            **서버 `name` 을 그대로 쓴다.** 아트보드는 모바일에서 "높음" 으로 줄였지만,
            그건 아트보드가 가정한 name 이 "적합도 높음" 이었기 때문이다. 실제 서버 값은
            "여행 적합" 이라 이미 짧고, 잘라내면 "적합" 이 되어 뜻이 달라진다.
            FE 가 서버 문구를 다시 쓰지 않는다 (api-integration-guide.md §6).
          */}
          <MetricBadge tone={tone}>{data.suitabilityLevel.name}</MetricBadge>
          {/*
            **접힌 행은 `row`(22/900), 1등은 `hero`(28/900).** `DESIGN.md` §1 —
            위계는 크기와 순서로 만든다. 색으로 만들지 않으므로 등급 색은 둘 다 그대로다.
            그 사이 크기는 없다 (§3-3).
          */}
          <Score score={data.score} tone={tone} size={collapsed ? 'row' : 'hero'} />
        </div>
      </Link>
    </li>
  )
}

/**
 * 행 태그 — 동반 가능 여부 · 실내/야외 · 혼잡도. 자리는 `className` 이 정하고,
 * **무엇까지 그릴지는 `attributes` 가 정한다.**
 *
 * **`petAllowanceType.code === 'UNKNOWN'` 이면 그리지 않는다** (#530). 서버 `name` 이
 * `정보 없음` 이라, 그대로 두면 `야외` · `혼잡도 정보 없음` 옆에 **무엇의 정보가 없다는
 * 것인지 말하지 않는 배지**가 한 자리를 차지했다. 옆 배지가 낱말을 갖고 있어 더 헷갈린다 —
 * 읽는 사람은 `정보 없음` 을 바로 앞 태그에 걸어 읽는다.
 *
 * **낱말을 보태지 않는다.** 혼잡도는 `CongestionBadge` 가 `혼잡도 정보 없음` 으로 보태는데
 * (명세가 정해 둔 문구다), 동반 가능 여부는 그런 문구가 정해져 있지 않다 — 여기서 지어내면
 * FE 가 서버 문구를 다시 쓰는 것이 된다 (api-integration-guide.md §6). 없는 값은 **자리도
 * 내지 않는다**: 실내 여부(`indoor === null`)를 이 행이 이미 그렇게 다룬다.
 *
 * **`code` 로 거른다.** `name` 은 서버 문구라 언제든 바뀔 수 있고, 문구 비교는 그때 조용히
 * 어긋난다 (docs/api-integration-guide.md §6).
 *
 * 셋 다 없으면 **`null` 이다.** 빈 `div` 를 남기면 `order-first mb-1.5` 만 남아 제목 위에
 * 6px 이 뜬다.
 */
function RowTags({
  place,
  congestion,
  attributes = true,
  className,
}: {
  place: PlaceSummary | undefined
  congestion: CongestionItem | null
  /**
   * 속성 태그(동반 가능 여부 · 실내/야외)를 함께 그릴지. **접힌 행은 `false` 다** —
   * 안 바뀌는 값은 접고 오늘의 판정(혼잡도)만 남긴다.
   */
  attributes?: boolean
  className?: string
}) {
  const allowance =
    attributes && place !== undefined && place.petAllowanceType.code !== UNKNOWN_CODE
      ? place.petAllowanceType.name
      : null
  const indoor =
    !attributes || place === undefined || place.indoor === null
      ? null
      : place.indoor
        ? messages.home.indoor
        : messages.home.outdoor

  if (allowance === null && indoor === null && congestion === null) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {allowance !== null && <Badge tone="neutral">{allowance}</Badge>}
      {indoor !== null && <Badge tone="neutral">{indoor}</Badge>}
      <CongestionBadge congestion={congestion} />
    </div>
  )
}

/**
 * 혼잡도 배지 — 공통명세 S3-3 · 홈-세부명세 D5-1 §12.
 *
 * **섹션 부제가 "오늘 날씨와 혼잡도 반영" 이라고 말하는데 화면에는 없었다.** 값은
 * 적합도 응답의 `congestion` 으로 이미 와 있고(추가 호출 없음), `reasons` 에는 섞여
 * 오지 않는다 — dev 실측에서 `혼잡`(집중률 72.4%)인 장소의 `reasons` 가
 * `PET_ALLOWED` · `HEAT_RISK` 뿐이었다. 즉 근거 문장에 기대면 혼잡도는 영영 안 보인다.
 *
 * **톤은 적합도와 뒤집혀 있다.** `LOW`(한산)가 좋은 쪽이라 `congestionTone` 을 쓴다 —
 * 공용 매퍼를 쓰면 "혼잡" 이 초록으로 나간다 (`lib/insight/tone.ts`).
 *
 * `UNKNOWN` 은 **낱말을 FE 가 보탠다.** 서버 `name` 이 "정보 없음" 인데 배지 하나로 서면
 * 무엇의 정보가 없는지 알 수 없다 — 명세가 "혼잡도 정보 없음" 을 정해 둔 이유다. 색은
 * 주지 않고 점선 테두리로만 남는다 (DESIGN.md §2-3 — 혼잡도가 실제로 이 상태로 온다).
 *
 * **`null` 이면 그리지 않는다.** 계약이 `congestion` 자체를 null 로 줄 수 있고, 그때는
 * 등급이 `UNKNOWN` 인 것과도 다르다 — 서버가 이 축을 아예 판정하지 않은 것이다.
 */
function CongestionBadge({ congestion }: { congestion: CongestionItem | null }) {
  if (congestion === null) return null

  const unknown = congestion.level.code === UNKNOWN_CODE

  return (
    <MetricBadge tone={congestionTone(congestion.level.code)}>
      {unknown ? messages.home.congestionUnknown : congestion.level.name}
    </MetricBadge>
  )
}

function Score({
  score,
  tone,
  size,
  // `exactOptionalPropertyTypes` 라 undefined 를 그대로 넘길 수 없다 — 기본값으로 받는다
  className = '',
}: {
  score: number | null
  tone: MetricTone
  size: 'row' | 'hero'
  className?: string
}) {
  /*
    null 은 0점이 아니라 "점수를 내지 않았다" 는 뜻이다. 자리를 0 으로 채우지 않고,
    **대체 문구도 두지 않는다** — 바로 위 배지가 이미 서버 등급어("판단 근거 부족")로
    같은 말을 한다. 둘 다 그리면 한 행에서 같은 문장이 두 번 보인다.
  */
  if (score === null) return null

  return <MetricValue value={score} unit="/100" tone={tone} size={size} className={className} />
}

function Thumbnail({
  place,
  collapsed = false,
}: {
  place: PlaceSummary | undefined
  collapsed?: boolean
}) {
  const url = imageSrc(place?.firstImage ?? null)
  const illustration = placeIllustration(place?.contentType.code ?? null)

  /*
    접힌 행의 썸네일은 96 → 48 이다. **이것이 없으면 접기가 높이를 못 줄인다** — 행 높이를
    96px 썸네일이 잡고 있어, 근거 두 줄을 걷어도 실측 136px 그대로였다 (#304 계측).
    모바일은 `size-20` 그대로다.
  */
  return (
    <span
      className={cn(
        'bg-band relative flex size-20 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-md',
        collapsed ? 'md:size-12' : 'md:size-24',
      )}
    >
      {url !== null ? (
        <Image
          src={url}
          alt=""
          fill
          sizes={collapsed ? '(min-width: 768px) 48px, 80px' : '(min-width: 768px) 96px, 80px'}
          className="object-cover"
        />
      ) : illustration !== null ? (
        /* 사진이 없으면 카테고리 일러스트 — 장식이므로 alt="" (`lib/place/illustration.ts`) */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={illustration} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <ImageIcon size={20} className="text-fg-subtle" />
          {/* 48px 타일에는 낱말이 들어가지 않는다 — 데스크톱 접힘에서만 뗀다 */}
          <span className={cn('text-caption text-fg-muted font-medium', collapsed && 'md:hidden')}>
            {messages.place.noImage}
          </span>
        </>
      )}
    </span>
  )
}

/**
 * `제주시 한림읍 · 실내` — 아트보드의 메타 줄.
 *
 * **전체 주소를 쓰지 않는다.** `addr1` 은 `제주특별자치도 제주시 한림읍 용금로 906-107` 처럼
 * 길어 375px 에서 두 줄을 먹고 제목·점수를 밀어낸다. 아트보드도 시군구·읍면 수준까지만 쓴다.
 *
 * 거리(`2.3km`)는 아트보드에 있으나 **백엔드가 주지 않아 넣지 않는다** — 지어내지 않는다.
 */
function metaLine(place: PlaceSummary | undefined): string {
  if (place === undefined) return ''

  const indoor =
    place.indoor === null ? null : place.indoor ? messages.home.indoor : messages.home.outdoor

  return [shortAddress(place.addr1), indoor]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ')
}
