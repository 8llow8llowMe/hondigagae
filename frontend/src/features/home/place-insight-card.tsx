import Image from 'next/image'
import Link from 'next/link'

import type { ReactNode } from 'react'

import { ImageIcon } from '@/components/icons'
import { METRIC_WORD_TONE, type MetricTone, MetricValue } from '@/components/metric'
import { imageSrc } from '@/lib/image/remote-host'
import { crowdedLabel, type PlaceCardsEnd } from '@/lib/insight/place-cards'
import { congestionTone, suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { placeIllustration } from '@/lib/place/illustration'
import { cn } from '@/lib/utils/cn'
import type { PlaceSuitabilityResponse, SuitabilityReasonItem } from '@/types/insight'
import type { PlaceSummary } from '@/types/place'

/**
 * 서버가 "판정하지 않았다" 를 말하는 코드. 동반 가능 여부도 이 값을 쓴다 — **낱말(`정보
 * 없음`)이 아니라 이 코드로 거른다** (#530).
 */
const UNKNOWN_CODE = 'UNKNOWN'

/**
 * 끝 카드의 그리드 칸 수 (`PlaceCardsEnd.span`). 클래스 이름을 문자열로 조립하면 Tailwind 가
 * 찾지 못해 조용히 빠진다 — 완성된 이름을 표로 둔다.
 */
const END_SPAN: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
}

/**
 * 홈 추천 장소를 담는 틀 (#1069). **담는 틀만 폭으로 가른다 — 카드는 한 벌이다.**
 *
 * - **1024 미만 — 캐러셀.** 카드 폭 82%(`--home-place-card-w`)라 다음 카드가 비쳐 보인다.
 *   **그것이 넘김 신호라 화살표를 두지 않는다.** `scroll-snap` 으로 카드 경계에서 멈추고,
 *   1위가 항상 첫 장이다(DOM 순서 그대로).
 * - **1024 이상 — 3열 그리드.** 추천이 최대 3곳이라 한 줄에 다 선다. 캐러셀로 숨기지
 *   않는다 — 가려진 카드는 비교되지 않는다.
 *
 * **기준이 1024 인 이유**는 홈이 2단으로 갈라지는 폭이라서다(`.rail-layout`). 그 아래는 이
 * 카드가 한 컬럼의 전폭을 받는다. 예전 행(`place-insight-row`)은 컨테이너 쿼리로 접었는데
 * (#530), 그건 **한 행 안의 열 구성**이 받은 폭에 달려 있어서였다. 여기서 갈리는 것은
 * 틀의 종류이고, 그 틀이 바뀌는 지점이 곧 홈의 레이아웃이 바뀌는 지점이다.
 *
 * ### 스크롤러의 폭 누수를 막는다
 *
 * `contain-layout` 이 없으면 넘치는 카드 폭이 조상의 `scrollWidth` 로 새어 390 에서
 * `main` 이 가로로 늘어난다 — `.scroll-rail` 머리주석(`app/globals.css`)이 적어 둔 증상이다.
 * 화살표가 없어 `.scroll-rail` 을 쓰지 않고 그 한 줄만 가져온다.
 *
 * ### 세로 여백이 포커스 링의 자리다
 *
 * `overflow-x-auto` 는 세로도 잘라, 카드 링크의 링(`ring-2`)이 위아래로 잘린다. `pt-1` 이
 * 그 4px 를 낸다. 아래는 카드 본문 여백(`pb-4 md:pb-5`)이 겸한다.
 */
export function PlaceInsightCardList({
  children,
  busy = false,
}: {
  children: ReactNode
  /** 재조회 중 — 목록을 흐리고 `aria-busy` 를 건다 */
  busy?: boolean
}) {
  return (
    <ul
      aria-busy={busy || undefined}
      className={cn(
        // 캐러셀 — 인셋과 스냅 기준을 같은 값으로 둔다 (첫 카드가 제목과 같은 세로선에 선다)
        'flex snap-x snap-mandatory scroll-px-4 scrollbar-none gap-3 overflow-x-auto px-4 pt-1 pb-4 contain-layout md:scroll-px-5 md:px-5 md:pb-5',
        // 그리드 — 1024 이상. 스크롤과 스냅을 끈다
        'lg:grid lg:snap-none lg:grid-cols-3 lg:gap-4 lg:overflow-visible',
        busy && 'opacity-55',
      )}
    >
      {children}
    </ul>
  )
}

/**
 * 추천 장소 카드 — 순서는 **전제 → 정체 → 판정** (#1069).
 *
 * 1. **전제** — 사진 16:10(없으면 카테고리 일러스트) 왼쪽 위에 동반 여부 칩. 들어갈 수
 *    있는지가 첫 질문이라 가장 먼저 읽힌다.
 * 2. **정체** — 제목 18/600 최대 2줄, 그 아래 `지역 · 실내외` 한 줄. **제목 옆에 아무것도
 *    두지 않는다** — 행 시절에는 오른쪽 칸에 칩 3개 + 배지 + 점수가 몰려 모바일 제목이 세
 *    줄로 꺾였다(`오설록 / 티뮤지엄 / 카페`).
 * 3. **판정** — `82/100` · 등급어 · (혼잡할 때만) `· 혼잡` 이 한 줄.
 *
 * **점수는 왼쪽이다.** 캐러셀·그리드는 세로로 늘어선 값을 견주지 않아 오른쪽 정렬의 이유가
 * 없고, 제목과 같은 왼쪽 선에서 `82/100 여행 적합` 이 한 문장으로 읽힌다.
 *
 * **카드 안 항목에 테두리를 두르지 않는다** (DESIGN.md §0). 이 카드는 `Surface`(L1) 안의
 * L2 항목이다 — 경계는 사진 면과 카드 사이 간격이 맡는다.
 *
 * **동반 여부는 모든 순위에 나온다.** 행 시절 2위 이하는 접혀서 칩을 그리지 않았는데, 응답
 * `petAllowanceType` 에는 값이 있었다. 카드는 순위로 접지 않는다 — 위계는 순서가 만든다.
 */
export function PlaceInsightCard({
  data,
  place,
  reason = null,
}: {
  data: PlaceSuitabilityResponse
  /** 목록 응답의 장소. 사진·주소·실내 여부·동반 여부는 적합도 응답에 없다 */
  place: PlaceSummary | undefined
  /**
   * 이 장소만의 근거 한 줄 (`pickCardReason`). **카드가 고르지 않는다** — 무엇이 공통인지는
   * 다른 카드를 봐야 알 수 있고, 그것은 목록을 가진 쪽만 안다.
   */
  reason?: SuitabilityReasonItem | null
}) {
  const tone = suitabilityTone(data.suitabilityLevel.code)
  const crowded = crowdedLabel(data.congestion)
  const allowance =
    place !== undefined && place.petAllowanceType.code !== UNKNOWN_CODE
      ? place.petAllowanceType.name
      : null
  const meta = metaLine(place)

  return (
    <li className="w-(--home-place-card-w) shrink-0 snap-start last:snap-end lg:w-auto">
      <Link
        href={`/places/${data.placeId}`}
        className="focus-visible:ring-brand-500 flex h-full flex-col rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Photo place={place} allowance={allowance} />

        {/* `<a>` 는 flow content 를 담는다 — 판정 줄의 `div`(`MetricValue`)도 된다. 나머지는 `span` */}
        <span className="text-title-2 text-fg mt-3 line-clamp-2 font-semibold break-keep">
          {data.placeTitle}
        </span>

        {meta !== '' && <span className="text-caption text-fg-muted mt-1 font-medium">{meta}</span>}

        <Verdict
          score={data.score}
          tone={tone}
          level={data.suitabilityLevel.name}
          crowded={crowded}
          crowdedTone={congestionTone(data.congestion?.level.code)}
        />

        {/*
          **그 장소만의 근거 한 줄 — `md` 이상.** 모바일은 세로 자리가 없어 상세에서 읽는다
          (행 시절과 같은 선). 목록 위 공통 근거도 `md` 부터라 둘이 같은 폭에서 켜진다 —
          갈리면 공통 문장을 걷어 낸 카드가 걷어 낸 문장 없이 서는 폭이 생긴다.

          **서버 문장 그대로, 자르지 않는다.** 줄 수를 막으면 근거가 말하는 조건(`오전 10시
          전에는`)이 잘려 나간다.
        */}
        {reason !== null && (
          <span
            className={cn(
              'text-body-2 mt-2 hidden break-keep md:block',
              reason.scoreDelta === 0 ? 'text-fg-muted' : 'text-fg',
            )}
          >
            {reason.description}
          </span>
        )}
      </Link>
    </li>
  )
}

/**
 * 끝 카드 — 카드가 칸을 다 채우지 못한 날 빈 칸을 채운다 (`placeCardsEnd`).
 *
 * **`--band` 채움이다.** L2 항목의 채널이 채움이라(DESIGN.md §0) 테두리를 두르지 않고, 사진
 * 카드와 같은 폭·높이의 면으로 선다 — 캐러셀에서는 마지막 장이고 그리드에서는 빈 칸이다.
 *
 * 점수를 못 낸 곳의 안내가 **여기에 든다.** 예전에는 목록 아래 버튼 줄 둘(`점수를 내지 못한
 * 곳 N곳 ›` · `장소 N곳 전체 보기`)이 따로 섰는데, 둘 다 `/places` 로 가는 같은 링크였다.
 */
export function PlaceCardsEndCard({ end }: { end: PlaceCardsEnd }) {
  return (
    <li
      className={cn(
        'w-(--home-place-card-w) shrink-0 snap-start last:snap-end lg:w-auto',
        // 그리드에서는 남은 빈 칸을 전부 채운다 — 카드가 한 장이면 셋째 칸이 구멍으로 남는다
        END_SPAN[end.span] ?? END_SPAN[1],
      )}
    >
      <Link
        href="/places"
        className="group bg-band focus-visible:ring-brand-500 flex h-full min-h-40 flex-col justify-center gap-1 rounded-md px-5 py-6 focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="text-body-1 text-link group-hover:text-link-hover font-semibold break-keep tabular-nums">
          {messages.home.allPlaces.replace('{n}', String(end.total))}
          {/* 줄바꿈 없는 공백 — 1024 의 좁은 칸에서 꺾쇠만 다음 줄로 떨어졌다 */}
          <span aria-hidden>{' ›'}</span>
        </span>
        {end.unscored > 0 && (
          <span className="text-body-2 text-fg-muted tabular-nums">
            {messages.home.unscoredInAllPlaces.replace('{n}', String(end.unscored))}
          </span>
        )}
      </Link>
    </li>
  )
}

/**
 * 판정 줄 — `82/100` 숫자만 등급 색, 등급어는 **상자 없이 글자**, 혼잡할 때만 `· 혼잡`.
 *
 * - 숫자는 `MetricValue` `row`(22/900) — 등급 색을 숫자에 쓸 수 있는 하한이다(DESIGN.md §2-3).
 * - 등급어는 `-700` 층 글자(`METRIC_WORD_TONE`). 배지를 두면 한 줄에 상자와 숫자가 겹쳐 서
 *   무게가 둘로 갈린다 — 결론은 숫자이고 등급어는 그 숫자를 읽는 말이다. `MetricWord`(20/800)
 *   는 블록의 결론 크기라 쓰지 않는다: 숫자 옆에서 등급어가 숫자만큼 커진다.
 * - **서버 `name` 을 그대로 쓴다.** FE 가 등급 한국어를 다시 쓰지 않는다.
 * - 점수가 `null` 이면 숫자 자리를 비운다 — 0점이 아니라 "점수를 내지 않았다" 이고, 등급어
 *   (`판단 근거 부족`)가 같은 말을 한다.
 *
 * `flex-wrap` 이다 — 1024 의 그리드 칸(약 170)에서 `여행 적합 · 혼잡` 이 다음 줄로 내려가야
 * 가로로 넘치지 않는다.
 */
function Verdict({
  score,
  tone,
  level,
  crowded,
  crowdedTone,
}: {
  score: number | null
  tone: MetricTone
  level: string
  crowded: string | null
  crowdedTone: MetricTone
}) {
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
      {score !== null && <MetricValue value={score} unit="/100" tone={tone} size="row" />}
      <span className={cn('text-body-2 font-semibold', METRIC_WORD_TONE[tone])}>{level}</span>
      {crowded !== null && (
        <span className={cn('text-body-2 font-semibold', METRIC_WORD_TONE[crowdedTone])}>
          <span aria-hidden>· </span>
          {crowded}
        </span>
      )}
    </div>
  )
}

/**
 * 사진 16:10 — **없어도 같은 비율의 면을 남긴다.** 카드 높이가 흔들리면 캐러셀의 카드끼리,
 * 그리드의 칸끼리 줄이 어긋난다.
 *
 * 동반 칩은 **사진 위에 떠 있다** — 흰 바탕 + `--shadow-md`. 밝은 사진(하늘 · 흰 벽) 위에서
 * 흰 칩의 경계가 사라져 그림자로 되찾는다. DESIGN.md §6 의 "실제로 떠 있는 것" 이다.
 * `Badge` 를 쓰지 않는 이유: `neutral` 은 `--band` 채움이라 사진 위에서 회색 얼룩이 되고,
 * 외형을 `className` 으로 덮을 수는 없다(component-guide §3).
 */
function Photo({
  place,
  allowance,
}: {
  place: PlaceSummary | undefined
  allowance: string | null
}) {
  const url = imageSrc(place?.firstImage ?? null)
  const illustration = placeIllustration(place?.contentType.code ?? null)

  return (
    <span className="bg-band relative flex aspect-16/10 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md">
      {url !== null ? (
        <Image
          src={url}
          alt=""
          fill
          // 캐러셀은 뷰포트의 약 82%, 그리드는 우측 열의 1/3
          sizes="(min-width: 1024px) 320px, 82vw"
          className="object-cover"
        />
      ) : illustration !== null ? (
        /* 사진이 없으면 카테고리 일러스트 — 장식이므로 alt="" (`lib/place/illustration.ts`) */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={illustration} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <ImageIcon size={20} className="text-fg-subtle" />
          <span className="text-caption text-fg-muted font-medium">{messages.place.noImage}</span>
        </>
      )}

      {allowance !== null && (
        <span className="bg-bg text-caption text-fg absolute top-2 left-2 rounded-sm px-2 py-1 font-semibold shadow-md">
          {allowance}
        </span>
      )}
    </span>
  )
}

/**
 * `제주시 한림읍 · 실내` — 메타 줄.
 *
 * **전체 주소를 쓰지 않는다.** `addr1` 은 길어 375px 에서 두 줄을 먹는다. 시군구·읍면까지만.
 * 거리(`2.3km`)는 **백엔드가 주지 않아 넣지 않는다** — 지어내지 않는다.
 */
function metaLine(place: PlaceSummary | undefined): string {
  if (place === undefined) return ''

  const indoor =
    place.indoor === null ? null : place.indoor ? messages.home.indoor : messages.home.outdoor

  return [shortAddress(place.addr1), indoor]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ')
}
