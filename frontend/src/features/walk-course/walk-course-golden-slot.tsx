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
 * ### 좌표가 없으면 자리를 만들지 않는다 (D5-2)
 *
 * **패널·스켈레톤·비활성 버튼 어느 것도 두지 않는다.** 기다리면 채워질 것처럼 보이고,
 * 비활성 버튼은 "왜 안 되는지" 를 화면이 따로 설명해야 한다.
 *
 * **대신 한 줄은 남긴다.** 코스마다 있고 없는 자리라 소리 없이 사라지면 사용자는 자기가
 * 뭘 잘못 눌렀는지 묻는다. 실측 29개 중 25개가 이 모양이라 **예외가 아니라 기본 모양**이다.
 *
 * **`role="alert"` 를 주지 않는다** (D6). 오류가 아니라 이 코스의 사실이다 — 경고로 읽히면
 * 스크린리더가 페이지 진입마다 그것을 먼저 읽는다.
 *
 * ### 문구를 여기서 다시 쓰지 않는다 (D5-1)
 *
 * `WalkTimesSection` 이 `goldenWindowStatus` 4갈래 × `forecastCoverage` 분기를 **이미
 * 확정된 문구로** 갖고 있다(#204 · #262 · #270 이 세 번 고친 자리). 이 화면은 **데이터와
 * `onRetry` 만** 넘긴다 — 복제하면 한쪽만 고쳐져 같은 상태에 다른 문구가 나간다.
 *
 * **`positionFallback` 은 `false` 다.** 그 prop 은 "기기 위치를 못 얻어 제주 중심으로
 * 조회했다" 를 뜻하는데(#180) 여기 좌표는 **코스의 시작점**이라 폴백이 아니다. `true` 를
 * 넘기면 화면이 없는 사실을 말한다. 대신 시작점 기준이라는 것을 캡션 한 줄로 밝힌다 (D8-5).
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
  if (!hasCoordinates(course)) {
    return (
      <p className={cn('text-body-2 text-fg-muted break-keep', INSET_CLASS.card)}>
        {messages.walkCourse.noCoordinates}
      </p>
    )
  }

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
        positionFallback={false}
        onRetry={onRetry}
        retryLabel={messages.walkCourse.goldenRetry}
      />

      <p className={cn('text-caption text-fg-muted pb-4 break-keep', INSET_CLASS.card)}>
        {messages.walkCourse.goldenBasis}
      </p>
    </Surface>
  )
}
