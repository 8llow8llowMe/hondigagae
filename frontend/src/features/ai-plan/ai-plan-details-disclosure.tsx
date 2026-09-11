'use client'

import { type ReactNode, useId } from 'react'

import { ChevronDownIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 「더 자세히 정할게요」 — 기본값이 있는 선택 항목을 접는다.
 *
 * **`<details>` 를 쓰지 않는다.** 열림 상태를 React 가 소유해야 `hasAnyDetail` 판정으로
 * 초기값을 정할 수 있는데, `<details open>` 은 uncontrolled 라 사용자가 접은 뒤에도
 * prop 이 다시 열어 버린다.
 *
 * **접혔을 때만 요약을 보인다.** 펼치면 아래에 실제 컨트롤이 있으므로 같은 말을 두 번
 * 하지 않는다.
 *
 * **자기 면·테두리를 갖지 않는 카드 안 L2 다** (`DESIGN.md §0`, #473). 접기 블록은
 * "조건을 더 준다" 는 폼과 같은 화자라 카드 판정 3문을 통과하지 못한다 — 자기 카드로
 * 떼면 같은 이야기가 두 면으로 갈린다. 흰 면 위 간격만으로 구분한다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 */
export function AiPlanDetailsDisclosure({
  open,
  /** 접혔을 때 보여 줄 한 줄 (`lib/ai-plan/details.ts` 의 `detailsSummary`) */
  summary,
  onToggle,
  children,
}: {
  open: boolean
  summary: string
  onToggle: () => void
  children: ReactNode
}) {
  const panelId = useId()

  return (
    <div className="flex flex-col gap-5">
      {/*
        **`<h3>` 가 단추를 감싼다 — 대체하는 게 아니다.** 접기 머리글이 곧 이 구역의
        제목이라 제목 요소가 필요하다.

        **`h2` 에서 내렸다** (#473). 3층 표면으로 옮기면서 폼 전체가 `Surface` 카드 안에
        들어갔고 그 카드가 `AI 일정 만들기` `<h2>` 를 그린다 — 여기가 `h2` 로 남으면 카드
        제목의 **형제**가 되어, 카드 안의 한 구역일 뿐인 접기가 카드와 같은 무게로 읽힌다
        (#464 가 `PetForm` 의 섹션 제목을 `h3` 로 내린 것과 같은 이유). 지금 순서는
        h1(`sr-only`) → h2(카드) → h3(접기) → h4(`AiPlanOptionsSection`)로 건너뜀이 없다.

        단추를 제목 요소로 바꾸지는 않는다 — 누를 수 있어야 하고 `aria-expanded` 를 받는
        role 은 `button` 이다. **크기는 그대로다**: Tailwind preflight 가 h1~h6 의
        `margin` 을 0 으로, `font-size`/`font-weight` 를 `inherit` 로 되돌려 두므로
        상쇄용 클래스가 필요 없다. 글자 굵기·크기는 아래 `<span>` 이 계속 소유한다.

        **폭은 제목 요소가 `flex flex-col` 로 지킨다.** `<button>` 은 `width:auto` 가
        내용에 맞춰 줄어드는 요소라 그냥 감싸면 단추가 글자 폭으로 쪼그라들고, 그러면
        요약의 `ms-auto`(오른쪽 붙이기)와 `truncate` 가 동시에 죽는다. 감싸기 전에는
        바깥 `flex flex-col` 의 flex item 이라 `stretch` 로 늘어나 있었으므로, 같은
        문맥을 `<h3>` 에 그대로 옮겨 준다 — `w-full`(=100%)로는 안 된다. 그러면
        `-mx-2` 가 폭에서 빠져 눌린 자리가 오른쪽으로 8px 좁아진다.
      */}
      <h3 className="flex flex-col">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          /*
            **접혔을 때는 `aria-controls` 를 떼야 한다.** 패널이 조건부 렌더라 접힌 동안
            id 가 DOM 에 없고, 그러면 보조기기에게 이 단추는 없는 것을 가리키는 단추가
            된다 (`place-walk-safety-panel.tsx` 가 같은 규칙을 반대 방향으로 적는다 —
            그쪽은 몸통을 `hidden` 으로 남겨 id 를 지킨다). 조건부 스프레드는
            `date-field.tsx` 와 같은 관용구다.

            ⚠️ 여기를 `hidden` 으로 바꿔 반대로 풀지 않는다. 이 조건부 언마운트는
            `ai-plan-create-form.tsx` 의 두 패스 포커스 장치가 딛고 선 전제다 —
            `hidden` 요소는 포커스를 받지 못하므로 첫 패스가 대상을 "찾고" ref 를
            소비한 뒤 조용히 포커스에 실패한다.
          */
          {...(open ? { 'aria-controls': panelId } : {})}
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
          className="focus-visible:ring-brand-500 -mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronDownIcon
            size={20}
            className={cn('text-fg-subtle shrink-0 transition-transform', open && 'rotate-180')}
          />
          <span className="text-body-1 text-fg font-semibold">{messages.aiPlan.detailsToggle}</span>
          {/*
            접혔을 때만 요약을 낸다. `truncate` 로 한 줄을 지킨다 — 375px 에서 옵션까지
            켜면 줄이 넘치는데, 접힌 줄이 두 줄이 되면 "접었다" 는 인상이 깨진다
          */}
          {!open && <span className="text-body-2 text-fg-muted ms-auto truncate">{summary}</span>}
        </button>
      </h3>

      {open && (
        <div id={panelId} className="flex flex-col gap-5">
          {children}
        </div>
      )}
    </div>
  )
}
