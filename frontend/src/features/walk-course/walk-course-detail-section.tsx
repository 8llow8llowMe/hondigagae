'use client'

import type { ReactNode } from 'react'

import { BackLink } from '@/components/back-link'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ChevronRightIcon } from '@/components/icons'
import { Skeleton } from '@/components/skeleton'
import { SurfaceStack } from '@/components/surface'
import { WalkCourseAddAction } from '@/features/walk-course/walk-course-add-action'
import { WalkCourseGoldenSlot } from '@/features/walk-course/walk-course-golden-slot'
import { WalkCourseNearbyPlaces } from '@/features/walk-course/walk-course-nearby-places'
import { WalkCourseStartMap } from '@/features/walk-course/walk-course-start-map'
import {
  WalkCourseHero,
  WalkCourseSourceLine,
  WalkCourseSummaryHeader,
} from '@/features/walk-course/walk-course-summary-header'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { WalkTimesResponse } from '@/types/insight'
import type { NearbyPlaceItem } from '@/types/place'
import type { WalkCourseDetail } from '@/types/walk-course'

export type WalkCourseDetailSectionProps = {
  course: WalkCourseDetail | null
  loading: boolean
  /** 실패한 요청의 HTTP 상태. 성공이면 null */
  errorStatus: number | null
  /** 서버가 준 `resultMessage` (문자열이 아닐 수 있다) */
  errorMessage?: unknown
  onRetry: () => void
  walkTimes: WalkTimesResponse | null
  walkTimesLoading: boolean
  onWalkTimesRetry: () => void
  /**
   * 시작점 근처 장소 ([#826](https://github.com/8llow8llowMe/hondigagae/issues/826)).
   *
   * **0건 · 좌표 없음 · 조회 실패가 모두 빈 배열로 온다.** 호출부가 셋을 가르지 않는 이유는
   * 화면이 셋에 같은 답(섹션을 만들지 않는다)을 하기 때문이다 — 가르면 여기서 다시 합쳐야 한다.
   */
  nearbyPlaces: NearbyPlaceItem[]
  nearbyPlacesLoading: boolean
  /** `일정에 담기` 진입이 미로그인이면 로그인으로 보낸다 (#620 · D4-1) */
  authed: boolean
  /**
   * 판정의 기준이 될 반려견이 있는가 — 골든타임 카드의 등록 안내를 가른다
   * ([#777](https://github.com/8llow8llowMe/hondigagae/issues/777) · D8-9).
   *
   * **`authed` 와 별개다.** 로그인했는데 0마리인 사용자도 사람 기준 판정을 본다 —
   * 두 갈래가 같은 안내를 받고 링크만 갈린다.
   */
  petRegistered: boolean
  /**
   * `코스 목록으로` 가 돌아갈 주소 ([#783](https://github.com/8llow8llowMe/hondigagae/issues/783)).
   *
   * **상세 URL 에는 필터가 없다.** 목록 행이 조건을 쿼리로 실어 보내고 라우트가 그것을
   * 읽어 여기로 넘긴다 — 없으면 목록 첫 화면으로 간다.
   *
   * **오류·404 에서는 쓰지 않는다.** 코스를 못 받은 자리라 사용자가 어느 목록에서 왔는지
   * 화면이 주장할 근거가 없다 (`BackToList` 는 이 값을 받지 않는다). 로딩은 성공과 같이
   * 쓴다 — 같은 링크가 누른 시점에 따라 다른 곳으로 가면 안 된다.
   *
   * **로그인 왕복은 아직 이 값을 잃는다.** `WalkCourseAddAction` 의 `toLoginHref` 가 경로만
   * 싣는다 — 미로그인 사용자가 `일정에 담기` 로 로그인하고 돌아오면 쿼리가 사라진다.
   * 이 이슈의 범위 밖이라 고치지 않고 적어 둔다.
   */
  backHref?: string | undefined
}

/**
 * 코스 상세 본문 — **표시 전용이다.** 조회 상태는 `WalkCourseDetailView` 가 props 로
 * 변환해 넘긴다 (`docs/testing-guide.md` §1).
 *
 * **1024 이상에서만, 그것도 히어로가 있을 때만 2열이다**
 * ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)). D1 은 *"우측에 둘 것이
 * 없다 — 좌표가 25/29 null 이라"* 며 데스크톱에서도 1열로 뒀는데, 그 판단은 **히어로가
 * 있는 4개**에서 틀렸다: 16:9 히어로가 본문 폭을 다 먹어 이 화면의 차별 정보(골든타임)가
 * 접힘선 아래로 밀렸다(1280 실측 1400px = 뷰포트의 155%). 히어로와 좌표는 **같은 4개**에만
 * 있으므로, 2열이 서는 날은 우측에 세울 것이 실제로 있는 날이다. 나머지 25개는 그대로 1열이다.
 *
 * **머리는 카드가 아니다** (`DESIGN.md` §0 카드 판정 3문 — 페이지 머리(h1)는 카드가 아니다).
 * 카드가 되는 것은 골든타임 자리 하나뿐이고, **좌표가 없어도 그 카드는 남는다** (#730).
 */
export function WalkCourseDetailSection({
  course,
  loading,
  errorStatus,
  errorMessage,
  onRetry,
  walkTimes,
  walkTimesLoading,
  onWalkTimesRetry,
  nearbyPlaces,
  nearbyPlacesLoading,
  authed,
  petRegistered,
  backHref = '/olle',
}: WalkCourseDetailSectionProps) {
  if (loading) {
    return (
      <DetailShell heading={messages.walkCourse.pageTitle}>
        <div className={INSET_CLASS.card}>
          {/*
            **로딩도 `backHref` 를 쓴다** (#783). 오류·404 를 제외한 근거는 *"어느 목록에서
            왔는지 주장할 근거가 없다"* 인데, 로딩에는 그 근거가 성립하지 않는다 — 라우트가
            이미 값을 갖고 있다. 같은 링크가 **누른 시점에 따라 다른 곳으로 가지 않게** 한다.
          */}
          <BackLink href={backHref} label={messages.walkCourse.backToList} />
        </div>
        <DetailSkeleton />
      </DetailShell>
    )
  }

  if (errorStatus !== null) {
    const kind = classify(errorStatus)

    /*
      **404 에 재시도 버튼을 달지 않는다.** 근거가 세 겹이다 (공통명세 S5):
      규칙(`frontend/CLAUDE.md`) · 계약(`WalkCourseErrorCode.NOT_FOUND_WALK_COURSE` 가
      `HttpStatus.NOT_FOUND` 로 못박혀 있고 단건 조회에 부수 조건이 없다) · 실측(같은 id 로
      두 번 물어 같은 404 를 받았다). **재시도는 사용자의 시간을 쓰고 아무것도 바꾸지 못한다.**

      대신 서버 `resultMessage` 를 그대로 노출하고 **다음 행동**(코스 목록으로)을 준다.
      `EmptyState` 는 `onRetry` 를 받지 않아 재시도 경로가 타입에서 막힌다.
    */
    if (kind === 'not-found') {
      return (
        <DetailShell heading={messages.walkCourse.detailNotFoundTitle}>
          <EmptyState
            inset="card"
            title={toMessage(errorMessage, messages.walkCourse.detailNotFoundTitle)}
            description={messages.walkCourse.pageDescription}
            action={<BackToList />}
          />
        </DetailShell>
      )
    }

    /*
      **400 도 재시도가 아니다** (`WALKCOURSE_113` — 숫자가 아닌 id). 주소가 틀린 것이라
      같은 요청은 같은 400 이다. `PlaceDetailInvalidId`(#496)와 같은 처치를 한다 —
      `ErrorState` 가 아니라 `EmptyState` + 다음 행동이다. 명세 D5 는 `ErrorState`
      (재시도 없음)라고 적었지만, `ErrorState.onRetry` 는 필수 prop 이라 그 조합이
      타입으로 성립하지 않는다. 장소 상세가 같은 이유로 같은 자리를 이렇게 그린다.
    */
    if (kind === 'validation') {
      return <WalkCourseDetailInvalidId errorMessage={errorMessage} />
    }

    // 5xx · 무응답 — 재시도를 제공한다
    return (
      <DetailShell heading={messages.walkCourse.errorTitle}>
        <ErrorState
          inset="card"
          title={messages.walkCourse.errorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
        />
        <div className={INSET_CLASS.card}>
          <BackToList />
        </div>
      </DetailShell>
    )
  }

  if (course === null) return null

  const hero = imageSrc(course.firstImage)

  /*
    **캡을 갈래에 따라 고른다** ([#781](https://github.com/8llow8llowMe/hondigagae/issues/781)).

    히어로가 없는 25/29 는 1440 을 그대로 채워 `거리 15.1km` 와 `소요시간 4~5시간` 이
    689px 떨어져 있었다 — 한 묶음으로 읽혀야 하는 값 둘이 눈으로 이을 수 없는 거리였다.
    글이 주인공인 단일 열이라 읽는 폭(760)에서 멈춘다.

    **히어로가 있는 4개는 캡하지 않는다.** `lg:grid-cols-2` 로 이미 각 681px 이라 읽는 폭
    안이고, 760 을 걸면 2열이 무너진다.

    **두 클래스를 겹쳐 달지 않는다** — 같은 특정도라 순서로 이기는 모양이 되어 스타일시트
    순서가 바뀌면 조용히 뒤집힌다 (`globals.css` 의 `.reading-container` 주석).
  */
  return (
    <SurfaceStack className={hero === null ? 'reading-container' : 'content-container'}>
      <Breadcrumb href={backHref} course={course} />

      {/*
        **1024 이상에서 히어로가 좌측 열로 간다** (#730). 그 아래에서는 예전처럼 한 줄로
        쌓인다 — `gap` 값이 `SurfaceStack` 의 것과 같아(모바일 8 · 데스크톱 24) 열이
        갈리든 말든 카드 사이 리듬이 바뀌지 않는다 (DESIGN.md §0).

        **히어로가 없으면 두 열로 가르지 않는다.** 그 갈래가 25/29 이고, 빈 좌측 열을
        만들면 이 이슈가 고치려는 바로 그 증상(절반이 빈 화면)을 데스크톱에서 다시 만든다.
        `firstImage` 와 좌표는 **같은 4개**에만 있어(`types/walk-course.ts`) 두 열이 서는
        날은 골든타임도 실제로 서는 날이다.
      */}
      <div
        className={cn(
          'flex flex-col gap-2 md:gap-6',
          hero !== null && 'lg:grid lg:grid-cols-2 lg:items-start',
        )}
      >
        {hero !== null && <WalkCourseHero image={hero} />}

        {/*
          **우측 묶음이 두 행을 걸친다.** 좌측은 사진(1행)과 지도(2행)로 쌓이고 우측은 그
          둘에 나란히 선다 — `lg:row-span-2` 가 없으면 지도가 우측 묶음 **아래** 높이에서
          시작해 사진과 사이가 벌어진다.
        */}
        <div className="flex flex-col gap-2 md:gap-6 lg:row-span-2">
          <WalkCourseSummaryHeader course={course} />

          <WalkCourseGoldenSlot
            course={course}
            walkTimes={walkTimes}
            loading={walkTimesLoading}
            onRetry={onWalkTimesRetry}
            authed={authed}
            petRegistered={petRegistered}
          />

          {/*
            **담기는 골든타임 바로 다음이다** — 우측 묶음 **안**이다.

            처음에는 그리드 자식으로 두고 `lg:col-start-2` 만 줬다. 우측 열에 가긴 했지만
            우측 묶음이 1·2행을 걸치고 있어 **3행**으로 밀렸고, 그 3행은 좌측(사진 + 지도)이
            끝나는 높이에서 시작한다 — 골든타임 카드와 버튼 사이에 **빈칸 한 덩어리**가
            생겼다. 자동 배치에 맡기면 우측이 먼저 끝날수록 그 틈이 커진다.

            그래서 자리를 그리드가 아니라 **소속**으로 정한다: `일정에 담기` 는 "오늘 걸을
            만한가" 를 읽고 내리는 결정이라, 그 답을 주는 골든타임에 붙는 것이 맞다.

            **대가**: 1024 미만에서 담기가 시작점 지도보다 **앞**에 온다. 주 행동이
            보조 자료보다 먼저 오는 것이라 받아들인다.

            진입은 상세에만 둔다 — 목록 행은 이미 전체가 링크다 (`올레담기-세부명세.md` D8-1).
          */}
          <div className={INSET_CLASS.card}>
            <WalkCourseAddAction course={course} authed={authed} />
          </div>
        </div>

        {/*
          **시작점 지도는 마크업 순서상 마지막이다** ([#782](https://github.com/8llow8llowMe/hondigagae/issues/782)).

          읽는 순서가 그래야 하기 때문이다 — 사진 → 어느 코스인지 → 오늘 걸을 만한지 →
          **그래서 어디서 출발하나.** 1024 미만에서는 이 순서 그대로 쌓이고, 1024 이상에서는
          그리드 자동 배치가 이것을 **좌측 열 2행**(사진 아래)으로 보낸다.

          처음에는 사진과 한 `div` 로 묶었다. 데스크톱 그림은 같았지만 **모바일에서 지도가
          코스 이름보다 먼저 나왔다** — 어느 코스인지 모르는 채로 지도를 먼저 보게 된다.

          **좌측 열에 둔 이유**: 사진 하나만 두었더니 1024 실측에서 좌측이 266px 에서 끝나고
          우측이 863px 까지 이어져 **사진 아래 597px 이 죽었고**, 그 공백 아래에
          `일정에 담기` 만 떠 있어 버튼이 어디에도 속하지 않아 보였다.

          **좌표가 없으면 스스로 사라진다.** 여기서 `hasCoordinates` 를 다시 묻지 않는다 —
          같은 질문을 두 곳에서 하면 한쪽만 고쳐진다 (`lib/walk-course/coordinates.ts`).
        */}
        <WalkCourseStartMap course={course} />
      </div>

      {/*
        **나가는 길이다** ([#826](https://github.com/8llow8llowMe/hondigagae/issues/826)).

        **그리드 밖 전폭이다.** 안에 넣으면 좌측 열(사진·시작점 지도)에 딸린 보조 자료로
        읽히는데, 이것은 이 페이지를 다 읽은 뒤의 **다음 행동** 제안이다. 모바일에서는
        어차피 시작점 지도 바로 다음에 온다.

        **출처 각주보다는 위다.** 각주는 문서 끝이고, 그 아래에 링크를 두면 페이지가 끝난
        뒤에 다시 시작하는 모양이 된다.
      */}
      <WalkCourseNearbyPlaces places={nearbyPlaces} loading={nearbyPlacesLoading} />

      {/*
        **출처는 CTA 아래다** (#730). 바로 위에 있던 동안에는 버튼에 딸린 설명처럼 읽혔다 —
        `제주올레 · 2025-04-28 기준` 은 이 **페이지 데이터**의 출처이지 그 버튼이 무엇을
        하는지에 대한 말이 아니다. 각주는 문서 끝에 선다.
      */}
      <WalkCourseSourceLine course={course} />
    </SurfaceStack>
  )
}

/**
 * 주소의 `walkCourseId` 형식이 틀린 경우 (D0-1).
 *
 * **서버 컴포넌트가 물어보기 전에 여기로 보낸다** — `@PathVariable long` 이라 답이 400 으로
 * 정해져 있다. 화면 안에서 같은 400 을 잡았을 때와 **같은 말을 해야** 하므로 경계 파일이
 * 아니라 같은 컴포넌트를 쓴다 (#480 · #496 의 축).
 */
export function WalkCourseDetailInvalidId({ errorMessage }: { errorMessage?: unknown }) {
  return (
    <DetailShell heading={messages.common.validationErrorTitle}>
      <EmptyState
        inset="card"
        title={messages.common.validationErrorTitle}
        description={toMessage(errorMessage, messages.walkCourse.pageDescription)}
        action={<BackToList />}
      />
    </DetailShell>
  )
}

function BackToList() {
  return <BackLink href="/olle" label={messages.walkCourse.backToList} />
}

/**
 * 돌아가기 + `› {코스}` — 장소 상세 `Breadcrumb` 과 같은 자리다.
 *
 * **카드가 아니다** (`DESIGN.md` §0). 머리를 카드로 올리면서 이 줄도 같이 올릴까 물었는데,
 * 그러면 **내비게이션이 본문과 같은 무게**가 된다 — §0 이 "전부 카드면 전부 같은 무게가
 * 되어 위계가 다시 사라진다" 로 막아 둔 것이 정확히 그것이다. 대신 링크 하나가 바닥 위에
 * 허공에 뜨지 않도록 `border-b` 한 줄을 준다 (홈 특보 스트립 · 장소 상세와 같은 모양).
 *
 * **크럼을 함께 두는 이유**: 돌아가기만 있으면 이 줄이 "무엇으로부터" 돌아가는지 말하지
 * 않는다. 크럼은 지금 어디인지를 말하고 돌아가기는 나가는 길이다 — 다른 일이다.
 *
 * `content-container` 를 쓰지 않는다 — 이 줄은 `SurfaceStack` 안이라 폭을 이미 물려받는다.
 */
function Breadcrumb({ href, course }: { href: string; course: WalkCourseDetail }) {
  return (
    <nav
      aria-label={messages.walkCourse.detailBreadcrumbLabel}
      className={cn('border-border flex items-center gap-1 border-b pb-2', INSET_CLASS.card)}
    >
      <BackLink href={href} label={messages.walkCourse.backToList} />
      <ChevronRightIcon size={16} aria-hidden className="text-fg-subtle shrink-0" />
      <span className="text-body-2 text-fg-muted min-w-0 truncate font-medium">
        {course.courseLabel} {course.name}
      </span>
    </nav>
  )
}

/**
 * 상태 화면의 껍데기. **`h1` 을 `sr-only` 로 남긴다** — 성공 화면의 `h1` 은 `courseLabel`
 * 인데 여기서는 그 값을 모른다. 제목이 아예 없으면 문서 개요가 비고, 보이는 제목을
 * 지어내면 없는 코스 이름을 말하게 된다.
 *
 * **돌아가기를 껍데기가 그리지 않는다.** 빈·오류 상태는 그것을 `action` 으로 이미 갖고
 * 있어, 여기서도 그리면 같은 이름의 링크가 한 화면에 둘이 된다 — 보조기기에서 목적지가
 * 둘로 들린다. 스켈레톤만 자기 것을 따로 세운다.
 *
 * **읽는 폭에서 멈춘다** ([#781](https://github.com/8llow8llowMe/hondigagae/issues/781)).
 * 성공 화면이 갈래에 따라 캡을 고르는 것과 달리 여기서는 고를 수 없다 — 로딩 시점에는
 * 히어로가 있는지 모르고, 오류·404 에는 애초에 히어로가 없다. **25/29 가 히어로 없는
 * 갈래이고 오류 문구는 어느 갈래에서도 짧으므로 760 이 맞는 쪽이다.**
 *
 * 대가를 적어 둔다: 히어로가 있는 4개는 로딩(760) → 성공(1434)에서 폭이 한 번 넓어진다.
 * 서버 프리페치가 성공하면 보이지 않고(그 경로가 기본이다), 실패했을 때만 드러난다.
 */
function DetailShell({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <SurfaceStack className="reading-container">
      <h1 className="sr-only">{heading}</h1>
      {children}
    </SurfaceStack>
  )
}

/** 머리 + 정보 스켈레톤 (D5). 실제 머리와 같은 골격이라 응답이 와도 줄이 튀지 않는다 */
function DetailSkeleton() {
  return (
    <div className={cn('flex flex-col gap-3', INSET_CLASS.card)} aria-busy>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-6 w-2/3" />
      <div className="mt-2 flex gap-8">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Skeleton className="h-5 w-1/2" />
    </div>
  )
}
