import Image from 'next/image'
import Link from 'next/link'

import type { Ref } from 'react'

import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import { ThumbnailTile } from '@/components/thumbnail-tile'
import {
  PlaceDetailActionBar,
  type PlaceDetailActions,
} from '@/features/place/place-detail-action-bar'
import { verdictSummaryLines } from '@/features/place/place-verdict-summary-lines'
import { PlaceVisitKeyLine } from '@/features/place/place-visit-key-line'
import { imageSrc } from '@/lib/image/remote-host'
import { listThumbnailSrc } from '@/lib/image/thumbnail'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { placeIllustration } from '@/lib/place/illustration'
import { placeMetaLine } from '@/lib/place/meta'
import { cn } from '@/lib/utils/cn'
import type { PlaceSuitabilityResponse, WalkSafetyResponse } from '@/types/insight'
import type { PlaceDetail, PlaceSummary } from '@/types/place'

/** 혼잡도는 미리보기에 싣지 않는다 — `verdictSummaryLines` 가 이 값이면 그 줄을 만들지 않는다 */
const NO_CONGESTION = { data: null, loading: false, failed: false } as const

export type PlaceMapPreviewVariant = 'panel' | 'sheet'

type Source<T> = { data: T | null; loading: boolean; failed: boolean }

export type PlaceMapPreviewBodyProps = {
  placeId: string
  /** `panel` = 데스크톱 지도 위 카드, `sheet` = 모바일 하단 시트 */
  variant: PlaceMapPreviewVariant
  onClose: () => void
  /** 지금 목록에 있는 같은 장소. 없으면(공유 링크 · 재검색 밖) 상세 응답으로 그린다 */
  summary: PlaceSummary | null
  detail: Source<PlaceDetail>
  suitability: Source<PlaceSuitabilityResponse>
  walkSafety: Source<WalkSafetyResponse>
  /** 선택된 반려견 이름. 없으면 적합도 근거 줄을 그리지 않는다 */
  petName: string | null
  /** 상세 하단 바 그대로 (`PlaceDetailActionBar`) */
  actions: PlaceDetailActions
  /** 열릴 때 포커스를 받는 이름 — 컨테이너가 쥔다 (`place-map-preview.tsx`) */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

/**
 * 미리보기의 표시 부분 — **props 만 받는다** (#1227). node 환경에서 렌더 갈래를 테스트하려고
 * 조회 · 상태를 쥔 컨테이너(`PlaceMapPreview`)와 나눴다 — `PlaceDetailView` / `PlaceDetailSection`
 * 과 같은 분리다 (testing-guide.md §1).
 *
 * **두 겹으로 그린다.** 목록 행(`summary`)으로 이름 · 사진 · 메타를 즉시 그리고, 상세 · 판정이 오는
 * 대로 나머지 줄을 채운다. 목록에 없는 id 면 상세 응답이 그 자리를 채운다.
 *
 * **줄마다 따로 실패한다.** 판정 하나가 죽어도 그 줄만 빠진다. 재시도는 상세 화면이 갖는다.
 */
export function PlaceMapPreviewBody({
  placeId,
  variant,
  onClose,
  summary,
  detail,
  suitability,
  walkSafety,
  petName,
  actions,
  headingRef,
}: PlaceMapPreviewBodyProps) {
  const place = detail.data
  const title = summary?.title ?? place?.title ?? null
  const contentTypeCode = summary?.contentType.code ?? place?.contentType.code ?? null
  /* 메타는 목록 행과 같은 줄이다 — 거리는 거리순 목록에서만 온다 (`placeMetaLine`) */
  const meta =
    summary !== null
      ? placeMetaLine(summary.addr1, summary.indoor, summary.distanceMeters)
      : place !== null
        ? placeMetaLine(place.addr1, place.indoor)
        : null
  const level = suitability.data?.suitabilityLevel ?? null
  const inset = variant === 'sheet' ? 'px-4' : 'px-5'

  /*
    목록에도 없고 상세도 못 받았다 — 말할 이름이 없다. 문구 · `상세 보기` · 닫기만 남긴다.
    404(사라진 id)와 5xx 를 가르지 않고 재시도를 달지 않는다: 여기는 상세로 가는 입구이고,
    상세가 404 는 빈 화면으로, 5xx 는 재시도로 제대로 가른다.
  */
  const failed = title === null && detail.failed

  return (
    <section
      aria-label={messages.map.previewLabel}
      /*
        면(배경 · 테두리 · 곡률 · 그림자)은 **담는 쪽이 갖는다** (`place-map-view.tsx`) — 지도 위에
        뜨는 표면의 소유자가 그 파일이다 (`token-usage.test.ts` FLOATING). 여기는 세로 배치만 한다.

        **`min-h-0` 이 없으면 하단 바가 잘린다** (리뷰 실측). 모바일 시트는 높이가 아니라 상한만
        있어 `h-full` 이 풀리지 않고, flex 항목의 `min-height: auto` 가 내용 높이 아래로 줄지 않게
        막는다 — 667 높이 폰에서 반려견 줄까지 오면 저장 · 담기가 시트 밖으로 나갔다.
      */
      className="flex h-full max-h-full min-h-0 flex-col"
    >
      <PreviewTopBar placeId={placeId} title={title} variant={variant} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {failed ? (
          <p className={cn('text-body-2 text-fg-muted py-6', inset)}>
            {messages.map.previewLoadFailed}
          </p>
        ) : title === null ? (
          <PreviewSkeleton />
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {variant === 'panel' && (
              <PreviewPhoto
                src={
                  imageSrc(summary?.firstImage ?? place?.firstImage ?? null) ??
                  listThumbnailSrc(summary?.firstImage2 ?? null, null)
                }
                illustration={placeIllustration(contentTypeCode)}
              />
            )}

            <div className={cn('flex gap-3', inset)}>
              {variant === 'sheet' && (
                <ThumbnailTile
                  src={listThumbnailSrc(
                    summary?.firstImage2 ?? null,
                    summary?.firstImage ?? place?.firstImage ?? null,
                  )}
                  illustration={placeIllustration(contentTypeCode)}
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  {/*
                    공백 없는 긴 이름이 넘치지 않게 — 상세 `h1` 과 같은 이유 (`min-w-0`).
                    `tabIndex={-1}` — 열릴 때 포커스를 받는다(컨테이너). 탭 순서에는 들지 않는다.
                  */}
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-title-2 text-fg min-w-0 flex-1 font-bold break-words focus:outline-none"
                  >
                    {title}
                  </h2>
                  {/* 등급은 **왔을 때만** — 자리를 잡아 두면 빈 배지가 등급처럼 보인다 */}
                  {level !== null && (
                    <MetricBadge
                      tone={suitabilityTone(level.code)}
                      axis="suitability"
                      className="shrink-0"
                    >
                      {level.name}
                    </MetricBadge>
                  )}
                </div>
                {meta !== null && (
                  <p className="text-body-2 text-fg-muted line-clamp-1 tabular-nums">{meta}</p>
                )}
              </div>
            </div>

            {place !== null && (
              <div className={inset}>
                <PlaceVisitKeyLine
                  name={place.title}
                  open24={place.intro?.open24 ?? null}
                  openNow={place.intro?.openNow ?? null}
                  useTime={place.intro?.useTime ?? null}
                  tel={place.tel}
                  lat={place.lat}
                  lng={place.lng}
                />
              </div>
            )}

            <div className={inset}>
              <PreviewVerdicts
                place={place}
                placePending={detail.loading}
                suitability={suitability}
                walkSafety={walkSafety}
                petName={petName}
              />
            </div>
          </div>
        )}
      </div>

      {/*
        하단 바는 **상세의 것을 그대로 쓴다** — 저장 · 담기 · 미로그인 `로그인` · 사라진 장소 잠금이
        한 컴포넌트에 있다. 미리보기만의 바를 만들면 그 규칙이 두 벌이 된다.
        `상세 보기` 는 여기 넣지 않고 머리 줄에 둔다 — 390 에서 세 칸이면 담기가 좁아진다.
        `shrink-0` — 본문이 길어도 바는 줄지 않고 본문이 스크롤된다.
      */}
      {!failed && title !== null && (
        <PlaceDetailActionBar
          {...actions}
          inset={variant === 'panel' ? 'card' : 'panel'}
          className="shrink-0"
        />
      )}
    </section>
  )
}

/**
 * 머리 줄 — (1024~1279) `‹ 목록` · `상세 보기 ›` · 닫기.
 *
 * **`‹ 목록` 은 `xl` 에서 사라진다.** 1280 부터는 목록이 옆에 그대로 있어 돌아갈 곳이 없다.
 * 시트(모바일)에도 없다 — 닫으면 목록 시트가 돌아온다. 시트에 그래버를 두지 않는다 — 끌 수 없는데
 * 끌 수 있어 보인다.
 */
function PreviewTopBar({
  placeId,
  title,
  variant,
  onClose,
}: {
  placeId: string
  title: string | null
  variant: PlaceMapPreviewVariant
  onClose: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
      {variant === 'panel' && (
        <button
          type="button"
          onClick={onClose}
          className="text-link hover:text-link-hover focus-visible:ring-brand-500 text-body-2 inline-flex min-h-11 items-center gap-1 rounded-sm px-2 font-semibold focus-visible:ring-2 focus-visible:outline-none xl:hidden"
        >
          <ChevronLeftIcon size={16} aria-hidden />
          {messages.map.previewBackToList}
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Link
          href={`/places/${placeId}`}
          aria-label={
            title === null
              ? messages.map.previewDetail
              : messages.map.rowDetailLabel.replace('{title}', title)
          }
          className="text-link hover:text-link-hover focus-visible:ring-brand-500 text-body-2 inline-flex min-h-11 items-center gap-1 rounded-sm px-2 font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.map.previewDetail}
          <ChevronRightIcon size={16} aria-hidden />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label={messages.map.previewClose}
          className="text-fg-muted hover:text-fg hover:bg-band focus-visible:ring-brand-500 inline-flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <CloseIcon size={20} />
        </button>
      </div>
    </div>
  )
}

/**
 * 데스크톱 사진 한 장. **모자이크를 두지 않는다** — 고를 때마다 원본 여러 장을 받게 된다.
 * `next/image` 가 패널 폭(400)에 맞춰 줄여 받는다.
 */
function PreviewPhoto({ src, illustration }: { src: string | null; illustration: string | null }) {
  if (src === null && illustration === null) return null

  return (
    <div className="bg-band relative mx-5 h-40 shrink-0 overflow-hidden rounded-md">
      {src !== null ? (
        <Image src={src} alt="" fill sizes="400px" className="object-cover" />
      ) : (
        // 카테고리 일러스트 — `ThumbnailTile` 과 같은 처리다 (정적 자산이라 `img`)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={illustration ?? ''} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  )
}

/**
 * 판정 줄 — 적합도 근거 · 동반 · 지금 산책.
 *
 * 동반 · 산책은 **상세 판정 요약과 같은 함수**(`verdictSummaryLines`)로 만든다 — 같은 장소에
 * 같은 문장이 선다. 혼잡도 줄은 넘기지 않는다. 요약 컴포넌트를 그대로 쓰지 않는 이유는 둘이다:
 * 그것은 `lg:hidden` 이고(상세는 데스크톱에서 레일이 판정을 말한다) 줄마다 같은 문서 안
 * 앵커로 뛴다 — 미리보기에는 그 앵커가 없다.
 *
 * **적합도 근거는 반려견이 있을 때만 선다.** 상세도 게스트에게 점수 · 근거를 보이지 않는다
 * (`place-detail-view.tsx` — 기준이 되는 반려견이 없다). 등급은 이름 옆 배지가 말한다.
 */
function PreviewVerdicts({
  place,
  placePending,
  suitability,
  walkSafety,
  petName,
}: {
  place: PlaceDetail | null
  placePending: boolean
  suitability: Source<PlaceSuitabilityResponse>
  walkSafety: Source<WalkSafetyResponse>
  petName: string | null
}) {
  const lines: { label: string; value: string | null; note: string | null }[] = []

  if (petName !== null && !suitability.failed) {
    lines.push({
      label: petName,
      value: suitability.data?.suitabilityLevel.name ?? null,
      note: suitability.data?.reasons[0]?.description ?? null,
    })
  }

  if (place !== null) {
    for (const line of verdictSummaryLines(place, walkSafety, NO_CONGESTION)) {
      lines.push({ label: line.label, value: line.value, note: null })
    }
  }

  if (lines.length === 0 && !placePending) return null

  // 아이템 채움(L2) — `--band` 다. `--bg-sunken` 은 바닥 전용이다 (DESIGN.md §0)
  return (
    <dl className="bg-band rounded-md px-4 py-1">
      {lines.length === 0 ? (
        <div className="py-3">
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : (
        lines.map((line) => (
          <div key={line.label} className="border-border flex gap-3 border-b py-3 last:border-b-0">
            {/* 라벨 열 72 — 줄마다 같은 폭이라 값의 세로선이 맞는다 */}
            <dt className="text-caption text-fg-muted w-18 shrink-0 truncate pt-1 font-medium">
              {line.label}
            </dt>
            <dd className="text-body-2 text-fg min-w-0 flex-1">
              {line.value === null ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <span className="font-semibold">{line.value}</span>
              )}
              {line.note !== null && (
                <span className="text-caption text-fg-muted mt-1 block break-keep">
                  {line.note}
                </span>
              )}
            </dd>
          </div>
        ))
      )}
    </dl>
  )
}

function PreviewSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
