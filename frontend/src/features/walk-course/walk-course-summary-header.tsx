import Image from 'next/image'

import { Surface } from '@/components/surface'
import { formatCourseDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * 코스 대표 이미지 — **머리에서 갈라 나왔다** ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
 *
 * **이미지는 있을 때만 붙는다** (D5). 실측 29개 중 25개가 이 모양이라, 자리를 만들어 두면
 * 대다수 화면의 첫 화면이 회색 사각형으로 시작한다. `firstImage` 가 있는 4개는 **좌표가
 * 있는 바로 그 4개**다 (`types/walk-course.ts` — 둘 다 같은 TourAPI 매칭에서 온다).
 *
 * **전폭 미디어는 카드가 아니다** (`DESIGN.md` §0) — `Surface` 로 감싸지 않는다.
 * `alt` 는 빈 문자열이다: 바로 아래 이름표가 글자로 있다.
 *
 * **왜 `<header>` 밖으로 나왔나.** 1024 이상에서 이미지를 **좌측 열**에 두고 우측에
 * 지표·골든타임을 세우려면(#730) 이미지가 머리 텍스트와 **형제**여야 한다. 안에 있으면
 * 히어로가 16:9 로 본문 폭 전체를 먹어 이 화면의 차별 정보(골든타임)가 접힘선 아래로
 * 밀린다 — 1280 실측 1400px, 뷰포트의 155% 였다.
 *
 * **16:9 는 그 상한이기도 하다.** 390 에서 ≈220px 이라 머리 텍스트와 함께 접힘선 안에 든다.
 */
export function WalkCourseHero({ image }: { image: string }) {
  return (
    <div className="bg-band relative aspect-video w-full max-w-full overflow-hidden md:rounded-lg">
      <Image
        src={image}
        alt=""
        fill
        /* 1024 이상은 두 열이라 히어로가 콘텐츠 폭의 절반이다 */
        sizes="(min-width: 1024px) 50vw, (min-width: 768px) 720px, 100vw"
        className="object-cover"
        priority
      />
    </div>
  )
}

/** 머리 카드가 `aria-labelledby` 로 가리키는 `h1` 의 id — 장소 상세 `DETAIL_HEADING_ID` 와 같은 축 */
export const WALK_COURSE_HEADING_ID = 'walk-course-detail-heading'

/**
 * 코스 상세의 머리 — **한 장의 카드다.**
 *
 * ### 예전에는 카드가 아니었다
 *
 * *"페이지 머리(h1)는 카드가 아니다"*(§0 예외 목록)를 근거로 L0 바닥 위에 직접 놓았다.
 * 그런데 **이 화면은 그 아래 전부가 흰 카드다** (골든타임 · 시작점 지도). 그래서 화면의
 * 이름인 제목만 회색 바닥에 얹혀, **페이지에서 가장 중요한 블록이 가장 덜 중요해 보였다.**
 * 히어로가 있는 갈래에서는 더 심했다 — 좌측은 테두리 있는 사진, 우측은 맨 글씨라 첫 행만
 * 안 끝난 것처럼 보였다.
 *
 * **§0 을 뒤집은 것이 아니라 판정 3문을 다시 물은 것이다.** ① 자기 제목이 있는가 — `h1` 이
 * 여기 있다. ② 혼자 떼어놔도 말이 되는가 — 이름표·구간명·거리·소요시간·시종점은 그것만으로
 * "이 코스가 무엇인가" 를 답한다. ③ 담는 항목이 둘 이상인가 — 이름 블록 · `<dl>` · 시종점
 * 셋이다. 셋 다 "예" 다. §0 의 예외는 **맨 `h1` 한 줄**을 말한다.
 *
 * **장소 상세가 같은 증상에 같은 답을 이미 냈다** ([#531](https://github.com/8llow8llowMe/hondigagae/issues/531)) —
 * `place-detail-section.tsx` 의 갤러리+제목 카드 주석이 정본이다.
 *
 * **카드 이름은 `titleId` 로 `h1` 을 가리킨다** — `aria-label` 로 같은 문자열을 다시 적으면
 * 두 곳이 갈린다 (`Surface` 머리주석).
 *
 * **히어로는 이 카드 안에 넣지 않는다.** 1024 이상에서 히어로는 **좌측 열**이고 이 카드는
 * 우측 열이라(#730), 한 카드로 묶으면 그 2열이 무너진다 — 장소 상세와 갈리는 지점이 여기
 * 하나다. `WalkCourseHero` 는 계속 형제로 선다 (전폭 미디어라 그쪽은 카드가 아니다).
 *
 * **`h1` 은 `courseLabel` 이다** (D6). 구간명은 그 아래 `<p>` — `1코스 시흥-광치기` 를
 * 한 `h1` 에 몰면 이름표와 구간명이 한 덩어리로 읽힌다.
 *
 * **훅을 쓰지 않는다** — node 환경에서 렌더해 단언할 수 있어야 한다
 * (`docs/testing-guide.md` §1).
 */
export function WalkCourseSummaryHeader({ course }: { course: WalkCourseDetail }) {
  return (
    <Surface titleId={WALK_COURSE_HEADING_ID}>
      {/*
        카드가 되면서 세로 여백을 여기서 준다 — `Surface` 본문은 패딩을 갖지 않는다
        (장소 상세 머리 카드와 같은 값: `py-4 md:py-5`).
      */}
      <header className={cn('flex flex-col gap-3 py-4 md:py-5', INSET_CLASS.card)}>
        <div className="flex flex-col gap-1">
          {/* `15코스 (B)` 의 괄호가 다음 줄로 떨어지지 않게 한 덩어리로 둔다 (D1) */}
          <h1
            id={WALK_COURSE_HEADING_ID}
            className="text-title-1 text-fg font-bold whitespace-nowrap"
          >
            {course.courseLabel}
          </h1>
          <p className="text-body-1 text-fg-muted break-keep">{course.name}</p>
        </div>

        {/*
         **핵심값 둘은 `<dl>` 이다** (D6). 라벨이 글자로 있어야 숫자만 읽히지 않는다.
         **단위는 라벨이 아니라 값에 붙는다** — `15.1km` 가 스크린리더에서도 단위와 함께 읽힌다.

         **고정 2열이다** ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
         예전에는 `flex-wrap` + `gap-x-8` 이라 열 폭이 **값의 길이를 따라갔다** — `19.0km`
         옆에 `소요시간` 라벨이 바로 붙어 서서 어느 라벨이 어느 값의 것인지 흐려졌고,
         코스마다 그 간격이 달라 목록에서 상세로 들어올 때마다 배치가 바뀌었다.
         `repeat(2, minmax(0,1fr))` 은 값이 길어져도 열이 밀리지 않는다.
         */}
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2">
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-fg-muted font-medium">
              {messages.walkCourse.distanceLabel}
            </dt>
            <dd className="text-title-2 text-fg font-semibold tabular-nums">
              {formatCourseDistance(course.distanceKm)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-fg-muted font-medium">
              {messages.walkCourse.durationLabel}
            </dt>
            {/*
              **원문 문자열이다** (`4~5시간`). 파싱하지 않는다 (공통명세 S3).
              **`tabular-nums` 는 원문에도 준다** — `4~5` 도 숫자다 (DESIGN.md §3-3 은
              "필요한 곳" 이 아니라 규칙이라고 적었다). 옆 칸 거리와 자릿수가 맞아야 한 줄로 읽힌다.
            */}
            <dd className="text-title-2 text-fg font-semibold tabular-nums">
              {course.durationText}
            </dd>
          </div>
        </dl>

        {/*
          **`startEndPoint` 를 갈라 쓰지 않는다** (D4-2). `제주민속촌주차장 입구-남원포구`
          처럼 공백과 하이픈이 섞여 있고 시설명 안에도 하이픈이 들어올 수 있어, 갈라
          재조립하면 잘못 갈리는 코스가 생긴다 — **원문 한 줄로 렌더한다.**
        */}
        <p className="flex flex-col gap-1">
          <span className="text-caption text-fg-muted font-medium">
            {messages.walkCourse.startEndLabel}
          </span>
          <span className="text-body-2 text-fg break-keep">{course.startEndPoint}</span>
        </p>
      </header>
    </Surface>
  )
}

/**
 * 출처 줄 — **`providerName` 과 `baseDate` 둘 다 서버 값이다.**
 *
 * **`baseDate` 를 `Date` 로 파싱하지 않는다** (D4-3). 계약이 문자열이고 `2025-04-28` 은
 * 자정 UTC 로 읽히면 KST 기준 하루 밀린다. 문자열 그대로 렌더하되 `<time>` 으로 시맨틱만 준다.
 */
export function WalkCourseSourceLine({ course }: { course: WalkCourseDetail }) {
  const [before = '', after = ''] = messages.walkCourse.source
    .replace('{provider}', course.providerName)
    .split('{date}')

  return (
    <p className={cn('text-caption text-fg-subtle break-keep', INSET_CLASS.card)}>
      {before}
      <time dateTime={course.baseDate}>{course.baseDate}</time>
      {after}
    </p>
  )
}
