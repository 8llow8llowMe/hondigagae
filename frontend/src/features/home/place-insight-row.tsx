import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ImageIcon } from '@/components/icons'
import { MetricBadge, type MetricTone, MetricValue } from '@/components/metric'
import { imageSrc } from '@/lib/image/remote-host'
import { splitReasons } from '@/lib/insight/reasons'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { cn } from '@/lib/utils/cn'
import type { PlaceSuitabilityResponse } from '@/types/insight'
import type { PlaceSummary } from '@/types/place'

/**
 * 적합도 행 — 아트보드 `01 홈 · P2` (모바일) / `02 홈` 우측 (데스크톱).
 *
 * **카드가 아니라 전폭 행이다.** 구분선은 좌우 인셋 16(모바일) / 40(데스크톱).
 *
 * 썸네일 80(모바일) / 96(데스크톱) radius 8. `firstImage` 가 null 이어도 **같은 크기의
 * "이미지 없음" 타일**을 남긴다 — 행 높이가 흔들리면 목록을 훑을 수 없다.
 *
 * **배지 자리가 폭마다 다르다** — 모바일은 제목 오른쪽, 데스크톱은 **행의 오른쪽 위**
 * (점수 열 옆 판정 열). 문구는 양쪽 다 서버 `name` 그대로다.
 *
 * **점수는 제목 아래로 내린다** — 썸네일이 왼쪽 기둥을 잡으므로 오른쪽에 또 기둥을
 * 세우면 제목이 눌린다. 데스크톱은 폭이 있어 우측 열로 뺀다.
 */
export function PlaceInsightRow({
  data,
  place,
  first = false,
}: {
  data: PlaceSuitabilityResponse
  /** 목록 응답의 장소. 썸네일·주소·실내 여부는 인사이트 응답에 없다 */
  place: PlaceSummary | undefined
  /** 첫 행은 위 구분선을 그리지 않는다 — 섹션 제목과 붙는다 */
  first?: boolean
}) {
  const tone = suitabilityTone(data.suitabilityLevel.code)
  const { penalties, informational } = splitReasons(data.reasons)
  // 데스크톱에만 근거 문장을 둔다. 모바일은 세로 공간이 없다
  const lines = [...penalties, ...informational].slice(0, 2)

  return (
    <li className={cn('bg-bg', !first && 'border-border border-t')}>
      <Link
        href={`/places/${data.placeId}`}
        className="focus-visible:ring-brand-500 flex items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:gap-5 md:px-10 md:py-5"
      >
        <Thumbnail place={place} />

        {/*
          `<a>` 는 flow content 를 담을 수 있으므로 행 내부 래퍼는 `div` 다.
          **`span` 으로 두면 안 된다** — `MetricValue` 가 `div` 를 렌더해 `span` 안의 `div`
          가 되고, 무효 HTML 이라 하이드레이션 경고가 난다.
        */}
        <div className="min-w-0 flex-1">
          {/*
            모바일은 제목과 배지를 양끝으로 벌린다. **데스크톱은 배지를 여기 두지 않는다** —
            오른쪽 판정 열로 옮겼다(아래 주석).
          */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-title-2 text-fg min-w-0 flex-1 font-semibold break-words">
              {data.placeTitle}
            </span>
            <MetricBadge tone={tone} className="shrink-0 md:hidden">
              {data.suitabilityLevel.name}
            </MetricBadge>
          </div>

          <p className="text-caption text-fg-muted mt-0.5 font-medium tabular-nums">
            {metaLine(place)}
          </p>

          {/* 근거는 데스크톱에만. 모바일은 상세에서 읽는다 */}
          {lines.length > 0 && (
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

          {/* 모바일 점수 — 제목 아래 */}
          <Score score={data.score} tone={tone} size="row" className="mt-1 md:hidden" />
        </div>

        {/* 데스크톱 속성 태그 열 — 동반 가능 여부를 첫 태그로 */}
        {place !== undefined && (
          <div className="hidden w-36 shrink-0 flex-wrap justify-end gap-1.5 self-start md:flex">
            <Badge tone="neutral">{place.petAllowanceType.name}</Badge>
            {place.indoor !== null && (
              <Badge tone="neutral">
                {place.indoor ? messages.home.indoor : messages.home.outdoor}
              </Badge>
            )}
          </div>
        )}

        {/*
          데스크톱 판정 열 — **배지가 점수 바로 위**, 행의 오른쪽 끝.

          배지를 제목 옆에 두면 제목 길이에 따라 x 가 흔들리고 근거 문장과 같은 폭에서
          경쟁한다. 점수 위로 모으면 둘이 한 덩어리로 읽힌다 — 등급어와 수치는 같은
          판정을 두 해상도로 말하는 것이라 붙어 있어야 한다.

          **`self-start` 다.** 행은 썸네일 높이로 세로 중앙 정렬이라, 이것이 없으면 덩어리가
          가운데로 내려와 "오른쪽 위" 가 되지 않는다.

          **폭은 `w-28`.** 가장 긴 배지("판단 근거 부족")가 한 줄에 들어가는 값이다.
          점수(`82 /100`)보다 배지가 넓어 열 폭은 배지가 정한다.
        */}
        <div className="hidden w-28 shrink-0 flex-col items-end gap-1.5 self-start md:flex">
          {/*
            **서버 `name` 을 그대로 쓴다.** 아트보드는 모바일에서 "높음" 으로 줄였지만,
            그건 아트보드가 가정한 name 이 "적합도 높음" 이었기 때문이다. 실제 서버 값은
            "여행 적합" 이라 이미 짧고, 잘라내면 "적합" 이 되어 뜻이 달라진다.
            FE 가 서버 문구를 다시 쓰지 않는다 (api-integration-guide.md §6).
          */}
          <MetricBadge tone={tone}>{data.suitabilityLevel.name}</MetricBadge>
          <Score score={data.score} tone={tone} size="hero" />
        </div>
      </Link>
    </li>
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

function Thumbnail({ place }: { place: PlaceSummary | undefined }) {
  const url = imageSrc(place?.firstImage ?? null)

  return (
    <span className="bg-band relative flex size-20 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-md md:size-24">
      {url !== null ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="(min-width: 768px) 96px, 80px"
          className="object-cover"
        />
      ) : (
        <>
          <ImageIcon size={20} className="text-fg-subtle" />
          <span className="text-caption text-fg-muted font-medium">{messages.place.noImage}</span>
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
