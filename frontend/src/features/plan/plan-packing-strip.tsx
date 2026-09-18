import { ChevronRightIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 준비물이 빈 채로 출발이 가까울 때 개요 아래에 서는 **한 줄** (#732 · 진단 665-3).
 *
 * ## 카드가 아니다
 *
 * `DESIGN.md §0` 의 카드 판정 3문에 걸리지 않는다 — 자기 제목이 없고, 담는 항목도 없고,
 * 혼자 떼어놓으면 아무 말도 아니다. `Banner`(상시 진입점)·액션 바와 같은 쪽이라 바닥 위에
 * 그대로 선다.
 *
 * ## 왜 빈 카드를 올리지 않고 이것을 두는가
 *
 * #665 는 출발 전날에 준비물 카드를 맨 위로 올렸는데, **그 카드가 비어 있을 때도 올렸다.**
 * 그날 이 화면을 연 사람이 가장 먼저 만나는 것이 설명 두 문단과 빈 상태가 되어, 승격의
 * 보상이 "빈 상태를 더 잘 보이는 자리로 옮긴 것" 이 됐다.
 *
 * **진입점은 남기고 면적은 주지 않는다.** 준비물 카드는 기본 자리(일자 뒤)에 그대로 있고,
 * 이 줄이 그리로 보낸다.
 *
 * ## 같은 페이지 앵커다
 *
 * 다른 화면으로 보내지 않는다 — 카드가 이 페이지 안에 이미 있고, 라우트를 새로 만들면
 * 준비물이 일정 상세 밖의 무엇으로 읽힌다.
 */
export function PlanPackingStrip({ targetId }: { targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'focus-visible:ring-brand-500 flex min-h-11 items-center gap-2 py-2 focus-visible:ring-2 focus-visible:outline-none',
        INSET_CLASS.card,
      )}
    >
      <span className="text-body-2 text-fg min-w-0 flex-1 font-medium break-keep">
        {messages.plan.packingPromptTitle}
      </span>
      {/* 눌러서 이동한다는 것을 말하는 유일한 신호다 (`Banner` 와 같은 처리) */}
      <ChevronRightIcon size={20} aria-hidden className="text-fg-subtle shrink-0" />
    </a>
  )
}
