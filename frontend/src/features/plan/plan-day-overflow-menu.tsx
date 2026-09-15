'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/button'
import { MoreIcon } from '@/components/icons'
import { Menu, MenuAnchor } from '@/components/menu'
import { messages } from '@/lib/messages'

/**
 * 일자 카드의 오버플로 — 지금은 `다시 만들기` 하나다 (#653 · 진단 PL-4 · 명세 D11-4).
 *
 * **셋 중 이것만 내린 이유는 무게가 다르기 때문이다.** `장소 추가` · `순서 편집` 은 담은
 * 것을 손보는 일이고, `다시 만들기` 는 **그 날을 통째로 갈아엎는다**. 셋을 나란히 두면
 * 무게 차이가 보이지 않는다 — 390 실측에서 셋이 같은 크기·같은 variant 로 한 줄에 섰다.
 *
 * **항목이 하나뿐인 메뉴를 만드는 것이 낭비가 아니다.** 이 자리의 일은 고르는 것이 아니라
 * **판정 위에서 액션을 걷어내는 것**이고, 나중에 일자 단위 액션이 늘면 여기로 온다.
 *
 * **`href` 로 넣는다.** `다시 만들기` 는 라우트 이동이라 `onSelect` + `router.push` 로
 * 흉내내면 새 탭·가운데클릭·주소 복사가 죽는다 (`menu.tsx` 주석).
 *
 * **호출부가 `regenerateHref === null` 이면 이 컴포넌트를 아예 렌더하지 않는다** — 메뉴가
 * 비면 `⋯` 도 내지 않는다. 눌러도 늘 400 인 일정(이미 시작했거나 11일 이상)이 그 경로다.
 *
 * icon-only 라 `aria-label` 이 접근 가능한 이름이다. **일자마다 이름이 갈려야 한다** —
 * 3일 일정이면 같은 `⋯` 가 셋이라 `1일차 관리` 처럼 일자를 넣지 않으면 스크린리더에서
 * 구별되지 않는다. 키보드 순회는 `Menu` 가 보장한다.
 */
export function PlanDayOverflowMenu({
  day,
  regenerateHref,
}: {
  day: number
  regenerateHref: string
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const label = messages.plan.dayMenuLabel.replace('{day}', String(day))

  return (
    <MenuAnchor className="shrink-0">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        iconOnly
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        leading={<MoreIcon size={20} />}
        onClick={() => setOpen((value) => !value)}
      />
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        label={label}
        className="top-full right-0 mt-1"
        items={[{ label: messages.plan.regenerateDayAction, href: regenerateHref }]}
      />
    </MenuAnchor>
  )
}
