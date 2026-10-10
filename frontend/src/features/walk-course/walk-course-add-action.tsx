'use client'

import { useState } from 'react'

import { Button, ButtonLink } from '@/components/button'
import { toLoginHref } from '@/features/nav/menu-items'
import {
  type WalkCourseAddTarget,
  WalkCourseAddToPlanSheet,
} from '@/features/plan/walk-course-add-to-plan-sheet'
import { messages } from '@/lib/messages'

/**
 * 코스 상세 하단의 `일정에 담기` 진입 (`올레담기-세부명세.md` D0 · D4).
 *
 * **목록 행에는 두지 않는다** — 상세에서만 연다 (D8-1). 코스는 29개뿐이라 상세를 한 번
 * 여는 비용이 낮고, 목록 행 전체가 이미 링크라 버튼을 넣으면 중첩 상호작용이 된다.
 *
 * **미로그인은 시트를 열지 않고 로그인으로 보낸다** (D4-1). `장소 상세` 의
 * `PlaceLoginPromptSheet` 처럼 안내 시트를 한 번 더 두지 않는다 — 전역 nav 의 보호
 * 메뉴가 `toLoginHref` 로 곧장 우회시키는 것과 같은 처리다(#116). 버튼 자체는 항상
 * 보인다 — 기능의 존재를 숨기지 않는다.
 *
 * **버튼 이름에 코스를 덧붙이지 않는다.** 페이지 안에 이 버튼이 하나뿐이고 `h1` 이 이미
 * `courseLabel` 을 말하고 있어(`WalkCourseDetailSection` D6), 보이는 글자(`일정에 담기`)
 * 만으로 접근 가능한 이름이 모호하지 않다 — `PlaceDetailActionBar` 의 같은 버튼과 같은
 * 판단이다.
 */
export function WalkCourseAddAction({
  course,
  authed,
}: {
  course: WalkCourseAddTarget
  authed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)

  const label = added ? messages.plan.addToPlanAgainAction : messages.plan.addToPlanAction

  if (!authed) {
    return (
      <ButtonLink
        href={toLoginHref(`/olle/${course.walkCourseId}`)}
        size="lg"
        /*
          **컨테이너 폭을 그대로 먹지 않는다** (#781). 1440 에서 1346×48px 이었다 —
          주 버튼이 화면 한 줄을 가로지르면 누르라는 신호가 아니라 띠로 읽힌다.

          `max-w-sm`(384)이고 360 이 아닌 이유: 360 은 Tailwind 스케일 밖이라
          `max-w-[360px]` 가 되는데 이 저장소의 eslint 가 토큰 밖 arbitrary value 를
          막는다 (DESIGN.md §2·§4). **모바일에서는 375 < 384 라 여전히 전폭이다.**
        */
        className="w-full max-w-sm"
      >
        {label}
      </ButtonLink>
    )
  }

  return (
    <>
      <Button size="lg" className="w-full max-w-sm" onClick={() => setOpen(true)}>
        {label}
      </Button>

      <WalkCourseAddToPlanSheet
        open={open}
        onClose={() => setOpen(false)}
        course={course}
        onAdded={() => setAdded(true)}
      />
    </>
  )
}
