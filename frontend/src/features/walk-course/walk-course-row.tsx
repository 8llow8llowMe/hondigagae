import Image from 'next/image'
import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { formatCourseDistance } from '@/lib/format/distance'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { walkCourseFilterHref } from '@/lib/url/walk-course-filters'
import { cn } from '@/lib/utils/cn'
import type { WalkCourseFilters, WalkCourseSummary } from '@/types/walk-course'

/**
 * 코스 한 줄 — **L1 카드 안의 L2 항목이다** (`DESIGN.md §0`).
 *
 * ### 사진 카드 그리드가 아니라 텍스트 행이다 (`코스목록-세부명세.md` D1-1)
 *
 * **처음 근거는 "29개 중 25개가 회색 플레이스홀더" 였고, 그 근거는 사라졌다** — 재적재 뒤
 * 29개 전부가 이미지를 갖는다(2026-09-21). **그래도 텍스트 행이다.** 코스를 고르는 축은
 * **거리 · 소요시간**이고 정렬(`거리 짧은 순`)·열 머리·기준 줄이 전부 그 축 위에 서 있다
 * (#797 · #811 · #818 · #821). 사진 그리드는 그 비교를 할 수 없다.
 *
 * 사진은 축이 아니라 **식별자**로 쓴다 — 행의 첫 칸(아래 #767 절).
 *
 * **자기 테두리를 두르지 않는다** — 구분선은 `SurfaceList` 가 항목 사이에만 긋는다.
 *
 * **좌표 유무를 말하지 않는다** (D5-1). 좌표는 *골든타임을 이어 볼 수 있는가*만 정하는데,
 * 25행에 "날씨 정보 없음" 배지를 달면 코스를 고르는 축(거리·소요시간)과 무관한 사실이
 * 화면의 4/5를 덮는다. 그 사실은 필요해지는 자리 — 코스 상세 — 에서 한 줄로 말한다.
 *
 * ### 썸네일은 첫 칸이다 — #734 를 되돌린 자리다 (#767)
 *
 * **#734 는 썸네일을 텍스트 뒤로 보냈다.** 근거는 *"맨 앞에 두면 이미지가 있는 행만 제목이
 * 76~92px 밀린다"* 였고, 그 걱정은 **29개 중 25개가 이미지가 없던 분포에서만** 성립했다.
 * 재적재 뒤 **29개 전부가 이미지를 갖는다**(2026-09-21 dev 실호출) — 미는 행이 따로 없다.
 *
 * 뒤에 두는 대가가 이제 드러난다. 1280 실측에서 **시종점 글자 끝(x=656)과 썸네일(x=1149)
 * 사이가 493px** 이라, 29행 전부에 생긴 사진이 행 내용에서 떨어져 나와 chevron 옆 도장
 * 열로 읽혔다. **사진은 그 행이 무엇인가를 말하는 식별자다** — 올레 코스는 이름
 * (`시흥-광치기`·`광치기-온평`)만으로 서로 구분되지 않아 더 그렇다. 이름 옆에 세운다.
 *
 * `PlaceRow` 와 같은 배치가 된다. 다만 **없는 행에 타일을 남기지 않는 것은 그대로다** —
 * 저쪽은 소수가 비어 행 높이가 흔들리는 것이 문제이고, 여기는 그리드 트랙이 폭을 잡아
 * 준다(`app/globals.css`).
 *
 * ### 1024 부터는 6칸 그리드다 (#734 · #797)
 *
 * `lg:`(1024) 부터 이 링크가 `.walk-course-row-grid`(`app/globals.css`)로 그리드가 된다 —
 * **썸네일** · 코스 · 거리 · 소요시간 · 시종점 · chevron 여섯 칸 (#767 에서 썸네일이 맨
 * 앞으로 왔다). **각 칸이 `lg:col-start-N` 으로 자기 자리를 못박는다** — 플렉스였다면
 * 썸네일이 없는 행에서 뒤 칸들이 당겨져 칸마다 폭이 달라졌겠지만, 그리드 트랙은 자식
 * 유무와 무관하게 항상 같은 폭이라 썸네일 없는 행도 그 칸만 비고 코스·시종점·chevron 은
 * 그대로 선다.
 *
 * 1024 미만(모바일·태블릿)은 `lg:hidden` 으로 감춘 텍스트 블록 안에서 거리·소요시간·
 * 시종점을 이어 말한다 — `PlanRow` 의 상태 배지가 모바일/데스크톱에서 위치만 바꾸는 것과
 * 같은 자리에 같은 값을 두 번 두는 패턴이다. 열 머리는 `WalkCourseColumnHead` 가 그린다.
 */
export function WalkCourseRow({
  course,
  inset = 'card',
  filters,
}: {
  course: WalkCourseSummary
  inset?: Inset
  /**
   * 지금 보고 있는 목록 조건 ([#783](https://github.com/8llow8llowMe/hondigagae/issues/783)).
   *
   * **상세 URL 에는 필터가 없어 상세 혼자서는 복원할 근거가 없다.** 목록이 조건을 링크에
   * 실어 보내야 `코스 목록으로` 가 같은 목록으로 돌아간다. 없으면 쿼리 없이 간다.
   */
  filters?: WalkCourseFilters | undefined
}) {
  const thumbnail = imageSrc(course.firstImage)
  const distance = formatCourseDistance(course.distanceKm)

  return (
    <li
      /*
        **누를 수 있다는 신호** ([#798](https://github.com/8llow8llowMe/hondigagae/issues/798)).
        29행이 전부 링크인데 마우스 신호가 chevron 하나뿐이었다.

        **채움을 `<li>` 에 건다.** 인셋이 `<li>` 의 좌우 패딩이라 `<a>` 에 걸면 강조가
        카드 끝까지 닿지 않고 행 가운데 띠로 뜬다. 채움(`--band`)은 L2 의 채널이고
        (DESIGN.md §0) 테두리는 쓸 수 없다 — 목록이 이미 `border-t` 로 행을 가른다.

        **`<li>` hover 가 아니라 `has-[a:hover]` 다.** `<li>` 기준이면 링크 밖 여백에서도
        칠해지는데 거기는 눌러도 아무 일이 없다 — 강조는 "여기를 누를 수 있다" 는 말이라
        누를 수 없는 자리에 두면 거짓이 된다.

        **포커스 링을 대신하지 않는다.** 키보드는 `<a>` 의 `focus-visible` 링이 맡는다.
      */
      className={cn('has-[a:hover]:bg-band transition-colors', INSET_CLASS[inset])}
    >
      <Link
        /*
          **조립을 `walkCourseFilterHref` 에 맡긴다** (#783). 조건이 바뀐 뒤의 목록 주소를
          만드는 그 함수와 같은 규칙이라, 기본값 생략 규칙이 한쪽에서만 바뀌지 않는다.
        */
        href={
          filters === undefined
            ? `/olle/${course.walkCourseId}`
            : walkCourseFilterHref(`/olle/${course.walkCourseId}`, filters)
        }
        /*
          **접근 이름은 `{courseLabel} {name}` 이다** (D6). 이름표만이면 `1코스` 가 29개라
          구분되지 않고, 구간명만이면 사용자가 아는 번호가 사라진다.

          거리·소요시간에 `aria-hidden` 을 붙이지 않는다 — 이름에는 없지만 행 안의
          텍스트로는 읽혀야 한다.
        */
        aria-label={`${course.courseLabel} ${course.name}`}
        className={cn(
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
          'focus-visible:ring-brand-500 flex min-h-11 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:py-4',
          /*
            **1024 부터 6칸 표다** (#797). 트랙은 `.walk-course-row-grid` 가 정한다 —
            코스 열을 좁히자 1024 에도 6칸이 들어가, 폭마다 칸 수가 갈리지 않는다.

            **`lg:min-h-18`(72px) 이 행 리듬을 고정한다** — 표 안 썸네일 40 + `lg:py-4`
            16×2 에서 나온 값이다. 셋 중 하나를 바꾸면 나머지도 같이 본다. 썸네일이 있는 행만 높이가 두
            배로 튀던 것을 막는다 (1440 실측 `56 · 57 · 113 …`). 이름이 두 줄로 감기는
            한 행(`7-1코스 …제주올레여행자센터`, 301px)만 80px 이 되는데 8px 차이라
            훑는 눈에 잡히지 않는다.
          */
          'walk-course-row-grid lg:grid lg:min-h-18 lg:items-center lg:gap-5 lg:py-4',
        )}
      >
        {/*
          썸네일 — **첫 칸이다** ([#767](https://github.com/8llow8llowMe/hondigagae/issues/767)).
          사진은 그 행이 무엇인가를 말하는 식별자라 이름 옆에 선다 (`PlaceRow` 와 같은 배치).

          **여전히 있을 때만 만든다.** 재적재 뒤 29개 전부가 이미지를 갖지만(2026-09-21 dev
          실측) 그것은 계약이 아니라 데이터다 — 원천(TourAPI 매칭)이 다시 비면 없는 행이
          돌아온다. `lg:col-start-1` 로 그리드 자리를 못박아, 이 칸이 없어도 코스(2)·
          시종점(5)·chevron(6) 은 밀리지 않는다.

          **표 안에서는 40px 로 줄인다** (#797, `lg:size-10`). 80px 이면 그 행만 높이가 두
          배가 되어 세로 리듬이 깨진다 — 1024 미만 카드형 목록에서는 썸네일이 행의
          주인공이라 예전 크기(64/80)를 그대로 둔다.

          `alt` 는 빈 문자열이다 — 바로 옆(1024 미만)이나 같은 행(1024 이상)에 이름표가
          글자로 있다 (D6).
        */}
        {thumbnail !== null && (
          <div className="bg-band relative size-16 shrink-0 overflow-hidden rounded-md md:size-20 lg:col-start-1 lg:size-10">
            <Image
              src={thumbnail}
              alt=""
              fill
              /*
                **박스 크기와 같이 간다** (#797). `lg:size-10` 으로 줄였는데 여기가 80px 로
                남아 있으면 1024 이상에서 필요한 것의 2배(DPR 2 면 면적 4배) 소스를 받는다.
                예전 `1280px`·`768px` 두 절은 값이 같아 앞 절이 무의미했다.
              */
              sizes="(min-width: 1024px) 40px, (min-width: 768px) 80px, 64px"
              className="object-cover"
            />
          </div>
        )}

        {/* 코스 열 — 썸네일 다음이다. 트랙이 고정이라 썸네일 유무와 무관하게 위치가 같다 */}
        <div className="min-w-0 flex-1 lg:col-start-2 lg:flex-none">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {/* `3코스 (A)` 의 괄호가 다음 줄로 떨어지지 않게 한 덩어리로 둔다 (D1) */}
            <span className="text-body-1 text-fg font-semibold whitespace-nowrap">
              {course.courseLabel}
            </span>
            <span className="text-body-1 text-fg min-w-0 font-medium break-keep">
              {course.name}
            </span>
          </p>

          {/*
            1024 미만 전용 — 거리·소요시간·시종점을 이 블록 안에서 이어 말한다.
            1024 이상은 셋 다 각자 자기 열로 나가므로 여기서는 감춘다 (`lg:hidden`).
          */}
          <p className="text-body-2 text-fg-muted mt-1 tabular-nums lg:hidden">
            {distance} · {course.durationText}
          </p>
          {/*
            **원문 그대로 렌더한다** (D4-4). `제주민속촌주차장 입구-남원포구` 처럼 공백과
            하이픈이 섞여 있고 시설명 안에도 하이픈이 들어올 수 있어, 갈라 재조립하면
            잘못 갈리는 코스가 생긴다.
          */}
          <p className="text-caption text-fg-subtle mt-1 break-keep lg:hidden">
            {course.startEndPoint}
          </p>
        </div>

        {/* 거리 열 — 1024 이상 전용. 숫자라 오른쪽 정렬 + tabular-nums */}
        <p className="text-body-2 text-fg-muted hidden text-right tabular-nums lg:col-start-3 lg:block">
          {distance}
        </p>

        {/* 소요시간 열 — 1024 이상 전용 */}
        <p className="text-body-2 text-fg-muted hidden text-right tabular-nums lg:col-start-4 lg:block">
          {course.durationText}
        </p>

        {/*
          시종점 열 — 1024 이상 전용. 원문은 위와 같은 이유로 그대로 두되, 한 줄 표에서는
          `truncate` 로 한 줄을 지킨다 — 자르는 것은 표시일 뿐 원문을 갈라 재조립하지
          않으므로 D4-4 와 충돌하지 않는다. `title` 로 전체 문자열을 마우스 호버에 남긴다.
        */}
        <p
          title={course.startEndPoint}
          className="text-caption text-fg-subtle hidden min-w-0 truncate lg:col-start-5 lg:block"
        >
          {course.startEndPoint}
        </p>

        {/* 눌러서 이동한다는 것을 말하는 유일한 신호다 */}
        <ChevronRightIcon
          size={20}
          aria-hidden
          className="text-fg-subtle shrink-0 lg:col-start-6"
        />
      </Link>
    </li>
  )
}

/**
 * 데스크톱(1024~) 전용 열 머리 — 코스 · 거리 · 소요시간 · 시종점.
 *
 * **행(`WalkCourseRow`)과 같은 그리드 템플릿(`.walk-course-row-grid`)을 공유한다.**
 * 한쪽만 고치면 라벨이 실제 값 위에서 어긋난다.
 *
 * **`aria-hidden` 이다.** 보조기기에는 새 정보가 아니다 — 각 행의 접근 이름(이름표+구간명)과
 * 행 안의 거리·소요시간·시종점 텍스트가 이미 같은 값을 전부 말한다. 열 머리는 **시각적으로
 * 훑는 사용자**를 위한 장치다.
 *
 * 썸네일(1)·chevron(6) 칸은 라벨이 없다 — 사진 유무를 표로 예고하지 않는다(D5-1 과 같은
 * 이유로 "썸네일" 이라는 낱말도 보태지 않는다). 첫 칸이 빈 라벨인 것은 표에서 흔한 이미지
 * 열의 모양이고, 라벨을 붙이면 **고르는 축이 아닌 것이 축으로 보인다.**
 */
export function WalkCourseColumnHead({ inset = 'card' }: { inset?: Inset }) {
  return (
    <div
      aria-hidden
      className={cn(
        'walk-course-row-grid hidden lg:grid lg:items-center lg:gap-5 lg:pb-2',
        INSET_CLASS[inset],
      )}
    >
      <span className="text-caption text-fg-muted font-semibold lg:col-start-2">
        {messages.walkCourse.columnCourseLabel}
      </span>
      <span className="text-caption text-fg-muted text-right font-semibold lg:col-start-3">
        {messages.walkCourse.distanceLabel}
      </span>
      <span className="text-caption text-fg-muted text-right font-semibold lg:col-start-4">
        {messages.walkCourse.durationLabel}
      </span>
      <span className="text-caption text-fg-muted font-semibold lg:col-start-5">
        {messages.walkCourse.startEndLabel}
      </span>
    </div>
  )
}
