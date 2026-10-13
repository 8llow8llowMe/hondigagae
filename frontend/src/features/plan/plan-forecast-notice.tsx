import { CloudIcon } from '@/components/icons'
import { Surface } from '@/components/surface'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 예보 범위 밖 안내 — 일정에 **한 번** (#1426 · 일정상세-세부명세 D27-1).
 *
 * 예전에는 일자 카드마다 판정 자리의 `예보는 오늘부터 …` 와 산책 위험도의 `… 나흘 뒤까지입니다…`
 * 가 섰다 — 3일 일정이면 같은 두 문장이 여섯 번이었다. 두 문장 다 날짜만의 함수라 여기서 한 번
 * 말하고, 일자는 제목 옆 `예보 전` 칩만 갖는다.
 *
 * **자리는 일자 카드 열의 맨 위다** — 이 안내가 설명하는 것이 그 카드들의 칩이라 가까워야 한다.
 * 개요 카드(레일) 안에 넣지 않는다: 데스크톱에서는 다른 열이라 칩과 멀어진다.
 *
 * **경보가 아니다** — 기다리면 풀리는 사실이라 아이콘도 중립(`text-fg-muted`)이다. 문장은 서버
 * 것을 그대로 쓴다(예보 범위는 서버 상수다).
 */
export function PlanForecastNotice({ sentences }: { sentences: readonly string[] }) {
  return (
    <Surface aria-label={messages.plan.forecastNoticeTitle}>
      <div className={cn(INSET_CLASS.card, 'flex gap-3 py-4')}>
        <CloudIcon size={20} aria-hidden className="text-fg-muted shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body-2 text-fg font-semibold">{messages.plan.forecastNoticeTitle}</p>
          {sentences.map((sentence) => (
            <p key={sentence} className="text-caption text-fg-muted font-medium break-keep">
              {sentence}
            </p>
          ))}
        </div>
      </div>
    </Surface>
  )
}
