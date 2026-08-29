import Image from 'next/image'
import Link from 'next/link'

import { ImageIcon } from '@/components/icons'
import { MetricBadge, type MetricTone, MetricValue } from '@/components/metric'
import { isAllowedImageHost } from '@/lib/image/remote-host'
import { splitReasons } from '@/lib/insight/reasons'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
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
 * **배지 문구가 폭마다 다르다** — 모바일은 짧게("높음"), 데스크톱은 "적합도 높음".
 * 모바일은 섹션 제목이 이미 적합도를 말하고 있어 반복할 필요가 없다.
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
          {/* 모바일: 제목과 배지를 양끝으로. 데스크톱: 붙여서 왼쪽 정렬 */}
          <div className="flex items-start justify-between gap-2 md:items-center">
            <span className="text-title-2 text-fg min-w-0 flex-1 font-semibold break-words">
              {data.placeTitle}
            </span>
            {/*
              **서버 `name` 을 그대로 쓴다.** 아트보드는 모바일에서 "높음" 으로 줄였지만,
              그건 아트보드가 가정한 name 이 "적합도 높음" 이었기 때문이다. 실제 서버 값은
              "여행 적합" 이라 이미 짧고, 잘라내면 "적합" 이 되어 뜻이 달라진다.
              FE 가 서버 문구를 다시 쓰지 않는다 (api-integration-guide.md §6).
            */}
            <MetricBadge tone={tone} className="shrink-0">
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

        {/* 데스크톱 태그 열 — 동반 가능 여부를 첫 태그로, 최대 3개 */}
        {place !== undefined && (
          <div className="hidden w-36 shrink-0 flex-wrap justify-end gap-1.5 md:flex">
            <span className="text-caption bg-band rounded-sm px-2 py-1 font-medium">
              {place.petAllowanceType.name}
            </span>
            {place.indoor !== null && (
              <span className="text-caption bg-band rounded-sm px-2 py-1 font-medium">
                {place.indoor ? messages.home.indoor : messages.home.outdoor}
              </span>
            )}
          </div>
        )}

        {/* 데스크톱 점수 열 */}
        <Score
          score={data.score}
          tone={tone}
          size="hero"
          className="hidden w-20 shrink-0 items-end md:flex"
        />
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
  // null 은 0점이 아니라 "점수를 내지 않았다" 는 뜻이다. 자리를 0 으로 채우지 않는다
  if (score === null) {
    return (
      <p className={cn('text-body-2 text-fg-muted', className)}>{messages.home.scoreUnavailable}</p>
    )
  }

  return <MetricValue value={score} unit="/100" tone={tone} size={size} className={className} />
}

function Thumbnail({ place }: { place: PlaceSummary | undefined }) {
  const url = place?.firstImage ?? null
  const usable = isAllowedImageHost(url) && url !== null

  return (
    <span className="bg-band relative flex size-20 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-md md:size-24">
      {usable ? (
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

/**
 * 광역 접두사를 떼고 앞 두 마디만 남긴다.
 * `제주특별자치도 제주시 한림읍 용금로 906-107` → `제주시 한림읍`
 */
export function shortAddress(addr1: string | null): string | null {
  if (addr1 === null || addr1.trim() === '') return null

  const parts = addr1.trim().split(/\s+/)
  // 제주 전용 서비스라 광역 이름은 정보가 없다
  const withoutProvince =
    parts[0]?.startsWith('제주') === true && parts.length > 1 ? parts.slice(1) : parts

  return withoutProvince.slice(0, 2).join(' ')
}
