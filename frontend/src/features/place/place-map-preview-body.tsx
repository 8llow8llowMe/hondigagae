'use client'

import { type ReactNode, type Ref, useId, useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Button, ButtonLink } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import {
  BookmarkIcon,
  CautionIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CrowdIcon,
  DirectionsIcon,
  ParkingIcon,
  PawIcon,
  PhoneIcon,
  PinIcon,
  ShareIcon,
} from '@/components/icons'
import { METRIC_WORD_TONE, MetricBadge } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import { WeatherGlyph } from '@/components/weather-glyph'
import { placeTypeLabel } from '@/features/place/filter-labels'
import { PhotoGallery } from '@/features/place/photo-gallery'
import {
  type PreviewVerdictFact,
  previewVerdictFacts,
} from '@/features/place/preview-verdict-facts'
import { formatDistance } from '@/lib/format/distance'
import { directionsUrl } from '@/lib/geo/map-link'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { galleryImages, galleryImagesLeadingFirst } from '@/lib/place/gallery'
import { hoursHeadline } from '@/lib/place/hours'
import { indoorLabel } from '@/lib/place/indoor'
import { toPlainText } from '@/lib/place/text'
import { withCompanionParticle } from '@/lib/text/korean'
import { cn } from '@/lib/utils/cn'
import type { PlaceSuitabilityResponse, WalkSafetyResponse } from '@/types/insight'
import type { PlaceDetail, PlaceSummary } from '@/types/place'

export type PlaceMapPreviewVariant = 'panel' | 'sheet'

type Source<T> = { data: T | null; loading: boolean; failed: boolean }

/**
 * 미리보기의 행동 (#1233). 상세 하단 바(`PlaceDetailActions`)와 갈라졌다 — 저장은 행동 줄로 올라가고
 * 하단 바는 담기 하나다. 로그인 안내는 컨테이너가 각 행동 안에서 연다(`onToggleSave` · `onAddToPlan`).
 */
export type PlaceMapPreviewActions = {
  authed: boolean
  saved: boolean
  savePending: boolean
  /** 저장 실패 문구. 행동 줄 바로 아래 남긴다 — 토스트로 흘리면 놓친다 */
  saveError: string | null
  /** 미로그인이면 컨테이너가 로그인 안내 시트를 연다 */
  onToggleSave: () => void
  /** 이 화면에서 한 번이라도 담았다 */
  added: boolean
  /** 미로그인이면 컨테이너가 로그인 안내 시트를 연다 */
  onAddToPlan: () => void
  /** 원천에서 사라진 장소 (#146) — 담기 · 새 저장을 잠근다. 저장 해제는 열어 둔다 */
  delisted: boolean
  /** 상세 정규 주소를 공유한다 (`lib/place/share.ts`) */
  onShare: () => void
  /** 공유 시트도 클립보드도 막혔을 때 직접 복사하라고 띄울 주소. 아니면 null */
  shareFailedUrl: string | null
  /** 주소를 클립보드에 복사한다 — 성공은 컨테이너가 토스트로 알린다. 실패는 주소가 화면에 그대로 있다 */
  onCopyAddress: (address: string) => void
}

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
  /** 선택된 반려견 이름. 없으면 판정 카드 머리가 `오늘 이 장소` 이고 등록 안내 줄이 선다 */
  petName: string | null
  actions: PlaceMapPreviewActions
  /** 열릴 때 포커스를 받는 이름 — 컨테이너가 쥔다 (`place-map-preview.tsx`) */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

/**
 * 미리보기의 표시 부분 — **props 만 받는다** (#1227). node 환경에서 렌더 갈래를 테스트하려고
 * 조회 · 상태를 쥔 컨테이너(`PlaceMapPreview`)와 나눴다 (testing-guide.md §1).
 *
 * **위계로 설계한다 — 나열하지 않는다** (#1233, `지도미리보기-재설계-세부명세.md`). 지난 판은 상세
 * 화면의 함수를 재사용하는 데 맞춰 라벨-값 표가 세 번 반복됐다. 이번 판의 원칙: 한 화면에 **결론
 * 하나 · 행동 하나 줄 · 참고는 접어서**, 같은 사실은 한 번만, 라벨 칸(`dt`)으로 위계를 대신하지 않는다.
 *
 * ```text
 * 사진(캐러셀)
 * ① 이름  분류            ← 이름 옆 적합도 배지 없음 — 적합도는 ⑤ 하나가 말한다
 * ② ● 영업 중 · 짧은 주소 · 거리
 * ③ (🐾 동반 · 크기) (실내/야외)
 * ④ [길찾기][전화][저장][공유]
 * ⑤ 오늘 {반려견}과 — 결론 한 문장 / 근거 사실(좋은 쪽 → 주의 쪽)
 * ⑥ 이용 정보 — 아이콘 행(운영 · 주차 · 주소+복사), 더보기
 * ⑦ 상세 정보 전체 보기
 * ⑧ 하단 바 — 일정에 담기
 * ```
 *
 * **두 겹으로 그린다.** 목록 행(`summary`)으로 이름 · 대표 사진 · 주소를 즉시 그리고, 상세 · 판정이
 * 오는 대로 나머지를 채운다. **줄마다 따로 실패한다** — 판정 하나가 죽어도 그 줄만 빠진다.
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
  const inset = variant === 'sheet' ? 'px-4' : 'px-5'
  /*
    **사진은 상세의 이미지 목록이다** (#1230). 상세 응답 전에는 목록 행의 대표 사진 한 장으로 먼저
    서고, 응답이 오면 **대표를 첫 장으로 둔 채** 목록을 잇는다(`galleryImagesLeadingFirst`).
  */
  const images =
    place !== null
      ? galleryImagesLeadingFirst(place.images, place.firstImage, place.cpyrhtDivCd)
      : galleryImages([], summary?.firstImage ?? null, null)

  /*
    목록에도 없고 상세도 못 받았다 — 말할 이름이 없다. 문구 · `상세 정보 전체 보기` · 닫기만 남긴다.
    404 와 5xx 를 가르지 않고 재시도를 달지 않는다: 여기는 상세로 가는 입구다.
  */
  const failed = title === null && detail.failed

  return (
    <section
      aria-label={messages.map.previewLabel}
      /*
        면(배경 · 테두리 · 곡률 · 그림자)은 **담는 쪽이 갖는다** (`place-map-view.tsx`).
        **`min-h-0` 이 없으면 하단 바가 잘린다** — 모바일 시트는 높이가 아니라 상한만 있다.
      */
      className="flex h-full max-h-full min-h-0 flex-col"
    >
      <PreviewTopBar variant={variant} onClose={onClose} />

      {/*
        **`relative` 가 있어야 한다** (#1264). 안의 `sr-only`(absolute) 문구는 가장 가까운 위치 기준 조상에
        놓이는데, 이 영역이 `static` 이면 그 조상이 스크롤 영역 바깥이라 클리핑을 벗어난다 — 스크롤 아래쪽
        문구가 문서 높이를 키워 페이지 전체가 아래로 늘어났다(1520x900 에서 문서 1093).
      */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {failed ? (
          <div className={cn('flex flex-col gap-4 py-6', inset)}>
            <p className="text-body-2 text-fg-muted">{messages.map.previewLoadFailed}</p>
            <DetailLink placeId={placeId} title={title} />
          </div>
        ) : title === null ? (
          <PreviewSkeleton />
        ) : (
          // 절 사이 24 · 절 안 12 (명세 D4)
          <div className="flex flex-col gap-6 pb-6">
            <PhotoGallery
              images={images}
              title={title}
              contentTypeCode={contentTypeCode}
              layout="carousel"
            />

            <PreviewIdentity
              title={title}
              summary={summary}
              place={place}
              headingRef={headingRef}
              className={inset}
            />

            <div className={inset}>
              <PreviewActionRow
                title={title}
                lat={place?.lat ?? summary?.lat ?? null}
                lng={place?.lng ?? summary?.lng ?? null}
                tel={place?.tel ?? summary?.tel ?? null}
                actions={actions}
              />
            </div>

            <PreviewVerdictCard
              suitability={suitability}
              walkSafety={walkSafety}
              petName={petName}
              className={inset}
            />

            {place !== null && (
              <PreviewUseInfo
                place={place}
                onCopyAddress={actions.onCopyAddress}
                className={inset}
              />
            )}

            <div className={inset}>
              <DetailLink placeId={placeId} title={title} />
            </div>
          </div>
        )}
      </div>

      {!failed && title !== null && <PreviewBottomBar actions={actions} variant={variant} />}
    </section>
  )
}

/**
 * 머리 줄 — (1024~1279) `‹ 목록` · 닫기. **상세로 가는 길은 여기 없다** (#1230).
 * `‹ 목록` 은 `xl` 에서 사라진다 — 1280 부터는 목록이 옆에 그대로 있다. 시트(모바일)에도 없다.
 */
function PreviewTopBar({
  variant,
  onClose,
}: {
  variant: PlaceMapPreviewVariant
  onClose: () => void
}) {
  return (
    // 아래 `pb-2` — 닫기(44)의 호버 배경이 바로 밑 사진에 붙지 않게 띄운다 (#1264)
    <div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-2">
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
 * ① 이름 + 분류 · ② 상태 줄 · ③ 속성 칩 (#1233 D2).
 *
 * **이름 옆 적합도 배지를 걷었다** — 배지와 판정 줄이 같은 말(`여행 적합`)을 두 번 했다. 적합도는
 * ⑤ 카드 하나가 말한다. 분류는 목록 행과 같은 판정(`placeTypeLabel` — 카페 분류 음식점은 `카페`)이다.
 */
function PreviewIdentity({
  title,
  summary,
  place,
  headingRef,
  className,
}: {
  title: string
  summary: PlaceSummary | null
  place: PlaceDetail | null
  headingRef?: Ref<HTMLHeadingElement> | undefined
  className: string
}) {
  const source = place ?? summary
  const kind = source === null ? null : placeTypeLabel(source)

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {/*
          이름 바로 옆(같은 줄 기준선)에 작은 회색 분류 — 네이버 플레이스의 위계. 분류는 `h2` 밖이다:
          이름이 포커스를 받을 때(`tabIndex={-1}`) 장소명만 읽혀야 한다.
          공백 없는 긴 이름이 넘치지 않게 `min-w-0 break-words`.
        */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-title-2 text-fg min-w-0 font-bold break-words focus:outline-none"
          >
            {title}
          </h2>
          {kind !== null && <span className="text-body-2 text-fg-muted shrink-0">{kind}</span>}
        </div>
        <PreviewStatusLine summary={summary} place={place} />
      </div>
      <PreviewChips summary={summary} place={place} />
    </div>
  )
}

/**
 * ② 상태 줄 — `[운영 상태] · [짧은 주소] · [거리]` 한 줄, 넘치면 말줄임.
 *
 * 운영 상태는 **원문이 있을 때만** 선다(세부명세 D5-5 — 근거 없이 판정만 서면 아래 이용 정보와 다른
 * 말을 한다): `24시간` · `● 영업 중`(초록 · 굵게) · `영업 시간 아님` · 판정이 없으면 원문 첫 줄.
 *
 * **색은 `--status-open-*` 이다** — 명세 초안은 `--metric-high-700` 이었으나, 등급 색이면 `영업 중` 이
 * `여행 적합` 과 한 뜻이 된다(DESIGN.md §2-9 가 그래서 토큰을 갈랐다). 색만으로 가르지 않게 점과
 * 굵기를 함께 준다. 방문 핵심 줄(`PlaceVisitKeyLine`)은 미리보기에서 쓰지 않는다 — 운영은 이 줄이,
 * 전화 · 길찾기는 ④ 가 맡는다.
 */
function PreviewStatusLine({
  summary,
  place,
}: {
  summary: PlaceSummary | null
  place: PlaceDetail | null
}) {
  const intro = place?.intro ?? null
  const hours = hoursHeadline(intro?.useTime ?? null)
  const open = hours !== null && (intro?.open24 === true || intro?.openNow === true)
  const status =
    hours === null
      ? null
      : intro?.open24 === true
        ? messages.place.detailOpen24
        : intro?.openNow === true
          ? messages.place.detailOpenNow
          : intro?.openNow === false
            ? messages.place.detailOpenClosed
            : hours
  const address = shortAddress(summary?.addr1 ?? place?.addr1 ?? null)
  const meters = summary?.distanceMeters ?? null
  const distance = meters === null ? null : formatDistance(meters)
  const rest = [address, distance].filter((part): part is string => part !== null && part !== '')

  if (status === null && rest.length === 0) return null

  return (
    <p className="text-body-2 text-fg-muted line-clamp-1 tabular-nums">
      {status !== null && (
        <span className={cn(open && 'text-status-open-700 font-semibold')}>
          {open && <span aria-hidden>● </span>}
          {status}
        </span>
      )}
      {status !== null && rest.length > 0 && ' · '}
      {rest.join(' · ')}
    </p>
  )
}

/**
 * ③ 속성 칩 — **사실만**. 판정(적합 · 안전)은 칩으로 만들지 않는다 — 판정 축은 ⑤ 다.
 * 모르는 값은 점선(`MetricBadge unknown`)으로 "모름" 을 드러낸다 (styling-guide.md §3).
 */
function PreviewChips({
  summary,
  place,
}: {
  summary: PlaceSummary | null
  place: PlaceDetail | null
}) {
  const allowance = place?.petAllowanceType ?? summary?.petAllowanceType ?? null
  const size = place?.petInfo?.allowedPetSize.name ?? summary?.allowedPetSize?.name ?? null
  const indoor = place !== null ? place.indoor : (summary?.indoor ?? null)
  const indoorWord = indoorLabel(indoor)

  if (allowance === null) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowance.code === 'UNKNOWN' ? (
        <MetricBadge tone="unknown" size="sm">
          {messages.place.petAllowanceUnknown}
        </MetricBadge>
      ) : (
        <Badge tone="neutral" size="sm" className="gap-1">
          <PawIcon size={14} />
          {size === null ? allowance.name : `${allowance.name} · ${size}`}
        </Badge>
      )}
      {indoorWord === null ? (
        <MetricBadge tone="unknown" size="sm">
          {messages.place.rowIndoorUnknown}
        </MetricBadge>
      ) : (
        <Badge tone="neutral" size="sm">
          {indoorWord}
        </Badge>
      )}
    </div>
  )
}

/**
 * ④ 행동 줄 — **아이콘 + 짧은 글자 4칸, 같은 폭** (#1233 D2, 카카오맵 · 네이버의 장소 카드).
 *
 * **칸 수는 바뀌지 않는다.** 좌표가 없으면 길찾기, 번호가 없으면 전화가 **흐린 칸으로 선다** — 칸이
 * 빠지면 같은 자리를 누르던 손이 다른 행동을 누른다. 비활성 이유는 스크린리더에만 말한다(보이는 것은
 * 흐린 칸뿐). `disabled` 가 아니라 `aria-disabled` — 포커스가 닿아야 이유를 들을 수 있다.
 *
 * 전화번호는 버튼에 쓰지 않는다 — 이름(`전화 064-…`)에만 있다. 저장은 `aria-pressed` 로 상태를 말한다.
 */
function PreviewActionRow({
  title,
  lat,
  lng,
  tel,
  actions,
}: {
  title: string
  lat: number | null
  lng: number | null
  tel: string | null
  actions: PlaceMapPreviewActions
}) {
  const directions = directionsUrl({ name: title, lat, lng })
  // 해제는 살려 둔다 — 잠기는 것은 **새로 저장하는 방향**뿐이다 (#146)
  const saveBlocked = actions.delisted && !actions.saved
  const saved = actions.authed && actions.saved

  return (
    <div className="flex flex-col gap-3">
      {/*
        `nav` 가 아니라 `group` 이다 — `nav` 는 탐색 링크 랜드마크인데 여기는 저장 · 공유 같은 버튼이
        섞인 행동 묶음이다(리뷰 지적, 명세 D5 를 고쳤다).
      */}
      <div role="group" aria-label={messages.map.previewActionsLabel}>
        <ul className="grid grid-cols-4 gap-2">
          <li>
            {directions === null ? (
              <ActionCell
                icon={<DirectionsIcon size={20} />}
                label={messages.map.directions}
                unavailable={messages.map.previewDirectionsUnavailable}
              />
            ) : (
              <a href={directions} target="_blank" rel="noopener noreferrer" className={CELL}>
                <DirectionsIcon size={20} />
                {messages.map.directions}
                <span className="sr-only"> {messages.map.directionsHint}</span>
              </a>
            )}
          </li>
          <li>
            {tel === null ? (
              <ActionCell
                icon={<PhoneIcon size={20} />}
                label={messages.map.previewCall}
                unavailable={messages.map.previewCallUnavailable}
              />
            ) : (
              <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} className={CELL}>
                <PhoneIcon size={20} />
                {messages.map.previewCall}
                <span className="sr-only"> {tel}</span>
              </a>
            )}
          </li>
          <li>
            {saveBlocked ? (
              <ActionCell
                icon={<BookmarkIcon size={20} />}
                label={messages.map.previewSave}
                unavailable={messages.map.previewSaveBlocked}
              />
            ) : (
              <button
                type="button"
                onClick={actions.onToggleSave}
                disabled={actions.savePending}
                // 미로그인은 저장 여부를 모른다 — 눌린 상태를 말하지 않고 누르면 로그인 안내가 뜬다
                aria-pressed={actions.authed ? actions.saved : undefined}
                className={cn(CELL, 'disabled:opacity-60')}
              >
                <BookmarkIcon size={20} fill={saved ? 'currentColor' : 'none'} />
                {saved ? messages.map.previewSaved : messages.map.previewSave}
              </button>
            )}
          </li>
          <li>
            <button type="button" onClick={actions.onShare} className={CELL}>
              <ShareIcon size={20} />
              {messages.map.previewShare}
            </button>
          </li>
        </ul>
      </div>

      <FormAlert message={actions.saveError} />
      {/*
        **공유 실패는 여기 남긴다 — 토스트가 아니다** (\`toast.tsx\` "오류를 토스트로 말하지 않는다").
        공유할 주소는 화면 어디에도 없어서, 토스트가 사라지면 다음 행동이 없다. 주소를 고를 수 있게
        띄워 직접 복사하게 한다 — 일정 공유 모달(#1183)과 같은 처방이다.
      */}
      {actions.shareFailedUrl !== null && (
        <div className="flex flex-col gap-1">
          <FormAlert message={messages.map.previewShareFailed} />
          <p className="text-caption text-fg-muted break-all select-all">
            {actions.shareFailedUrl}
          </p>
        </div>
      )}
    </div>
  )
}

/** 행동 칸 — 높이 56(누르는 자리 44 하한 위), 아이콘 20 위 · 글자 아래, 면 `--band` */
const CELL =
  'bg-band text-fg text-caption focus-visible:ring-brand-500 flex h-14 w-full flex-col items-center justify-center gap-1 rounded-md font-medium focus-visible:ring-2 focus-visible:outline-none'

/** 쓸 수 없는 칸 — 자리는 지키고 흐리게 선다. 이유는 스크린리더에만 */
function ActionCell({
  icon,
  label,
  unavailable,
}: {
  icon: ReactNode
  label: string
  unavailable: string
}) {
  return (
    <button
      type="button"
      aria-disabled="true"
      className={cn(CELL, 'text-fg-subtle cursor-not-allowed')}
    >
      {icon}
      {label}
      <span className="sr-only"> {unavailable}</span>
    </button>
  )
}

/**
 * ⑤ 오늘 판정 카드 — **이 서비스의 차별점** (#1233 D2 ⑤).
 *
 * - **결론 — 서술형 한 문장**(사용자 결정): 서버 `headline`(BE #1234)을 `title-2` 굵게(명세의 `title-3` 은
 *   스케일에 없다 — 새 크기를 만들지 않는다, 명세 D4). 아직 안 오면 등급
 *   `name`(`여행 적합`)이 그 자리에 서고 배지는 생략한다 — 같은 말 두 번을 피한다. FE 가 등급 code 별
 *   문장을 만들지 않는다(enum 규칙).
 * - **근거 사실 — 좋은 쪽 먼저, 주의 쪽 아래** (`previewVerdictFacts`). 주의는 아이콘 + 색 + sr `주의`.
 * - 면은 `--band` 채움(L2 아이템 채움, DESIGN.md §0) — 그 위 골격은 `surface="band"` 로 대비를 되찾는다.
 */
function PreviewVerdictCard({
  suitability,
  walkSafety,
  petName,
  className,
}: {
  suitability: Source<PlaceSuitabilityResponse>
  walkSafety: Source<WalkSafetyResponse>
  petName: string | null
  className: string
}) {
  const headingId = useId()
  const data = suitability.data
  const facts = previewVerdictFacts(data, walkSafety.data)
  const loading = suitability.loading || walkSafety.loading

  // 둘 다 실패(또는 둘 다 말할 것이 없음) — 카드를 세우지 않는다. 재시도는 상세의 몫이다
  if (!loading && data === null && facts.length === 0) return null

  const headline = data?.headline ?? null
  const level = data?.suitabilityLevel ?? null

  return (
    <div className={className}>
      <section
        aria-labelledby={headingId}
        aria-busy={loading}
        className="bg-band flex flex-col gap-3 rounded-lg p-4"
      >
        <h3 id={headingId} className="text-caption text-fg-muted font-semibold">
          {petName === null
            ? messages.map.previewVerdictHeadNoPet
            : messages.map.previewVerdictHead.replace('{pet}', withCompanionParticle(petName))}
        </h3>

        {suitability.loading ? (
          <>
            <Skeleton surface="band" className="h-6 w-40" />
            <span className="sr-only">{messages.map.previewLoading}</span>
          </>
        ) : (
          level !== null && (
            <div className="flex flex-col items-start gap-1">
              <p className="text-title-2 text-fg font-bold break-keep">{headline ?? level.name}</p>
              {headline !== null && (
                <MetricBadge tone={suitabilityTone(level.code)} size="sm">
                  {level.name}
                </MetricBadge>
              )}
            </div>
          )
        )}

        {petName === null && (
          <Link
            href="/pets/new"
            className="text-link hover:text-link-hover focus-visible:ring-brand-500 text-body-2 inline-flex min-h-11 items-center gap-1 self-start rounded-sm font-semibold break-keep focus-visible:ring-2 focus-visible:outline-none"
          >
            {messages.map.previewPetPrompt}
            <ChevronRightIcon size={16} aria-hidden />
          </Link>
        )}

        {(facts.length > 0 || loading) && (
          <ul className="flex flex-col gap-2">
            {facts.map((fact) => (
              <VerdictFactRow key={fact.key} fact={fact} />
            ))}
            {loading && facts.length === 0 && (
              <>
                <li>
                  <Skeleton surface="band" className="h-4 w-3/4" />
                </li>
                <li>
                  <Skeleton surface="band" className="h-4 w-2/3" />
                </li>
                <li>
                  <Skeleton surface="band" className="h-4 w-1/2" />
                </li>
              </>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}

/** 근거 사실 한 줄 — 아이콘 20 + 짧은 사실. 주의 쪽은 주의 아이콘 · 등급 글자색 · sr `주의` */
function VerdictFactRow({ fact }: { fact: PreviewVerdictFact }) {
  const caution = fact.tone !== null
  const icon = caution ? (
    <CautionIcon size={20} />
  ) : fact.glyph !== null && fact.glyph.kind !== null ? (
    <WeatherGlyph glyph={fact.glyph} size={20} />
  ) : fact.key === 'walk' ? (
    <PawIcon size={20} className="text-fg-muted" />
  ) : fact.key === 'congestion' ? (
    <CrowdIcon size={20} className="text-fg-muted" />
  ) : null

  return (
    <li
      className={cn(
        'text-body-2 flex items-start gap-2 break-keep',
        caution ? METRIC_WORD_TONE[fact.tone ?? 'mid'] : 'text-fg',
      )}
    >
      <span className="inline-flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0">
        {caution && <span className="sr-only">{messages.map.previewFactCaution} </span>}
        {/*
          그림이 없는 하늘 코드(서버가 새로 낸 값)는 20 칸에 낱말을 넣으면 넘친다 — 문장 앞에 붙인다.
          주의 쪽은 그림이 주의 아이콘으로 바뀌므로 하늘 낱말은 sr 로 남긴다.
        */}
        {fact.glyph !== null && fact.glyph.kind === null && `${fact.glyph.name} · `}
        {caution && fact.glyph?.kind != null && <span className="sr-only">{fact.glyph.name} </span>}
        {fact.text}
      </span>
    </li>
  )
}

/**
 * ⑥ 이용 정보 — **라벨 칸 없이 아이콘 + 값** (#1233 D2, 네이버 정보 탭).
 *
 * - 🕐 운영: 원문 첫 줄 + 휴무 — 원문이 여러 줄이면 행을 눌러 펼친다.
 * - 🅿 주차 · 📍 주소(+ 복사).
 * - 접힘 `더보기`: 유모차 대여 · 신용카드 · 문의처(전화와 다를 때). 이 셋은 값이 `가능` · `없음` 처럼
 *   낱말 하나라 라벨 없이는 뜻이 없다 — 접힌 안에서만 라벨을 붙인다.
 *
 * **값이 없는 행은 빠지고, 전부 없으면 절이 없다.** 원문은 TourAPI 문자열이라 태그를 걷는다(`toPlainText`).
 */
function PreviewUseInfo({
  place,
  onCopyAddress,
  className,
}: {
  place: PlaceDetail
  onCopyAddress: (address: string) => void
  className: string
}) {
  /*
    `useId` 다 — 패널(데스크톱)과 시트(모바일)가 **동시에 마운트**되므로(CSS 로만 갈린다) 장소 id 로
    만들면 같은 id 가 문서에 두 번 선다.
  */
  const headingId = useId()
  const hoursId = useId()
  const moreId = useId()
  const [hoursOpen, setHoursOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const intro = place.intro
  const hoursFull = toPlainText(intro?.useTime ?? null)
  const hoursFirst = hoursHeadline(intro?.useTime ?? null)
  const hoursMore = hoursFull !== null && hoursFull !== hoursFirst
  const rest = toPlainText(intro?.restDate ?? null)
  const parking = toPlainText(intro?.parking ?? null)
  const address =
    place.addr1 === null
      ? null
      : place.addr2 === null
        ? place.addr1
        : `${place.addr1} ${place.addr2}`
  const infoCenter = toPlainText(intro?.infoCenter ?? null)
  const more: { label: string; value: string | null }[] = [
    {
      label: messages.place.detailBabyCarriage,
      value: toPlainText(intro?.chkBabyCarriage ?? null),
    },
    { label: messages.place.detailCreditCard, value: toPlainText(intro?.chkCreditCard ?? null) },
    {
      label: messages.place.detailInfoCenter,
      // 전화와 같은 번호면 ④ 가 이미 말했다
      value: infoCenter !== null && infoCenter !== place.tel ? infoCenter : null,
    },
  ]
  const moreRows = more.filter((row): row is { label: string; value: string } => row.value !== null)

  const hasHours = hoursFirst !== null || rest !== null
  if (!hasHours && parking === null && address === null && moreRows.length === 0) return null

  const restLine = rest === null ? null : messages.map.previewRestDate.replace('{value}', rest)

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-1', className)}>
      <h3 id={headingId} className="text-body-1 text-fg mb-1 font-semibold">
        {messages.map.previewUseInfo}
      </h3>

      <ul className="flex flex-col">
        {hasHours && (
          <InfoRow icon={<ClockIcon size={20} />}>
            {hoursMore ? (
              <button
                type="button"
                onClick={() => setHoursOpen((open) => !open)}
                aria-expanded={hoursOpen}
                aria-controls={hoursId}
                className="focus-visible:ring-brand-500 flex w-full items-start gap-1 rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  {hoursFirst}
                  {restLine !== null && <span className="text-fg-muted"> · {restLine}</span>}
                </span>
                {/* 글줄 높이(20)에 맞춘 칸 — 첫 줄 가운데에 선다 */}
                <span className="text-fg-muted flex h-5 shrink-0 items-center">
                  <ChevronDownIcon size={16} className={cn(hoursOpen && 'rotate-180')} />
                </span>
              </button>
            ) : (
              <span>
                {hoursFirst ?? restLine}
                {hoursFirst !== null && restLine !== null && (
                  <span className="text-fg-muted"> · {restLine}</span>
                )}
              </span>
            )}
            {hoursMore && (
              <span
                id={hoursId}
                hidden={!hoursOpen}
                className="text-fg-muted mt-1 block whitespace-pre-line"
              >
                {hoursFull}
              </span>
            )}
          </InfoRow>
        )}

        {parking !== null && (
          <InfoRow icon={<ParkingIcon size={20} />}>
            {/*
              원문이 `가능` · `불가` 처럼 낱말 하나인 곳이 많다(dev 실측 수월봉) — 아이콘만으로는 무엇이
              가능한지 읽히지 않아 `주차` 를 앞에 붙인다. 원문이 이미 `주차…` 로 시작하면 두 번 쓰지 않는다.
            */}
            <span className="whitespace-pre-line">
              {parking.startsWith(messages.place.detailParking)
                ? parking
                : `${messages.place.detailParking} ${parking}`}
            </span>
          </InfoRow>
        )}

        {address !== null && (
          <InfoRow icon={<PinIcon size={20} />}>
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1">{address}</span>
              <button
                type="button"
                onClick={() => onCopyAddress(address)}
                aria-label={messages.map.previewAddressCopyLabel}
                className="text-link hover:text-link-hover focus-visible:ring-brand-500 text-caption -my-3 inline-flex min-h-11 shrink-0 items-center rounded-sm px-1 font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                {messages.map.previewAddressCopy}
              </button>
            </span>
          </InfoRow>
        )}
      </ul>

      {moreRows.length > 0 && (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls={moreId}
            className="text-body-2 text-fg-muted hover:text-fg focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-1 self-start rounded-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {moreOpen ? messages.map.previewLess : messages.map.previewMore}
            <ChevronDownIcon size={16} className={cn(moreOpen && 'rotate-180')} />
          </button>
          <ul id={moreId} hidden={!moreOpen} className="flex flex-col gap-2 pb-2">
            {moreRows.map((row) => (
              <li key={row.label} className="text-body-2 text-fg break-keep">
                <span className="text-fg-muted">{row.label}</span> {row.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** 이용 정보 한 행 — 아이콘 20 + 값, 최소 44 (복사 · 펼치기가 행 안 버튼이다) */
function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="text-body-2 text-fg flex min-h-11 items-start gap-3 py-3 break-keep">
      <span className="text-fg-muted shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}

/**
 * `상세 정보 전체 보기 ›` — **정보 맨 아래 전폭 보조 버튼** (#1230, 사용자 결정).
 * 요약을 다 읽고 "더 보고 싶다" 는 순간에 손이 가는 자리다. 주요 행동(담기)과 겨루지 않게 보조다.
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
      {/* 로터에서 무엇의 상세인지 들리게 장소명을 앞에 붙인다 — 보이는 문구도 이름에 그대로 든다 */}
      {title !== null && <span className="sr-only">{title} </span>}
      {messages.map.previewDetail}
    </ButtonLink>
  )
}

/**
 * ⑧ 하단 바 — **`일정에 담기` 전폭 하나** (#1233). 상세 하단 바(`PlaceDetailActionBar`)를 쓰지 않는다 —
 * 저장은 ④ 로 올라갔다. **사라진 장소 잠금(#146)은 그대로 들인다**: 담기 비활성 + 이유 문구를 버튼 위에.
 * 담은 뒤에는 라벨이 바뀐다(`다른 일정에도 담기`) — 같은 자리에서 두 번 눌러 중복으로 담지 않게.
 */
function PreviewBottomBar({
  actions,
  variant,
}: {
  actions: PlaceMapPreviewActions
  variant: PlaceMapPreviewVariant
}) {
  const inset = variant === 'sheet' ? 'px-4' : 'px-5'

  return (
    <div className="border-border shrink-0 border-t">
      {actions.delisted && (
        <p className={cn('text-body-2 text-fg-muted pt-3', inset)}>
          {messages.place.detailDelistedActionsBlocked}
        </p>
      )}
      <div className={cn('py-3', inset)}>
        {/* 높이 48 이 `Button size="lg"` 그대로라 외형을 손으로 복제하지 않는다 (component-guide #70) */}
        <Button
          variant={actions.added ? 'secondary' : 'primary'}
          size="lg"
          onClick={actions.onAddToPlan}
          disabled={actions.delisted}
          className="w-full"
        >
          {actions.added ? messages.plan.addToPlanAgainAction : messages.plan.addToPlanAction}
        </Button>
      </div>
    </div>
  )
}

/** 목록에도 없고 상세를 기다리는 동안 — 사진 · 이름 · 행동 줄 · 판정 카드 자리 */
function PreviewSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-14 w-full rounded-md" />
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  )
}
