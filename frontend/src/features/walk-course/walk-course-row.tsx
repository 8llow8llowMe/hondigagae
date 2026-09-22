import Image from 'next/image'
import Link from 'next/link'

import { formatCourseDistance } from '@/lib/format/distance'
import { imageSrc } from '@/lib/image/remote-host'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { walkCourseFilterHref } from '@/lib/url/walk-course-filters'
import { cn } from '@/lib/utils/cn'
import type { WalkCourseFilters, WalkCourseSummary } from '@/types/walk-course'

/**
 * 코스 목록의 그리드 — **카드 한 장이 한 항목이다** (#837).
 *
 * **`SurfaceList` 를 쓰지 않는다.** 저쪽은 항목 *사이*에 구분선을 긋는 L2 목록이고
 * (`[&>li+li]:border-t`), 카드는 자기 테두리를 두르므로 선이 겹친다. `columns` 도 `1 | 2`
 * 까지만 열려 있다 — 3열이 필요한 첫 화면이라 저쪽을 넓히면 **선 규약이 3열로 따라 넓어지는데
 * 그것을 쓰는 화면이 없다.** `ul`/`li` 시맨틱은 여기서도 그대로다.
 *
 * **열 수는 1 / 2(768+) / 3(1280+) 이다** (`코스목록-세부명세.md` D1-1). 표였을 때 1280+ 에서
 * 남던 빈 폭이 열 수로 해소된다.
 *
 * **스켈레톤과 같은 문자열을 쓴다** (#800). 로딩과 결과가 다른 골격이면 결과가 오는 순간
 * 레이아웃이 점프한다 — 한쪽만 고쳐지는 일을 막으려고 클래스를 여기 한 번만 적는다.
 */
export function WalkCourseCardGrid({
  inset = 'card',
  children,
  ...aria
}: {
  'aria-busy'?: boolean | undefined
  inset?: Inset
  children: React.ReactNode
}) {
  return (
    <ul
      {...aria}
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3',
        INSET_CLASS[inset],
      )}
    >
      {children}
    </ul>
  )
}

/**
 * 코스 한 장 — **사진 카드다** (#837).
 *
 * ### 텍스트 표에서 되돌아온 자리다 (`코스목록-세부명세.md` D1-1)
 *
 * 표를 고른 처음 근거는 *"29개 중 25개가 회색 플레이스홀더"* 였고, 재적재 뒤 **29개 전부가
 * 이미지를 갖는다**(2026-09-21 dev 실측). #767 은 그 전제가 무너진 뒤에도 *"고르는 축이
 * 거리·소요시간이라 표를 지킨다"* 로 한 번 더 표에 섰는데, 시안 6종을 실데이터로 그려 놓고
 * 보면 **비교 축은 카드 안에서도 그대로 산다** — 거리·소요시간이 카드마다 한 줄로 있고
 * 정렬 세그먼트(`거리 짧은 순`)와 기준 줄도 그대로다. 사진 29장을 버리는 대가가 더 컸다.
 *
 * 훑어 비교하는 일은 표가 낫다는 #767 의 지적은 **사실로 남는다.** 그 대가를 알고 고른
 * 것이고, 대신 정렬을 축의 기본 장치로 둔다.
 *
 * ### A4 — 번호 왼쪽, 구간명 오른쪽 한 줄
 *
 * 시안 A1(사진 위 배지) · A2(번호가 첫 줄) · A3(사진에 걸친 칩) 과 함께 보고 골랐다.
 * **사진 위에 아무것도 얹지 않는다** — 그래야 사진 밝기와 무관하게 대비가 유지되고,
 * `3코스 (A)` · `7-1코스` 같은 변칙 이름표가 배지 폭에 눌리지 않는다.
 *
 * **번호는 브랜드색 `font-extrabold` 로 앞세운다.** 크기는 구간명과 같은 `text-body-1` 이다 —
 * 시안은 16/15 였지만 앱의 타이포 토큰에는 15가 없고, 임의 px 를 새로 만드는 것보다 **색과
 * 굵기 두 축으로 가르는 편**이 토큰 체계를 지킨다. 크기가 같아도 **29개 전부 한 줄이다** —
 * 375 실측(2026-09-22): 제목 칸 309px · 최장
 * `7-1코스 서귀포버스터미널-제주올레여행자센터` 302px 로 여유 7px. **얇은 예산이라 이름이
 * 길어지면 다시 잰다.** 넘치더라도 `flex-wrap` 이 구간명을 통째로 내리므로 이름이 중간에서
 * 끊기지는 않는다.
 *
 * ### chevron 이 없다
 *
 * 표에서는 행이 링크라는 유일한 신호가 chevron 이었다 (#798). 카드는 **자기 테두리와 hover
 * 채움**이 그 말을 하므로 도장 열을 따로 두지 않는다 — 시안 A4 에도 없다.
 *
 * **hover 를 `<a>` 에 건다.** 표에서 `<li>` 의 `has-[a:hover]` 를 쓴 이유는 좌우 인셋이
 * `<li>` 의 패딩이라 `<a>` 에 걸면 강조가 카드 끝까지 닿지 않아서였다 (#798). 카드에서는
 * 인셋이 그리드 컨테이너로 올라가 **`<a>` 가 곧 카드 전체**다 — 누를 수 있는 자리와 칠해지는
 * 자리가 정확히 같아진다.
 *
 * **좌표 유무를 말하지 않는다** (D5-1). **시작·종점 좌표로 선을 그리지 않는다** — 응답에
 * 경로 좌표열이 없어 두 점을 이으면 실제 올레길과 다른 직선이 된다 (인계 명세 §2-3).
 */
export function WalkCourseRow({
  course,
  filters,
}: {
  course: WalkCourseSummary
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
    /*
      **`h-full` 이 한 행의 카드 높이를 맞춘다.** 지금은 29개가 전부 한 줄이지만(위 실측)
      이름이 길어져 두 줄이 되면 같은 행의 나머지가 짧아진다 — 늘어나는 것은 테두리 안쪽
      여백이라 글줄은 흔들리지 않는다. 사진이 없는 카드도 이 값으로 자리를 채운다.
    */
    <li className="h-full">
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

          거리·소요시간에 `aria-hidden` 을 붙이지 않는다 — 이름에는 없지만 카드 안의
          텍스트로는 읽혀야 한다.
        */
        aria-label={`${course.courseLabel} ${course.name}`}
        className={cn(
          // `min-h-11` 은 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 사진이 없는 카드가 여기 걸린다
          'border-border bg-bg block h-full min-h-11 overflow-hidden rounded-lg border transition-colors',
          'hover:bg-band',
          'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        )}
      >
        {/*
          사진 — **16:10 이다.** 세로로 긴 비율이면 3열에서 카드가 화면을 넘고, 정사각이면
          풍경 사진(올레는 전부 바다·길·들판)이 좌우로 잘린다.

          **여전히 있을 때만 만든다.** 재적재 뒤 29개 전부가 이미지를 갖지만(2026-09-21 dev
          실측) 그것은 계약이 아니라 데이터다 — 원천(TourAPI 매칭)이 다시 비면 없는 카드가
          돌아온다. 그때는 **회색 판을 세우지 않고 글자만 남긴다**(D5). `h-full` 이 높이를
          맞추므로 같은 행이 어긋나지 않는다.

          `alt` 는 빈 문자열이다 — 바로 아래에 이름표가 글자로 있다 (D6).
        */}
        {thumbnail !== null && (
          <div className="bg-band relative aspect-16/10">
            <Image
              src={thumbnail}
              alt=""
              fill
              /* 열 수와 같이 간다 — 1280+ 3열 · 768+ 2열 · 그 아래 1열 */
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <div className="px-4 pt-3 pb-4">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {/* `3코스 (A)` 의 괄호가 다음 줄로 떨어지지 않게 한 덩어리로 둔다 (D1) */}
            <span className="text-body-1 text-brand-600 font-extrabold whitespace-nowrap">
              {course.courseLabel}
            </span>
            <span className="text-body-1 text-fg min-w-0 font-medium break-keep">
              {course.name}
            </span>
          </p>

          {/* 고르는 축 — 표에서 두 열이었던 값이 카드 안 한 줄로 온다 */}
          <p className="text-body-2 text-fg-muted mt-1.5 tabular-nums">
            {distance} · {course.durationText}
          </p>

          {/*
            **원문 그대로 렌더한다** (D4-4). `제주민속촌주차장 입구-남원포구` 처럼 공백과
            하이픈이 섞여 있고 시설명 안에도 하이픈이 들어올 수 있어, 갈라 재조립하면
            잘못 갈리는 코스가 생긴다. 카드 폭이 좁아 `truncate` 로 한 줄을 지키되 — 자르는
            것은 표시일 뿐이라 D4-4 와 충돌하지 않는다 — `title` 로 전체를 남긴다.
          */}
          <p title={course.startEndPoint} className="text-caption text-fg-subtle mt-1.5 truncate">
            {course.startEndPoint}
          </p>
        </div>
      </Link>
    </li>
  )
}
