import type { ReactNode } from 'react'

import { Badge } from '@/components/badge'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ChevronRightIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { Surface, SurfaceStack } from '@/components/surface'
import { PhotoGallery } from '@/features/place/photo-gallery'
import { PlaceBackLink } from '@/features/place/place-back-link'
import {
  CONGESTION_HEADING_ID,
  PlaceCongestionPanel,
  type PlaceCongestionPanelProps,
} from '@/features/place/place-congestion-panel'
import {
  PlaceDetailActionBar,
  type PlaceDetailActions,
} from '@/features/place/place-detail-action-bar'
import { PlaceDetailSkeleton } from '@/features/place/place-detail-skeleton'
import { PlaceMiniMap } from '@/features/place/place-mini-map'
import { PlaceOverview } from '@/features/place/place-overview'
import { PlacePetInfoSection } from '@/features/place/place-pet-info'
import {
  PlaceSuitabilityPanel,
  type PlaceSuitabilityPanelProps,
} from '@/features/place/place-suitability-panel'
import {
  PlaceWalkSafetyPanel,
  type PlaceWalkSafetyPanelProps,
} from '@/features/place/place-walk-safety-panel'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { copyrightLabel } from '@/lib/place/copyright'
import { galleryImages } from '@/lib/place/gallery'
import { parseHomepage } from '@/lib/place/homepage'
import { indoorLabel } from '@/lib/place/indoor'
import { toPlainText } from '@/lib/place/text'
import { INSET_CLASS } from '@/lib/ui/inset'
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
  /**
   * 산책 위험도 패널이 쓰는 것 전부 (#197).
   *
   * **적합도와 별개 prop 이다.** 엔드포인트가 다르고 한쪽만 실패할 수 있어, 하나로 묶으면
   * 적합도가 죽을 때 노면 온도까지 함께 사라진다.
   */
  walkSafety: PlaceWalkSafetyPanelProps
  /** 기간 혼잡도 (#430). 판정 둘과 **따로 실패한다** — 엔드포인트가 다르다 */
  congestion: PlaceCongestionPanelProps
  /** 선택된 반려견 — 동반 정보에 대입한다 */
  petName: string | null
  petSizeCode: string | null
  petSizeName: string | null
  /** 하단 바(담기 + 저장)가 쓰는 것 전부 — #118 */
  actions: PlaceDetailActions
}

/** 갤러리 + 제목 카드가 `aria-labelledby` 로 가리키는 `h1` 의 id (#531) */
const DETAIL_HEADING_ID = 'place-detail-heading'

/**
 * 장소 상세 — 아트보드 `혼디가개 장소 상세` 01(모바일 390) · 03(데스크톱 1440) · 04(상태).
 *
 * **데스크톱은 2단이다.** 좌 `--rail-context`(400) sticky = 판정 두 개 + 하단 바,
 * 우 1fr = 갤러리 + 제목 + 기본 정보 + 본문.
 *
 * **3층 표면이다** (`DESIGN.md §0`, 이슈 #443). `main` 이 L0 바닥(`Canvas`, 페이지가 건다),
 * 세 개의 `SurfaceStack` 이 그 위에 L1 카드를 쌓는다 — 우측 열이 DOM 상 두 블록이라 스택도
 * 둘이고, 좌측 레일이 하나다. **열 구분선은 걷었다** — 카드 사이·열 사이로 바닥이 비쳐
 * L0 이 그 일을 한다 (홈 #428 · 장소 목록 #439 와 같은 이유).
 *
 * **카드 판정 3문을 절마다 적용한 결과:**
 * - 브레드크럼 · 폐업 안내 · 갤러리 · 제목 줄 — **카드가 아니다.** 페이지 머리 · 전폭 미디어 ·
 *   알림 스트립은 §0 이 카드 밖으로 못박은 것들이다. 바닥 위에 직접 놓는다.
 * - 기본 정보 · 반려견 동반 정보 · 장소 소개 · 이용 안내 — 각각 **카드**(`DetailCard`).
 *   제목이 카드 안으로 들어간다.
 * - 적합도 + 산책 위험도 + (데스크톱) 하단 바 — **한 카드**. 같은 화자가 이어 말한다:
 *   "오늘 가도 되나 → 지금 걷기 안전한가 → 그러면 담을까". §0 의 "카드 경계는 이야기 단위"
 *   다. 하단 바를 카드 밖 L0 에 두면 테두리 없는 흰 띠가 되고, 자기 카드로 만들면 §0 이
 *   금지한 "액션 바 카드" 가 된다.
 *
 * **기본 정보는 레일이 아니라 제목 바로 아래다.** 레일에 있던 동안에는 주소·전화·운영시간이
 * 판정 아래로 밀려, 상세에 들어온 사람이 제일 먼저 묻는 "여기 어디고 몇 시까지 하냐" 가
 * 판정보다 뒤에 있었다. 레일에는 **판정만** 남는다 — 한 가지 성격의 것만 든다.
 *
 * DOM 순서는 **모바일 기준**이다 (갤러리 → 제목 → 기본 정보 → 판정 → 본문). 데스크톱 배치는
 * `.rail-layout-detail` 의 grid 배치가 바꾼다 — 트리를 폭마다 둘로 나누면 같은 내용이 두 번
 * 렌더돼 스크린리더가 중복해 읽는다. 자세한 이유는 `app/globals.css` 에 적어 뒀다.
 *
 * 4개 상태를 **배타적으로** 렌더한다. props 로만 데이터를 받는 presentational 컴포넌트다
 * — node 환경에서 테스트하기 위해서다 (docs/testing-guide.md §1).
 *
 * **404 의 정상 경로는 여기가 아니다.** 서버 컴포넌트가 `notFound()` 로 보낸다.
 * 여기서 404 를 다루는 것은 클라이언트 재조회에서 리소스가 사라진 경우다.
 *
 * "지도 보기"·"길찾기"는 기본 정보 절 끝의 `PlaceMiniMap` 이 맡는다
 * ([#14](https://github.com/8llow8llowMe/hondigagae/issues/14) 로 미뤄 뒀던 자리다).
 *
 * 아트보드에 있으나 **여전히 구현하지 않은 것**: 메타의 거리(상세는 기준점이 없다) ·
 * 입장료. **없는 값을 지어내지 않는다.**
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
  walkSafety,
  congestion,
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
        <DetailStateShell heading={messages.place.detailNotFoundTitle}>
          <EmptyState
            title={toMessage(errorMessage, messages.place.detailNotFoundTitle)}
            description={messages.place.detailNotFoundDescription}
            inset="card"
            action={<PlaceBackLink />}
          />
        </DetailStateShell>
      )
    }

    // 컨트롤러가 @PathVariable long 이라 숫자가 아닌 placeId 는 404 가 아니라 400 이다.
    // 주소 자체가 잘못된 것이므로 재시도해도 같은 400 이다 — 재시도를 주지 않는다
    if (kind === 'validation') return <PlaceDetailInvalidId errorMessage={errorMessage} />

    // 5xx · 무응답 — 재시도를 제공한다
    return (
      <DetailStateShell heading={messages.place.detailErrorTitle}>
        <ErrorState
          title={messages.place.detailErrorTitle}
          description={messages.common.temporaryErrorDescription}
          inset="card"
          onRetry={onRetry}
        />
      </DetailStateShell>
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
          데스크톱에서만 grid 배치가 이것을 2열로 보낸다. `SurfaceStack` 자체가 grid 의
          자식이다 — 바닥은 `main` 이 칠했고 이 스택은 카드 간격만 맡는다 (홈과 같은 구조).
        */}
        {/* 열 사이 24 — 마주 보는 쪽만 절반을 낸다 (globals.css `.rail-layout` 주석, #559) */}
        <SurfaceStack className="rail-detail-main lg:pl-3">
          {/*
            ── 갤러리 + 제목이 **한 장의 카드다** (#531)

            **예전에는 카드가 아니었다** — "전폭 미디어 · 페이지 머리는 카드가 아니다"(§0)를
            근거로 L0 바닥 위에 직접 놓았다. 그런데 이 화면은 **그 아래 전부가 흰 카드다**
            (기본 정보 · 반려견 동반 · 장소 소개 · 이용 안내 · 판정). 그래서 화면의 이름인
            제목만 회색 바닥에 얹혀, 페이지에서 가장 중요한 블록이 가장 덜 중요해 보였다.

            **§0 을 뒤집은 것이 아니라 판정 3문을 다시 물은 것이다.** ① 자기 제목이 있는가 —
            `h1` 이 여기 있다. ② 혼자 떼어놔도 말이 되는가 — 사진·이름·등급·동반 조건은
            그것만으로 "이 장소가 무엇인가" 를 답한다. ③ 담는 항목이 둘 이상인가 — 갤러리와
            제목 블록 둘이다. 셋 다 "예" 다. §0 이 카드에서 뺀 "전폭 미디어" 는 **갤러리가
            전폭일 때**의 이야기인데, 이 갤러리는 자기 인셋과 radius 를 갖는 타일 묶음이라
            애초에 전폭이 아니다.

            **카드 이름은 `titleId` 로 `h1` 을 가리킨다** — `aria-label` 로 같은 문자열을
            다시 적으면 두 곳이 갈린다 (`Surface` 머리주석).

            갤러리는 **md 부터만** 인셋을 받는다(`md:px-5`). 모바일 캐러셀은 자기 `px-4` 를
            이미 갖고 있어(`photo-gallery.tsx`) 여기서 또 주면 16 이 두 겹으로 32 가 된다.
            데스크톱 스트립은 자기 인셋이 없어 카드 테두리에 그대로 닿으므로 여기서 20 을
            준다 — `INSET_CLASS.card` 의 데스크톱 값과 같다.

            제목 줄은 카드 **안 글줄**과 같은 인셋(`card`)이다. 이제 진짜 카드 안이라
            예전 주석이 적어 둔 "테두리 1px 만큼 어긋난다"(444 vs 445)가 사라지고 아래
            카드들과 정확히 같은 세로선에 선다.
          */}
          <Surface titleId={DETAIL_HEADING_ID}>
            <div className="flex flex-col gap-5 py-4 md:gap-6 md:py-5">
              {/*
              **`images` 가 비면 `firstImage` 를 쓴다** — dev 실데이터는 `images` 가 전부
              빈 배열이고 사진이 `firstImage` 로만 온다 (`lib/place/gallery.ts`).

              사진이 하나도 없으면 **카테고리 일러스트**가 그 자리를 채운다 (DESIGN.md §7-3).
              그래서 `contentType.code` 를 넘긴다 — 한국어 `name` 으로 고르지 않는다.
            */}
              <div className="md:px-5">
                <PhotoGallery
                  images={galleryImages(place.images, place.firstImage, place.cpyrhtDivCd)}
                  title={place.title}
                  contentTypeCode={place.contentType.code}
                />
              </div>

              <header className={cn('flex flex-col gap-3', INSET_CLASS.card)}>
                <div className="flex items-start justify-between gap-2 md:items-center">
                  {/*
                  공백 없는 긴 장소명이 가로로 넘치지 않게 한다 (styling-guide.md §4).

                  **`min-w-0` 이 없으면 `break-words` 만으로는 줄지 않는다.** flex 항목의 기본
                  `min-width: auto` 는 min-content 아래로 못 내려가고, 한국어는 `keep-all` 이라
                  "제주특별자치도립김창열미술관" 전체가 하나의 끊을 수 없는 덩어리다.
                  375 에서 배지가 우측 인셋을 16px 넘어 화면 끝에 붙었다(실측).
                */}
                  <h1
                    id={DETAIL_HEADING_ID}
                    className="text-title-1 text-fg lg:text-display min-w-0 flex-1 font-bold break-words lg:font-extrabold"
                  >
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
                  {/*
                  **`UNKNOWN` 이면 그리지 않는다** (#530) — 목록 행과 같은 처리다
                  (`place-row.tsx` 의 `PlaceBadges` 주석이 근거를 갖고 있다). 서버 `name` 이
                  `정보 없음` 이라 옆 태그에 걸려 읽힌다. **동반 조건을 감추는 것이 아니다** —
                  아래 `반려견 동반` 섹션이 `PlacePetInfoSection` 으로 같은 `allowance` 를
                  받아 문장으로 말한다 (`place-pet-info.tsx`).
                */}
                  {place.petAllowanceType.code !== 'UNKNOWN' && (
                    <Badge tone="neutral" size="sm">
                      {place.petAllowanceType.name}
                    </Badge>
                  )}
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
          </Surface>

          {/*
            ── 기본 정보 ─────────────────────────────────────────────────────

            **좌측 레일이 아니라 제목 바로 아래다.** 레일에 있던 동안에는 주소·전화·운영시간이
            판정(적합도·산책 위험도) 아래로 밀려 있었다 — 상세에 들어온 사람이 제일 먼저 묻는
            "여기 어디고 몇 시까지 하냐" 가 판정보다 뒤에 있었던 것이다. 제목 다음 자리가
            그 질문의 자리다.

            **폭마다 나누지 않는다.** DOM 하나를 옮겨 모바일 순서도 같이 바뀐다 — 트리를
            둘로 나누면 같은 내용이 두 번 렌더돼 스크린리더가 중복해 읽는다
            (`app/globals.css` 의 `.rail-layout-detail` 주석과 같은 규칙).
          */}
          <DetailCard title={messages.place.detailSectionBasic}>
            <dl className="flex flex-col gap-3">
              <InfoRow label={messages.place.detailAddress} value={fullAddress(place)} />
              {/* 원천이 준 분류. `contentType`(문화시설)로는 카페·펜션이 갈리지 않는다 (#112) */}
              <InfoRow label={messages.place.detailSourceCategory} value={place.sourceCategory} />
              <InfoRow label={messages.place.detailTel} value={place.tel}>
                {place.tel !== null && <TelLink tel={place.tel} />}
              </InfoRow>
              {/*
                영업 상태는 **운영시간 원문 위**에 선다 (#294 · 세부명세 D5). 별도 행으로
                떼면 판정값과 원문이 같은 크기로 서서 어느 쪽이 답인지 흐려진다.

                `useTime` 이 없으면 행 자체가 사라지는 동작을 그대로 둔다 — 근거 없이
                판정만 오는 갈래는 계약상 없다 (`types/place.ts` 의 `openNow` 주석).
              */}
              <InfoRow label={messages.place.detailUseTime} value={place.intro?.useTime ?? null}>
                <PlaceOpenStatus
                  open24={place.intro?.open24 ?? null}
                  openNow={place.intro?.openNow ?? null}
                  useTime={place.intro?.useTime ?? null}
                />
              </InfoRow>
              <InfoRow label={messages.place.detailHomepage} value={homepage?.label ?? null}>
                {homepage !== null && <HomepageLink href={homepage.href} label={homepage.label} />}
              </InfoRow>
            </dl>

            {/*
              지도는 **`dl` 밖, 절의 끝**이다 (#14).

              행 사이에 끼우지 않는다 — `InfoRow` 가 이미 `dl > div > dt+dd` 구조라 그 안에
              지도 div 를 하나 더 끼우면 목록의 짝 구조가 깨지고, `dd` 안에 넣으면 라벨
              80 + 간격 12 만큼 들여써져 375 에서 지도 폭이 251px 로 쪼그라든다.

              절의 끝에 두면 카드 안 폭을 쓰고, 위의 주소가 글자로 말한 것을 그림으로 한 번 더
              말하는 순서가 된다. 좌표가 없거나 SDK 가 실패하면 스스로 사라진다.
            */}
            <PlaceMiniMap
              placeId={place.placeId}
              title={place.title}
              lat={place.lat}
              lng={place.lng}
            />
          </DetailCard>
        </SurfaceStack>

        {/*
          좌: 판정 카드. 데스크톱에서만 sticky 다 — `rail-sticky` 가 레일이 뷰포트보다
          길어도 바닥에 닿게 자기 스크롤을 준다 (장소 찾기 레일에서 잘렸던 전례가 있다).

          **위 여백** — 모바일은 앞 스택과 8(카드 간격), 태블릿 한 컬럼은 앞 스택의 아래
          24 가 이미 있어 0, 데스크톱은 자기 열의 첫 요소라 24 다.
        */}
        <SurfaceStack className="rail-detail-aside rail-sticky pt-2 md:pt-0 lg:pt-6 lg:pr-3">
          {/*
            **`title` 이 아니라 `aria-label` 이다.** 두 패널이 라벨·등급어·점수를 한 줄에
            스스로 그려 `title` 슬롯(제목 + 부제 + 우측 액션)에 맞지 않는다 — 홈 판정 카드와
            같은 사정이다. 그래서 카드 위에 선이 없고, 첫 패널의 위 여백이 카드 위 여백이다.
          */}
          <Surface aria-label={messages.place.detailVerdictCardLabel}>
            <PlaceSuitabilityPanel {...suitability} />

            {/*
              산책 위험도 (#197). **적합도 바로 아래, 하단 바 위**에 둔다 — 둘 다 판정이라
              한 묶음으로 읽혀야 하고, 하단 바(담기·저장)가 사이에 끼면 판정이 두 군데로
              갈린다. 아트보드 03 의 `판정 → 하단 바` 순서는 그대로다.

              **1px 선으로만 나눈다** — L2 구분선(§0). 카드를 둘로 쪼개면 "오늘은 적합 /
              지금은 위험" 이 같은 장소의 두 축이라는 것이 사라진다.
            */}
            <div className="border-border border-t" />
            <PlaceWalkSafetyPanel {...walkSafety} />

            {/*
              데스크톱 하단 바 — 판정 카드의 끝 (아트보드 03). 인셋은 카드 값이고 배경은
              카드가 소유한다 (`PlaceDetailActionBar` 의 `inset` 주석).
            */}
            <PlaceDetailActionBar {...actions} inset="card" className="hidden lg:block" />
          </Surface>

          {/*
            기간 혼잡도 (#430) — **판정 카드 밖, 바로 아래의 새 L1 카드다.**

            판정 카드 안에 넣지 않는 이유는 §0 의 "카드 경계는 이야기 단위" 다. 저 카드가
            하는 말은 "오늘 가도 되나 → 지금 걷기 안전한가 → 그러면 담을까" 이고, 이 카드는
            **다른 시간 축**("이번 주엔 언제")이다. 같은 카드에 넣으면 하단 바가 이야기
            가운데로 들어오거나, 담기 뒤에 새 질문이 붙는다.

            **접힌 서랍으로도 넣지 않는다** — 이 서비스의 차별점이 기본 상태에서 안 보인다.
            제목은 패널이 스스로 `h2` 로 그리고 카드는 `titleId` 로 그것을 가리킨다.
          */}
          <Surface titleId={CONGESTION_HEADING_ID}>
            <PlaceCongestionPanel {...congestion} />
          </Surface>
        </SurfaceStack>

        {/*
          우측 열 아래쪽 — 본문. 위 블록과 같은 열(grid column 2)에 이어 선다.
          위 여백은 모바일 8, 그 위로는 0 — 앞 스택의 아래 24 가 카드 간격이다.
        */}
        <SurfaceStack className="rail-detail-main pt-2 md:pt-0 lg:pl-3">
          <DetailCard title={messages.place.detailSectionPet}>
            <PlacePetInfoSection
              petInfo={place.petInfo}
              allowance={place.petAllowanceType}
              sourceText={place.intro?.chkPet ?? null}
              tel={place.tel}
              petName={petName}
              petSizeCode={petSizeCode}
              petSizeName={petSizeName}
            />
          </DetailCard>

          {/*
            nullable 은 에러가 아니라 숨김이다.

            **개요는 카드다.** 판정 3문 ③("항목이 둘 이상")을 글자대로 읽으면 한 문단은 못
            넘지만, ③ 의 취지는 배지·버튼 하나를 카드로 감싸는 것을 막는 데 있다. 개요는
            원천이 준 **본문 블록**이고 자기 제목이 있고 혼자 떼어놔도 말이 된다.
          */}
          {overview !== null && (
            <DetailCard title={messages.place.detailSectionOverview}>
              <PlaceOverview text={overview} />
            </DetailCard>
          )}

          {hasUseGuideValue(place.intro) && (
            <DetailCard title={messages.place.detailSectionIntro}>
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
            </DetailCard>
          )}

          {/*
            사진 출처는 갤러리 바로 아래, 정보 출처는 본문 끝 (DESIGN.md §7-3).
            카드가 아니라 바닥 위의 한 줄이다 — 자료가 아니라 자료의 꼬리표라, 카드로 감싸면
            본문과 같은 무게가 된다. 인셋은 카드 안 글줄과 같은 축(`card`)이다.
          */}
          {sourceLine !== null && (
            <p className={cn('text-caption text-fg-muted pb-4 md:pb-0', INSET_CLASS.card)}>
              {sourceLine}
            </p>
          )}
        </SurfaceStack>
      </div>

      {/*
        모바일 하단 바 — 아트보드 01 의 `position:sticky; bottom:0`.

        **오프셋 breakpoint 와 표시 breakpoint 가 다르다.** 바 자신은 `lg` 미만에서 보이지만
        (데스크톱은 좌측 레일이 대신한다), 바닥을 비켜야 할 이유인 **고정 탭바는 `md:hidden`
        이라 768 에서 이미 사라진다.** 둘을 같은 값으로 묶어 `bottom-16` 만 두었더니
        768~1023 에서 바가 바닥에서 64px 떠 그 아래로 본문이 비쳤다(당시 실측: 900×800 에서
        탭바 `display:none`, 바는 뷰포트 바닥에서 정확히 64px).

        **그 실측에는 `#main` 의 `pb-16 md:pb-0` 이 함께 있었지만 지금은 없다** (#456③ 에서
        걷었다 — `Canvas` 밖이라 모바일에서 회색 바닥과 푸터 사이에 흰 띠를 만들었다).
        이 바는 `sticky` 라 그 padding 에 기대지 않는다. 375×812 실측으로 확인했다:
        바 아래끝 748 = 탭바 위끝, 맨 아래까지 굴렸을 때 푸터 마지막 줄 716 — 둘 다
        탭바 뒤로 들어가지 않는다.

        그래서 **탭바가 있는 폭에서만 그만큼 올린다** — `md` 부터는 바닥에 붙는다.

        **sticky 라 자리를 스스로 차지한다** — 본문 끝에 바 높이만큼 여백을 따로 두지
        않아도 마지막 줄이 가려지지 않는다 (fixed 였다면 필요했다).

        **배경은 이 갈래만 갖는다** — 본문 위를 지나가는 띠라 불투명해야 한다. 카드 안의
        데스크톱 갈래는 카드가 면을 소유한다 (§0).
      */}
      <PlaceDetailActionBar
        {...actions}
        className="bg-bg sticky bottom-16 z-30 md:bottom-0 lg:hidden"
      />
    </article>
  )
}

/**
 * 상태 갈래의 껍데기 — **서버 경계와 같은 축에 세운다** (#480).
 *
 * 같은 404·오류가 "누가 잡았는가" 에 따라 다른 자리에 서 있었다. 서버가 404 를 잡으면
 * `app/(main)/places/[placeId]/not-found.tsx` 가 뜨는데 거기는 `content-container`(1440 캡)
 * 안에서 인셋이 `card` 라 md 이상에서 글줄이 44 다. 화면 안 재조회가 404 를 잡으면 여기가
 * 뜨는데 **캡도 없고 인셋도 기본값 `main`(40)** 이었다 — 1920 에서 글줄이 화면 왼쪽 끝에
 * 붙고, 서버가 잡았을 때와 눈에 띄게 달랐다.
 *
 * `error-state.tsx` 의 `inset` 주석이 막으려던 모양 그대로다 — *"로딩(24) → 오류(40) →
 * 성공(24) 이 서로 다른 인셋을 썼다"*.
 *
 * **경계 쪽으로 맞췄다.** 캡 없는 40 은 넓은 화면에서 글줄이 갈 데까지 가고, #475 가
 * 라우트 상태 파일을 옮길 때 이미 캡 + 44 를 고른 판단이 있다.
 *
 * **`h1` 도 경계와 같은 키를 쓴다.** 이 갈래들은 `<article>` 에 닿기 전에 반환하므로
 * 예전에는 **문서에 `h1` 이 하나도 없었다** — 서버가 잡았을 때는 경계가 `sr-only h1` 을
 * 그렸다. 보이는 제목은 상태 컴포넌트의 제목이 이미 그리므로 여기서도 `sr-only` 다.
 */
/**
 * 주소의 `placeId` 자체가 잘못됐다 — 400(`PLACE_113`).
 *
 * **두 곳이 같은 화면을 그린다** (#496). 서버가 형식을 먼저 보고 요청 없이 여기로 오는
 * 길(`app/(main)/places/[placeId]/page.tsx`)과, 어떤 이유로든 400 을 받아 화면 안에서
 * 잡는 길이다. **한 벌로 두지 않으면 "누가 잡았는가" 에 따라 문구가 갈린다** — #480 이
 * 인셋에서 잡은 것과 같은 축이다.
 *
 * **재시도를 주지 않는다.** 주소가 잘못된 것이라 다시 물어도 같은 400 이다
 * (`api-integration-guide.md` §3 · `EmptyState` 에 `onRetry` 슬롯이 없다).
 *
 * `errorMessage` 는 **서버가 실제로 답했을 때만** 온다. 요청 없이 가른 길에는 없고,
 * 그때는 기본 문구로 떨어진다 — 이슈가 실측한 화면 그대로다.
 */
export function PlaceDetailInvalidId({ errorMessage }: { errorMessage?: unknown }) {
  return (
    <DetailStateShell heading={messages.common.validationErrorTitle}>
      <EmptyState
        title={messages.common.validationErrorTitle}
        description={toMessage(errorMessage, messages.place.detailNotFoundDescription)}
        inset="card"
        action={<PlaceBackLink />}
      />
    </DetailStateShell>
  )
}

function DetailStateShell({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <SurfaceStack className="content-container">
      <h1 className="sr-only">{heading}</h1>
      {children}
    </SurfaceStack>
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
      // `content-container` — 1440 캡 안에서 카드 열과 같은 경계를 쓴다 (#376). 홈의 특보 스트립과 같은 자리다
      className={cn(
        'border-border content-container flex items-center gap-1 border-b py-1.5',
        INSET_CLASS.main,
      )}
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
 *
 * **알림 스트립이라 카드가 아니다** (§0). 예전의 `bg-band` 채움 상자는 흰 바닥 위의 것이었다 —
 * L0 `--bg-sunken`(#F5F6F8) 위에서는 `--band`(#EEF0F3) 와 대비가 **1.06** 이라 상자가 보이지
 * 않는다(실측, #443). 채움을 걷고 홈의 특보 스트립(`WeatherWarningStrip`)과 같은 모양 —
 * 전폭 `border-b` 줄 + 페이지 인셋 — 으로 둔다. 글자 무게(`strong`)가 경고를 맡는다.
 */
function DelistedNotice() {
  return (
    <div className="border-border border-b">
      {/* 캡하지 않으면 1920 에서 아래 본문과 세로선이 꺾인다 (#376) */}
      <div className={cn('content-container py-3', INSET_CLASS.main)}>
        <strong className="text-body-2 text-fg block font-semibold">
          {messages.place.detailDelistedTitle}
        </strong>
        <p className="text-body-2 text-fg-muted mt-1">{messages.place.detailDelistedDescription}</p>
      </div>
    </div>
  )
}

/**
 * 본문의 한 절 = **L1 카드 하나** (`Surface`). 제목이 카드 안에 있고(§0), 본문은 카드
 * 인셋(`INSET_CLASS.card`, 16/20)을 쓴다 — 페이지 인셋 40 을 카드 안에서 쓰면 내용이 두 번
 * 밀린다. 세로는 `Surface` 의 제목 줄(위 20 · 아래 12)에 본문 아래 20 을 더해 위아래가 같다.
 */
function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface title={title}>
      <div className={cn('flex flex-col gap-3 pb-5', INSET_CLASS.card)}>{children}</div>
    </Surface>
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

/**
 * 영업 상태 — `운영시간` 원문 위의 판정값 (#294).
 *
 * **등급 색을 쓰지 않는다.** 초록·주황은 산책 위험도 전용이고(DESIGN.md) 영업 여부는
 * 판정 축이 아니다. 긴급 시설 `OpenStatus`(`features/emergency/facility-row.tsx`)와 같은
 * 규칙으로 **색이 아니라 무게로 가른다.**
 *
 * **그 선례와 갈리는 곳이 하나 있다 — `null` 을 드러내지 않는다.** 긴급 시설은 원문조차
 * 없는 곳이 있어 "영업 여부 확인 필요" 가 정보였지만, 여기는 바로 아래 `useTime` 원문이
 * 항상 있어(계약상) 정보가 아니라 노이즈다. dev 실측 2026-09-08 로는 장소 200곳의
 * `openNow` 가 **전부 `null`** 이라, 드러냈다면 131곳 전부가 그 배지 하나만 달고 있었다.
 *
 * 문구가 다르고(`진료중` vs `영업 중`) 이 갈래가 갈리므로 두 컴포넌트를 합치지 않는다 —
 * 프롭으로 분기를 실으면 양쪽 다 읽기 어려워진다.
 */
function PlaceOpenStatus({
  open24,
  openNow,
  useTime,
}: {
  open24: boolean | null
  openNow: boolean | null
  useTime: string | null
}) {
  const text = toPlainText(useTime)

  return (
    <>
      {/*
        **`open24` 면 `openNow` 를 말하지 않는다.** 24시간인 곳에 "지금 영업 중" 은
        동어반복이고 "영업 종료" 는 모순이다 — 그 모순이 실제로 온다 (긴급 시설 dev 응답의
        청사약국이 `10:00~24:00` 인데 `open24: true`/`openNow: false` 다). 모순을 나란히
        두면 사용자가 판단할 수 없고, 원문이 바로 아래 있으니 확인할 수 있다.
      */}
      {open24 === true ? (
        <Badge tone="neutral">{messages.place.detailOpen24}</Badge>
      ) : (
        openNow !== null && (
          // 영업 중은 무게를 주고, 영업 종료는 그대로 둔다
          <Badge tone="neutral" className={openNow ? 'text-fg font-semibold' : ''}>
            {openNow ? messages.place.detailOpenNow : messages.place.detailOpenClosed}
          </Badge>
        )
      )}
      {/* 판정값이 있으면 줄을 바꿔 원문을 아래에 둔다 — 위계가 이 순서로 드러난다 */}
      {text !== null && <span className="block">{text}</span>}
    </>
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
