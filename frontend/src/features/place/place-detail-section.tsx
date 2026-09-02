import type { ReactNode } from 'react'

import { Badge } from '@/components/badge'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ChevronRightIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { Band } from '@/components/surface'
import { PhotoGallery } from '@/features/place/photo-gallery'
import { PlaceBackLink } from '@/features/place/place-back-link'
import {
  PlaceDetailActionBar,
  type PlaceDetailActions,
} from '@/features/place/place-detail-action-bar'
import { PlaceDetailSkeleton } from '@/features/place/place-detail-skeleton'
import { PlaceOverview } from '@/features/place/place-overview'
import { PlacePetInfoSection } from '@/features/place/place-pet-info'
import {
  PlaceSuitabilityPanel,
  type PlaceSuitabilityPanelProps,
} from '@/features/place/place-suitability-panel'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { copyrightLabel } from '@/lib/place/copyright'
import { parseHomepage } from '@/lib/place/homepage'
import { indoorLabel } from '@/lib/place/indoor'
import { toPlainText } from '@/lib/place/text'
import { cn } from '@/lib/utils/cn'
import type { PlaceDetail, PlaceIntro } from '@/types/place'

export type PlaceDetailSectionProps = {
  place: PlaceDetail | null
  loading: boolean
  /** 실패한 요청의 HTTP 상태. 성공이면 null */
  errorStatus: number | null
  /** 서버가 준 resultMessage (문자열이 아닐 수 있다) */
  errorMessage?: unknown
  onRetry: () => void
  /** 적합도 패널이 쓰는 것 전부. **장소 조회와 판정 조회는 따로 실패한다** */
  suitability: PlaceSuitabilityPanelProps
  /** 선택된 반려견 — 동반 정보에 대입한다 */
  petName: string | null
  petSizeCode: string | null
  petSizeName: string | null
  /** 하단 바(담기 + 저장)가 쓰는 것 전부 — #118 */
  actions: PlaceDetailActions
}

/**
 * 장소 상세 — 아트보드 `혼디가개 장소 상세` 01(모바일 390) · 03(데스크톱 1440) · 04(상태).
 *
 * **데스크톱은 2단이다.** 좌 `--rail-context`(400) sticky = 판정 + 기본 정보,
 * 우 1fr = 갤러리 + 제목 + 본문. 열 구분선은 **우측 열의 `border-left`** 다.
 *
 * DOM 순서는 **모바일 기준**이다 (갤러리 → 제목 → 판정 → 기본 정보 → 본문). 데스크톱 배치는
 * `.rail-layout-detail` 의 grid 배치가 바꾼다 — 트리를 폭마다 둘로 나누면 같은 내용이 두 번
 * 렌더돼 스크린리더가 중복해 읽는다. 자세한 이유는 `app/globals.css` 에 적어 뒀다.
 *
 * 4개 상태를 **배타적으로** 렌더한다. props 로만 데이터를 받는 presentational 컴포넌트다
 * — node 환경에서 테스트하기 위해서다 (docs/testing-guide.md §1).
 *
 * **404 의 정상 경로는 여기가 아니다.** 서버 컴포넌트가 `notFound()` 로 보낸다.
 * 여기서 404 를 다루는 것은 클라이언트 재조회에서 리소스가 사라진 경우다.
 *
 * 아트보드에 있으나 **구현하지 않은 것**: "지도 보기"·"길찾기"
 * ([#14](https://github.com/8llow8llowMe/hondigagae/issues/14)) · 메타의 거리(상세는 기준점이
 * 없다) · 입장료. **없는 값을 지어내지 않는다.**
 *
 * 하단 바(담기 + 저장)는 #118 로 붙었다 — 막고 있던 사유가 둘 다 소멸했다 (일정 화면은
 * #80·#82, 즐겨찾기 API 는 `/api/v1/favorites/places`).
 *
 * **하단 바만 폭마다 두 곳에 그린다** — 모바일은 sticky 바닥(01), 데스크톱은 좌측 레일의
 * 판정 아래(03) 라 위치가 아예 다르다. `hidden`(`display:none`) 으로 갈라 **어느 폭에서든
 * a11y 트리에 하나만 남는다** — 본문 트리를 둘로 나누지 않는 이유(중복 낭독)가 여기에는
 * 걸리지 않는다.
 *
 * `실내` 와 정보 출처명은 #16 으로 상세 응답에 들어와 붙였다 (#112).
 */
export function PlaceDetailSection({
  place,
  loading,
  errorStatus,
  errorMessage,
  onRetry,
  suitability,
  petName,
  petSizeCode,
  petSizeName,
  actions,
}: PlaceDetailSectionProps) {
  if (loading) return <PlaceDetailSkeleton />

  if (errorStatus !== null) {
    const kind = classify(errorStatus)

    // 데이터 부재다. 재시도 버튼을 붙이지 않고 서버 문구를 그대로 노출한다
    if (kind === 'not-found') {
      return (
        <EmptyState
          title={toMessage(errorMessage, messages.place.detailNotFoundTitle)}
          description={messages.place.detailNotFoundDescription}
          action={<PlaceBackLink />}
        />
      )
    }

    // 컨트롤러가 @PathVariable long 이라 숫자가 아닌 placeId 는 404 가 아니라 400 이다.
    // 주소 자체가 잘못된 것이므로 재시도해도 같은 400 이다 — 재시도를 주지 않는다
    if (kind === 'validation') {
      return (
        <EmptyState
          title={messages.common.validationErrorTitle}
          description={toMessage(errorMessage, messages.place.detailNotFoundDescription)}
          action={<PlaceBackLink />}
        />
      )
    }

    // 5xx · 무응답 — 재시도를 제공한다
    return (
      <ErrorState
        title={messages.place.detailErrorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  if (place === null) return <PlaceDetailSkeleton />

  const overview = toPlainText(place.overview)
  const homepage = parseHomepage(place.homepage)
  const copyright = copyrightLabel(place.cpyrhtDivCd)
  const suitabilityBadge = suitability.data?.suitabilityLevel ?? null
  const sourceLine = infoSourceLine(place, copyright)

  return (
    <article>
      <Breadcrumb title={place.title} />

      {/*
        원천에서 사라진 장소 안내 (#146). **2열로 들어가기 전, 폭 전체에 둔다** — 좌측 레일에
        넣으면 모바일에서 갤러리·제목 아래로 밀리고, 우측 본문에 넣으면 데스크톱에서 레일의
        하단 바(잠긴 버튼)와 멀어진다.

        **붉게 칠하지 않는다.** 오류가 아니라 이 장소가 놓인 상태다 — `Banner` 가 같은
        이유로 배경을 danger 로 쓰지 않는다.
      */}
      {place.delisted && <DelistedNotice />}

      <div className="rail-layout rail-layout-detail">
        {/*
          우측 열이 **DOM 상 먼저**다 — 모바일에서 갤러리·제목이 판정보다 위에 와야 한다.
          데스크톱에서만 grid 배치가 이것을 2열로 보낸다.
        */}
        <div className="rail-detail-main lg:border-border lg:border-l">
          <div className="pt-4 md:pt-6">
            {/* 0장이면 섹션 자체를 렌더하지 않는다 — 제목부터 시작한다 (DESIGN.md §7-3) */}
            <PhotoGallery images={place.images} title={place.title} />
          </div>

          <header className="flex flex-col gap-2.5 px-4 pt-5 pb-6 md:px-10">
            <div className="flex items-start justify-between gap-2 md:items-center">
              {/*
                공백 없는 긴 장소명이 가로로 넘치지 않게 한다 (styling-guide.md §4).

                **`min-w-0` 이 없으면 `break-words` 만으로는 줄지 않는다.** flex 항목의 기본
                `min-width: auto` 는 min-content 아래로 못 내려가고, 한국어는 `keep-all` 이라
                "제주특별자치도립김창열미술관" 전체가 하나의 끊을 수 없는 덩어리다.
                375 에서 배지가 우측 인셋을 16px 넘어 화면 끝에 붙었다(실측).
              */}
              <h1 className="text-title-1 text-fg lg:text-display min-w-0 flex-1 font-bold break-words lg:font-extrabold">
                {place.title}
              </h1>
              {/*
                등급 배지는 **판정이 실제로 왔을 때만** 붙인다. 조회 전에 자리를 잡아 두면
                빈 배지가 잠깐 등급처럼 보인다. 문구는 서버 `name` 그대로다.
              */}
              {suitabilityBadge !== null && (
                <MetricBadge tone={suitabilityTone(suitabilityBadge.code)} className="shrink-0">
                  {suitabilityBadge.name}
                </MetricBadge>
              )}
            </div>

            {/* 거리는 기준점이 없어 쓰지 않는다. 실내 여부는 #16 으로 들어왔다 */}
            <p className="text-body-2 text-fg-muted">{metaLine(place)}</p>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral" size="sm">
                {place.petAllowanceType.name}
              </Badge>
              {place.petInfo !== null && (
                <>
                  <Badge tone="neutral" size="sm">
                    {place.petInfo.allowedPetSize.name}
                  </Badge>
                  {place.petInfo.leashRequired && (
                    <Badge tone="neutral" size="sm">
                      {messages.place.detailLeashRequired}
                    </Badge>
                  )}
                </>
              )}
              {/*
                실내 여부를 모르면 점선으로 "모름" 을 드러낸다 — 목록 행과 같은 처리다
                (`place-row.tsx`). 숨기면 실내만·야외만 필터에서 이 장소가 왜 사라지는지
                설명할 길이 없고, 여기는 그 필터를 가진 목록에서 들어오는 화면이다.
              */}
              {place.indoor === null && (
                <MetricBadge tone="unknown" size="sm">
                  {messages.place.rowIndoorUnknown}
                </MetricBadge>
              )}
            </div>
          </header>
        </div>

        {/*
          좌: 판정 + 기본 정보. 데스크톱에서만 sticky 다 — `rail-sticky` 가 레일이 뷰포트보다
          길어도 바닥에 닿게 자기 스크롤을 준다 (장소 찾기 레일에서 잘렸던 전례가 있다).
        */}
        <div className="rail-detail-aside rail-sticky">
          {/* 데스크톱에서는 열 자체가 경계라 밴드를 겹쳐 쌓지 않는다 */}
          <Band className="lg:hidden" />
          <PlaceSuitabilityPanel {...suitability} />

          {/* 데스크톱 하단 바 — 판정 바로 아래, 기본 정보 위 (아트보드 03) */}
          <PlaceDetailActionBar {...actions} className="hidden lg:block" />

          <Band className="lg:hidden" />
          <div className="border-border hidden border-t lg:block" />
          <DetailSection title={messages.place.detailSectionBasic} padding="rail">
            <dl className="flex flex-col gap-3">
              <InfoRow label={messages.place.detailAddress} value={fullAddress(place)} />
              {/* 원천이 준 분류. `contentType`(문화시설)로는 카페·펜션이 갈리지 않는다 (#112) */}
              <InfoRow label={messages.place.detailSourceCategory} value={place.sourceCategory} />
              <InfoRow label={messages.place.detailTel} value={place.tel}>
                {place.tel !== null && <TelLink tel={place.tel} />}
              </InfoRow>
              <InfoRow label={messages.place.detailUseTime} value={place.intro?.useTime ?? null} />
              <InfoRow label={messages.place.detailHomepage} value={homepage?.label ?? null}>
                {homepage !== null && <HomepageLink href={homepage.href} label={homepage.label} />}
              </InfoRow>
            </dl>
          </DetailSection>
        </div>

        {/* 우측 열 아래쪽 — 본문. 위 블록과 같은 열이라 `border-left` 가 이어진다 */}
        <div className="rail-detail-main lg:border-border lg:border-l">
          <Band />
          <DetailSection title={messages.place.detailSectionPet}>
            <PlacePetInfoSection
              petInfo={place.petInfo}
              sourceText={place.intro?.chkPet ?? null}
              tel={place.tel}
              petName={petName}
              petSizeCode={petSizeCode}
              petSizeName={petSizeName}
            />
          </DetailSection>

          {/* nullable 은 에러가 아니라 숨김이다 */}
          {overview !== null && (
            <>
              <Band />
              <DetailSection title={messages.place.detailSectionOverview}>
                <PlaceOverview text={overview} />
              </DetailSection>
            </>
          )}

          {hasUseGuideValue(place.intro) && (
            <>
              <Band />
              <DetailSection title={messages.place.detailSectionIntro}>
                <dl className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-8 lg:grid-cols-1 xl:grid-cols-2">
                  <InfoRow label={messages.place.detailRestDate} value={place.intro.restDate} />
                  <InfoRow label={messages.place.detailParking} value={place.intro.parking} />
                  <InfoRow
                    label={messages.place.detailBabyCarriage}
                    value={place.intro.chkBabyCarriage}
                  />
                  <InfoRow
                    label={messages.place.detailCreditCard}
                    value={place.intro.chkCreditCard}
                  />
                  <InfoRow label={messages.place.detailInfoCenter} value={place.intro.infoCenter} />
                </dl>
              </DetailSection>
            </>
          )}

          {/* 사진 출처는 갤러리 바로 아래, 정보 출처는 본문 끝 (DESIGN.md §7-3) */}
          {sourceLine !== null && (
            <p className="text-caption text-fg-muted px-4 pt-2 pb-8 md:px-10">{sourceLine}</p>
          )}
        </div>
      </div>

      {/*
        모바일 하단 바 — 아트보드 01 의 `position:sticky; bottom:0`.

        **`bottom-16` 이다.** 고정 탭바(h-16)가 `(main)` 레이아웃에 있어 `bottom-0` 이면
        그 아래로 깔려 가려진다.

        **sticky 라 자리를 스스로 차지한다** — 본문 끝에 바 높이만큼 여백을 따로 두지
        않아도 마지막 줄이 가려지지 않는다 (fixed 였다면 필요했다).
      */}
      <PlaceDetailActionBar {...actions} className="sticky bottom-16 z-30 lg:hidden" />
    </article>
  )
}

/**
 * 뒤로 + `장소 찾기 › {장소명}` — 아트보드 03 의 브레드크럼 줄.
 *
 * 뒤로 버튼과 크럼을 **둘 다** 둔다. 브라우저 뒤로가 어디로 갈지는 진입 경로에 따라 다르고,
 * 크럼은 항상 목록으로 간다 — 다른 일을 하는 두 컨트롤이다.
 */
function Breadcrumb({ title }: { title: string }) {
  return (
    <nav
      aria-label={messages.place.detailBreadcrumbLabel}
      className="border-border flex items-center gap-1 border-b px-4 py-1.5 md:px-10"
    >
      <PlaceBackLink />
      <ChevronRightIcon size={16} aria-hidden className="text-fg-subtle shrink-0" />
      <span className="text-body-2 text-fg-muted min-w-0 truncate font-medium">{title}</span>
    </nav>
  )
}

/**
 * 원천에서 사라진 장소 안내 (#146).
 *
 * **`role="alert"` 을 쓰지 않는다.** 방금 일어난 실패가 아니라 이 장소가 원래 놓인
 * 상태라, 화면에 들어오자마자 낭독을 가로챌 일이 아니다. 제목을 `strong` 으로 두어
 * 훑어 읽을 때 먼저 잡히게만 한다.
 */
function DelistedNotice() {
  return (
    <div className="px-4 py-3 md:px-10">
      <div className="bg-band rounded-md px-3 py-2.5">
        <strong className="text-body-2 text-fg block font-semibold">
          {messages.place.detailDelistedTitle}
        </strong>
        <p className="text-body-2 text-fg-muted mt-0.5">
          {messages.place.detailDelistedDescription}
        </p>
      </div>
    </div>
  )
}

function DetailSection({
  title,
  padding = 'main',
  children,
}: {
  title: string
  /**
   * 레일(24)과 본문(40)은 **1024 이상에서만** 인셋이 다르다 — 아트보드 03.
   * 그 아래에서는 레일이 레일이 아니라 한 컬럼의 한 블록이라 본문 인셋을 따른다.
   */
  padding?: 'main' | 'rail'
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 py-5',
        padding === 'rail' ? 'px-4 md:px-10 lg:px-6' : 'px-4 md:px-10',
      )}
    >
      <h2 className="text-title-2 text-fg lg:text-title-1 font-semibold lg:font-bold">{title}</h2>
      {children}
    </section>
  )
}

/**
 * 값이 없으면 줄 자체를 렌더하지 않는다.
 * `children` 을 주면 값 대신 그것을 렌더한다 (링크가 필요한 줄).
 */
function InfoRow({
  label,
  value,
  children,
}: {
  label: string
  value: string | null
  children?: ReactNode
}) {
  const text = toPlainText(value)
  if (text === null) return null

  return (
    <div className="flex gap-3">
      {/* 80 — `유모차 대여` 가 64 에서 두 줄로 접혔다(1280 실측). 아트보드 이용 안내도 80 이다 */}
      <dt className="text-body-2 text-fg-muted w-20 shrink-0">{label}</dt>
      {/* 개행이 있는 원문이 한 줄로 뭉치지 않게 한다 */}
      <dd className="text-body-2 text-fg flex-1 break-keep whitespace-pre-line">
        {children ?? text}
      </dd>
    </div>
  )
}

function TelLink({ tel }: { tel: string }) {
  return (
    <a
      href={`tel:${tel.replace(/[^\d+]/g, '')}`}
      // 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 상세에서 전화는 주요 행동이라
      // 문장 속 인라인 링크가 아니라 독립 타깃으로 다룬다
      className="text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none"
    >
      {tel}
    </a>
  )
}

function HomepageLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      // 원문이 외부 링크다. opener 를 넘기지 않는다
      rel="noopener noreferrer"
      // 전화와 같은 이유로 44px 히트 영역을 준다
      className="text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-sm font-semibold break-all focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
    </a>
  )
}

/**
 * 제목 아래 메타 줄 — `제주시 한경면 · 문화시설 · 야외`.
 *
 * **전체 주소를 쓰지 않는다.** 그것은 기본 정보의 몫이고, 여기는 "어디쯤인지" 만 말한다.
 * 아트보드의 `2.3km` 는 넣지 않는다 — 상세는 어디서부터 잰 거리인지 기준이 없다.
 *
 * **`indoor` 가 null 이면 낱말이 빠진다** (`indoorLabel`). 그 경우는 속성 배지 줄의
 * "실내 여부 미확인" 이 대신 말한다 — 메타 줄에서 "야외" 라고 단정하지 않는다.
 */
function metaLine(place: PlaceDetail): string {
  return [shortAddress(place.addr1), place.contentType.name, indoorLabel(place.indoor)]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ')
}

/**
 * 본문 끝 정보 출처 줄.
 *
 * **두 원천을 겹쳐 쓰지 않는다.** `cpyrhtDivCd` 가 있으면 원천이 TourAPI 라는 뜻이고
 * (배치의 `TourApiPlaceCatalogAdapter` 에서만 채워진다) 그때는 **공공누리 출처 표시 의무**가
 * 있어 기관명 "한국관광공사" 와 유형을 함께 적는다 (세부명세 D5-2). `sourceName` 의
 * "관광정보 API" 로 바꾸면 표기 의무를 만족하지 못한다.
 *
 * 그 값이 없는 원천(문화정보원·식약처)은 지금까지 **출처 줄이 아예 없었다.** #16 으로
 * `sourceName` 이 들어와 그 자리를 채운다 (#112).
 */
function infoSourceLine(place: PlaceDetail, copyright: string | null): string | null {
  if (copyright !== null) {
    return `${messages.place.detailCopyrightPrefix} · ${copyright}`
  }

  const source = place.sourceName?.trim()
  if (source === undefined || source === '') return null

  return messages.place.detailSourcePrefix.replace('{source}', source)
}

/** `addr2` 는 `addr1` 이 있을 때만 뒤에 붙인다 */
function fullAddress(place: PlaceDetail): string | null {
  if (place.addr1 === null) return null
  return place.addr2 === null ? place.addr1 : `${place.addr1} ${place.addr2}`
}

/**
 * 이용 안내 섹션을 만들지 판단한다.
 *
 * **`useTime` 은 보지 않는다** — 운영시간은 기본 정보로 옮겼다. 그것만 있고 나머지가 비면
 * 이용 안내는 빈 섹션이 된다.
 */
function hasUseGuideValue(intro: PlaceIntro | null): intro is PlaceIntro {
  if (intro === null) return false

  return [
    intro.restDate,
    intro.parking,
    intro.chkBabyCarriage,
    intro.chkCreditCard,
    intro.infoCenter,
  ].some((value) => toPlainText(value) !== null)
}
