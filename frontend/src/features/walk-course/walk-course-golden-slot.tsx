import Link from 'next/link'

import { Surface } from '@/components/surface'
import { WalkTimesSection } from '@/features/insight/walk-times-section'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import { hasCoordinates, type WalkCourseCoordinates } from '@/lib/walk-course/coordinates'
import type { WalkTimesResponse } from '@/types/insight'

/**
 * 골든타임 자리 — **좌표 유무 분기 하나만** 갖는다 (`코스상세-세부명세.md` D3-1).
 *
 * ### 좌표가 없어도 자리와 제목은 남는다 ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730))
 *
 * D5-2 는 **자리를 만들지 않고 본문 한 줄만** 남기기로 했다. 근거는 *"기다리면 채워질 것처럼
 * 보이는 자리를 두지 않는다"* 였고 그 걱정 자체는 지금도 맞다 — 그래서 **스켈레톤도 비활성
 * 버튼도 여전히 두지 않는다.**
 *
 * **틀렸던 것은 그 갈래가 예외라는 전제다.** 실측 29개 중 25개(86%)가 이 모양이라
 * *"예외 갈래를 조용히 걷는다"* 가 실제로는 **화면의 기본형을 절반 빈 화면으로 만들었다**
 * (390 실측: 콘텐츠가 y≈850 에서 끝나고 문서 높이 1806). 정보가 아니라 **실패로 읽힌다.**
 *
 * 그래서 카드와 제목은 좌표 있는 갈래와 **같은 뼈대로** 두고 그 안을 안내 상자가 채운다 —
 * 두 갈래가 다른 화면으로 보이지 않는 것이 이 이슈의 합격 기준이다.
 *
 * **`role="alert"` 는 여전히 주지 않는다** (D6). 오류가 아니라 이 코스의 사실이다 —
 * 경고로 읽히면 스크린리더가 페이지 진입마다 그것을 먼저 읽는다.
 *
 * ### 문구를 여기서 다시 쓰지 않는다 (D5-1)
 *
 * `WalkTimesSection` 이 `goldenWindowStatus` 4갈래 × `forecastCoverage` 분기를 **이미
 * 확정된 문구로** 갖고 있다(#204 · #262 · #270 이 세 번 고친 자리). 이 화면은 **데이터와
 * `onRetry` 만** 넘긴다 — 복제하면 한쪽만 고쳐져 같은 상태에 다른 문구가 나간다.
 *
 * **기준점은 `course-start` 다** ([#779](https://github.com/8llow8llowMe/hondigagae/issues/779)).
 *
 * 전에 이 자리는 `positionFallback={false}` 를 넘기며 *"폴백이 아니니 `false`"* 라고만
 * 따졌다. **그 `false` 가 화면에 `현재 위치 기준` 을 내보낸다는 것을 놓쳤다** — 조회 좌표는
 * 사용자 위치가 아니라 코스 시작점이라 그 줄은 통째로 거짓이었다. 게다가 그것을 바로잡으려
 * 캡션 한 줄을 따로 덧붙여, 한 카드가 기준점을 **두 번, 서로 다르게** 말했다.
 *
 * 그래서 **캡션을 여기서 그리지 않는다.** `WalkTimesSection` 이 기준점 한 줄을 이미 갖고
 * 있고, 이제 그 줄이 시작점을 말할 수 있다 (D8-5 의 사실은 그대로 전달된다).
 */
export function WalkCourseGoldenSlot({
  course,
  walkTimes,
  loading,
  onRetry,
}: {
  course: WalkCourseCoordinates
  walkTimes: WalkTimesResponse | null
  loading: boolean
  onRetry: () => void
}) {
  if (!hasCoordinates(course)) return <NoCoordinates />

  /*
    **조회 실패는 자리를 통째로 숨긴다** — 홈과 같은 규칙이다(`WalkTimesSection` 머리주석).
    여기서 `ErrorState` 를 하나 더 세우면 코스는 잘 왔는데 화면이 오류로 읽힌다.

    좌표 없음 안내와 갈라 두는 것이 핵심이다: 저쪽은 **이 코스의 사실**이라 말해야 하고,
    이쪽은 **일시적 사정**이라 말할 것이 없다.
  */
  if (walkTimes === null && !loading) return null

  return (
    <Surface>
      {/*
        `WalkTimesSection` 은 자기 `border-t` 로 카드 안 블록임을 그린다 — 홈에서 바로 위
        판정 카드와 이어지는 모양이다. 여기서는 위에 아무것도 없어 선이 카드 테두리 바로
        아래 한 줄로 겹쳐 보일 수 있지만, 컴포넌트의 외형을 밖에서 덮지 않는다
        (`docs/component-guide.md` §3).
      */}
      <WalkTimesSection
        data={walkTimes}
        loading={loading}
        basis="course-start"
        onRetry={onRetry}
        retryLabel={messages.walkCourse.goldenRetry}
      />
    </Surface>
  )
}

/** 대안 목록의 접근 이름을 제목 줄에서 가져오는 id */
const ALTERNATIVES_LABEL_ID = 'walk-course-no-coordinates-alternatives'

/**
 * 좌표가 없는 코스 — 자리와 제목을 유지하고 안내 상자를 넣는다 (#730).
 *
 * **제목 문자열을 여기서 새로 쓰지 않는다.** `messages.home.goldenHeading` 은 좌표 있는
 * 갈래(`WalkTimesSection`)가 쓰는 바로 그 값이다 — 두 갈래의 제목이 갈리면 같은 자리가
 * 코스마다 다른 섹션으로 읽힌다.
 *
 * **제목 마크업도 복제하지 않는다.** `Surface` 의 `title` 슬롯이 그리는 `h2` 가
 * `WalkTimesSection` 의 것과 같은 스케일이다 (22 → md 26, semibold → md bold).
 *
 * **상자는 `--band` 채움이다.** 카드 안 채움은 L2 의 채널이고(DESIGN.md §0), 곡률 8 은
 * §5 의 tint 블록 값이다. 카드 좌우 인셋 **안**에 서므로 각진 면이 radius 12 모서리를
 * 덮지 않는다 — §0 이 금지한 것은 카드 끝까지 닿는 불투명 면이다.
 */
function NoCoordinates() {
  return (
    <Surface title={messages.home.goldenHeading}>
      <div className={cn('pb-4 md:pb-5', INSET_CLASS.card)}>
        <div className="bg-band flex flex-col gap-2 rounded-md px-4 py-4">
          {/* ① 왜 없는지 */}
          <p className="text-body-1 text-fg font-semibold break-keep">
            {messages.walkCourse.noCoordinates}
          </p>

          {/* ② 얼마나 흔한 일인지 — 숫자를 적지 않는다 (코스 수는 서버가 센다) */}
          <p className="text-body-2 text-fg-muted break-keep">
            {messages.walkCourse.noCoordinatesCommon}
          </p>

          {/*
            ③ 대안 둘. **목록으로 내보낸다** — 보조기기가 "둘 중 고르는 것" 으로 읽는다.
            `SurfaceList` 를 쓰지 않는다: 그것은 카드 안 목록의 구분선 규약이고, 여기는
            상자 안이라 선을 하나 더 그을 자리가 아니다.
          */}
          <p id={ALTERNATIVES_LABEL_ID} className="text-caption text-fg-muted mt-2 font-medium">
            {messages.walkCourse.noCoordinatesAlternatives}
          </p>

          <ul aria-labelledby={ALTERNATIVES_LABEL_ID} className="flex flex-col gap-3">
            <li className="flex flex-col gap-1">
              {/*
                **검색어를 채우지 않는다** — 근거는 `noCoordinatesPlacesAction` 의 주석이다.
                서버 `keyword` 가 `title`·`addr1` 의 `%LIKE%` 라 시종점 원문에서 만든 토막은
                대부분 0건으로 떨어진다. 빈 검색 화면이 "결과 없음" 보다 낫다.

                44px — 모바일 최소 터치 영역 (DESIGN.md §7). 골든타임 재조회 버튼과 같은 모양이다.
              */}
              <Link
                href="/places"
                className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                {messages.walkCourse.noCoordinatesPlacesAction}
              </Link>
              <p className="text-caption text-fg-muted break-keep">
                {messages.walkCourse.noCoordinatesPlacesDescription}
              </p>
            </li>

            <li className="flex flex-col gap-1">
              {/*
                **여기에 버튼을 하나 더 두지 않는다.** 같은 화면 아래에 `일정에 담기` 가 이미
                있고, 같은 이름의 컨트롤이 둘이면 보조기기에서 목적지가 둘로 들린다
                (`WalkCourseDetailSection` 의 `DetailShell` 주석과 같은 축). 그래서 이 줄은
                **그 버튼을 가리키는 글**이고, 버튼의 보이는 글자를 그대로 인용한다.
              */}
              <p className="text-body-2 text-fg font-semibold break-keep">
                {messages.walkCourse.noCoordinatesPlanAction}
              </p>
              <p className="text-caption text-fg-muted break-keep">
                {messages.walkCourse.noCoordinatesPlanDescription.replace(
                  '{action}',
                  messages.plan.addToPlanAction,
                )}
              </p>
            </li>
          </ul>
        </div>
      </div>
    </Surface>
  )
}
