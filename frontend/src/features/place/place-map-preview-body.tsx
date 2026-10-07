import { type Ref, useId } from 'react'

import { ButtonLink } from '@/components/button'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import { PhotoGallery } from '@/features/place/photo-gallery'
import {
  PlaceDetailActionBar,
  type PlaceDetailActions,
} from '@/features/place/place-detail-action-bar'
import { verdictSummaryLines } from '@/features/place/place-verdict-summary-lines'
import { PlaceVisitKeyLine } from '@/features/place/place-visit-key-line'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { galleryImages, galleryImagesLeadingFirst } from '@/lib/place/gallery'
import { hoursHeadline } from '@/lib/place/hours'
import { placeMetaLine } from '@/lib/place/meta'
import { toPlainText } from '@/lib/place/text'
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
 * 순서: 사진(캐러셀) → 이름 · 적합도 · 메타 → 방문 핵심 줄 → 판정 줄 → 이용 안내 → `상세 정보 전체
 * 보기` → 하단 바(저장 · 담기). **"요약을 다 읽고 더 보고 싶은 순간" 의 자리에 상세로 가는 길이 있다**
 * (#1230 — 예전에는 닫기 바로 옆이라 닫으려다 상세로 갔다).
 *
 * **두 겹으로 그린다.** 목록 행(`summary`)으로 이름 · 대표 사진 · 메타를 즉시 그리고, 상세 · 판정이
 * 오는 대로 나머지를 채운다. 목록에 없는 id 면 상세 응답이 그 자리를 채운다.
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
    **사진은 상세의 이미지 목록이다** (#1230). dev 50곳 중 36곳이 2장 이상(최대 29장)인데 대표 한 장만
    보였다. 상세 응답 전에는 목록 행의 대표 사진 한 장으로 먼저 서고, 응답이 오면 **대표를 첫 장으로
    둔 채** 목록을 잇는다(`galleryImagesLeadingFirst`) — 응답의 목록에는 대표가 없어서, 그냥 바꾸면
    방금 본 사진이 다른 사진으로 바뀌었다(리뷰 실측).
  */
  const images =
    place !== null
      ? galleryImagesLeadingFirst(place.images, place.firstImage, place.cpyrhtDivCd)
      : galleryImages([], summary?.firstImage ?? null, null)

  /*
    목록에도 없고 상세도 못 받았다 — 말할 이름이 없다. 문구 · `상세 정보 전체 보기` · 닫기만 남긴다.
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
      <PreviewTopBar variant={variant} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {failed ? (
          <div className={cn('flex flex-col gap-4 py-6', inset)}>
            <p className="text-body-2 text-fg-muted">{messages.map.previewLoadFailed}</p>
            <DetailLink placeId={placeId} title={title} />
          </div>
        ) : title === null ? (
          <PreviewSkeleton />
        ) : (
          <div className="flex flex-col gap-4 pb-5">
            <PhotoGallery
              images={images}
              title={title}
              contentTypeCode={contentTypeCode}
              layout="carousel"
            />

            <div className={cn('flex min-w-0 flex-col gap-1', inset)}>
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
                {/*
                  등급은 **왔을 때만** 배지다. 묻는 중이면 **배지 모양 골격**이 자리를 잡는다 (#1230) —
                  비어 있다가 갑자기 생기면 "등급이 없는 곳" 으로 읽혔다가 바뀐다.
                */}
                {level !== null ? (
                  <MetricBadge
                    tone={suitabilityTone(level.code)}
                    axis="suitability"
                    className="shrink-0"
                  >
                    {level.name}
                  </MetricBadge>
                ) : (
                  suitability.loading && <Skeleton className="h-6 w-24 shrink-0 rounded-md" />
                )}
              </div>
              {meta !== null && (
                <p className="text-body-2 text-fg-muted line-clamp-1 tabular-nums">{meta}</p>
              )}
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

            {place !== null && <PreviewUseGuide place={place} className={inset} />}

            <div className={inset}>
              <DetailLink placeId={placeId} title={title} />
            </div>
          </div>
        )}
      </div>

      {/*
        하단 바는 **상세의 것을 그대로 쓴다** — 저장 · 담기 · 미로그인 `로그인` · 사라진 장소 잠금이
        한 컴포넌트에 있다. 미리보기만의 바를 만들면 그 규칙이 두 벌이 된다.
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
 * 머리 줄 — (1024~1279) `‹ 목록` · 닫기. **상세로 가는 길은 여기 없다** (#1230).
 *
 * **`‹ 목록` 은 `xl` 에서 사라진다.** 1280 부터는 목록이 옆에 그대로 있어 돌아갈 곳이 없다.
 * 시트(모바일)에도 없다 — 닫으면 목록 시트가 돌아온다. 시트에 그래버를 두지 않는다 — 끌 수 없는데
 * 끌 수 있어 보인다.
 */
function PreviewTopBar({
  variant,
  onClose,
}: {
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

      <button
        type="button"
        onClick={onClose}
        aria-label={messages.map.previewClose}
        className="text-fg-muted hover:text-fg hover:bg-band focus-visible:ring-brand-500 ml-auto inline-flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <CloseIcon size={20} />
      </button>
    </div>
  )
}

/**
 * `상세 정보 전체 보기 ›` — **정보 맨 아래 전폭 보조 버튼** (#1230, 사용자 결정).
 *
 * 닫기 옆이면 닫으려다 상세로 가고, 하단 바 셋째 칸이면 390 에서 담기가 좁아진다. 요약을 다 읽고
 * "더 보고 싶다" 는 순간에 손이 가는 자리가 여기다. 주요 행동(담기)과 겨루지 않게 보조(secondary)다.
 */
function DetailLink({ placeId, title }: { placeId: string; title: string | null }) {
  return (
    <ButtonLink
      href={`/places/${placeId}`}
      variant="secondary"
      size="md"
      trailing={<ChevronRightIcon size={16} aria-hidden />}
      className="w-full"
    >
      {/*
        링크 목록(로터)에서 무엇의 상세인지 들리게 장소명을 앞에 붙인다 — 보이는 문구가 이름에 그대로
        들어가므로 2.5.3(보이는 라벨 포함)도 지킨다. `ButtonLink` 는 글자 버튼에 `aria-label` 을 받지 않는다.
      */}
      {title !== null && <span className="sr-only">{title} </span>}
      {messages.map.previewDetail}
    </ButtonLink>
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
 *
 * **묻는 중에는 라벨을 두고 값 자리에 골격을 둔다** (#1230). 무엇을 기다리는지가 먼저 보여야 한다.
 * 묶음은 **위아래 1px 구분선**이다(L2 구분선, DESIGN.md §0 — 아이템에 테두리를 두르지 않는다). 예전에는
 * `--band` 채움이라 같은 `--band` 인 골격이 묻혀 **빈칸으로 보였다**(사용자 지적). `aria-busy` 로 보조기기에도 묻는 중임을 알린다.
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
  } else if (placePending) {
    /*
      상세가 오기 전에도 **무엇을 기다리는지** 말한다 — 동반 줄은 상세 응답에서 나오고, 산책 줄은
      그 곁에 선다. 라벨만 먼저 두고 값은 골격이다.
    */
    lines.push({ label: messages.place.detailSummaryPetLabel, value: null, note: null })
    if (!walkSafety.failed) {
      lines.push({ label: messages.place.detailSummaryWalkLabel, value: null, note: null })
    }
  }

  if (lines.length === 0) return null

  const busy = lines.some((line) => line.value === null)

  return (
    <dl aria-busy={busy} className="border-border border-y">
      {lines.map((line) => (
        <div key={line.label} className="border-border flex gap-3 border-b py-3 last:border-b-0">
          {/* 라벨 열 72 — 줄마다 같은 폭이라 값의 세로선이 맞는다 */}
          <dt className="text-caption text-fg-muted w-18 shrink-0 truncate pt-1 font-medium">
            {line.label}
          </dt>
          <dd className="text-body-2 text-fg min-w-0 flex-1">
            {line.value === null ? (
              <>
                <Skeleton className="mt-1 h-4 w-28" />
                <span className="sr-only">{messages.map.previewLoading}</span>
              </>
            ) : (
              <span className="font-semibold">{line.value}</span>
            )}
            {line.note !== null && (
              <span className="text-caption text-fg-muted mt-1 block break-keep">{line.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * 이용 안내 — 운영시간(핵심 줄보다 길 때만 전문) · 휴무일 · 주차 · 유모차 대여 · 신용카드 · 주소 (#1230, 사용자 결정).
 *
 * "가려면 무엇을 알아야 하나" 의 나머지다. 방문 핵심 줄은 운영시간 **첫 줄**만 말하므로 전문은
 * 여기서 말한다. 상세 방문 정보 카드와 같은 라벨(`messages.place.detail*`)을 쓴다.
 * 전화는 핵심 줄이 이미 말해 여기 두지 않는다. **값이 없는 줄은 빠지고, 전부 없으면 절이 없다.**
 * 원문은 TourAPI 문자열이라 태그를 걷고(`toPlainText`) 줄바꿈을 살린다.
 */
function PreviewUseGuide({ place, className }: { place: PlaceDetail; className: string }) {
  /*
    `useId` 다 — 패널(데스크톱)과 시트(모바일)가 **동시에 마운트**되므로(CSS 로만 갈린다) 장소 id 로
    만들면 같은 id 가 문서에 두 번 선다(aria-labelledby 충돌, 리뷰 지적).
  */
  const headingId = useId()
  const intro = place.intro
  const address =
    place.addr1 === null
      ? null
      : place.addr2 === null
        ? place.addr1
        : `${place.addr1} ${place.addr2}`
  const candidates: { label: string; value: string | null }[] = [
    { label: messages.place.detailUseTime, value: hoursBeyondHeadline(intro?.useTime ?? null) },
    { label: messages.place.detailRestDate, value: toPlainText(intro?.restDate ?? null) },
    { label: messages.place.detailParking, value: toPlainText(intro?.parking ?? null) },
    {
      label: messages.place.detailBabyCarriage,
      value: toPlainText(intro?.chkBabyCarriage ?? null),
    },
    { label: messages.place.detailCreditCard, value: toPlainText(intro?.chkCreditCard ?? null) },
    { label: messages.place.detailAddress, value: address },
  ]
  const rows = candidates.filter(
    (row): row is { label: string; value: string } => row.value !== null,
  )

  if (rows.length === 0) return null

  return (
    <section aria-labelledby={headingId} className={className}>
      <h3 id={headingId} className="text-body-1 text-fg mb-2 font-semibold">
        {messages.place.detailSectionIntro}
      </h3>
      <dl className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-3">
            <dt className="text-body-2 text-fg-muted w-18 shrink-0">{row.label}</dt>
            <dd className="text-body-2 text-fg min-w-0 flex-1 break-keep whitespace-pre-line">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * 운영시간 원문 — **핵심 줄이 첫 줄로 이미 다 말했으면 `null`** 이다. 원문이 한 줄이면 바로 위
 * 핵심 줄과 같은 문장이 두 번 선다(dev 한라산 실측). 둘째 줄부터 더 있을 때만 전문을 다시 싣는다.
 */
function hoursBeyondHeadline(useTime: string | null): string | null {
  const text = toPlainText(useTime)
  return text === null || text === hoursHeadline(useTime) ? null : text
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
