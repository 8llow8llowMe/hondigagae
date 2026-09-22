import { cn } from '@/lib/utils/cn'

/**
 * 근거 목록 (XAI `reasons`) — 디자인 가이드 §5.
 *
 * **서버 순서를 재정렬하지 않는다.** 영향이 큰 순서로 온다. 문장도 서버가 완성형으로
 * 준다(`description`) — FE 가 다시 쓰지 않는다 (styling-guide.md §7).
 *
 * **점수 숫자를 노출하지 않고, 문장 앞에 3px 세로 바를 달지 않는다.** 감점은 문장이
 * 말하고 등급은 상단 요약이 말한다. 바를 달면 목록이 색 줄무늬로 읽힌다.
 *
 * ### 접기를 걷었다 (#840)
 *
 * 예전에는 기본 2~3개만 보이고 나머지를 펼침 버튼 뒤에 뒀다. **접어서 아끼는 것은 문장
 * 한 줄(약 22px)인데 버튼이 44px**(DESIGN.md §7 최소 터치 영역)이라, 근거가 3개인 흔한
 * 경우 접기가 순손실이었다. 상태가 사라지면서 `'use client'` 도 함께 뗐다 — 이제 서버
 * 컴포넌트에서도 쓸 수 있다.
 *
 * **`className` 은 바깥 래퍼가 아니라 이 `ul` 에 직접 붙는다** — 접기를 걷으면서 래퍼
 * `div` 가 사라졌다. `ul` 이 `flex` 라서 `list-disc pl-5` 만 넘기면 불릿이 그려지지 않는다.
 * 불릿이 필요하면 `flex` 를 먼저 걷어야 한다.
 */

export type Reason = {
  /** 서버가 완성형으로 주는 문장 */
  description: string
  /**
   * 정보성 항목은 감점이 아니다 — 한 단계 흐리게만 내리고 부호를 붙이지 않는다
   * (예: "혼잡도 정보 없음").
   */
  informational?: boolean
}

export function ReasonList({ reasons, className }: { reasons: Reason[]; className?: string }) {
  if (reasons.length === 0) return null

  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {reasons.map((reason, index) => (
        <li
          key={`${index}-${reason.description}`}
          className={cn('text-body-2', reason.informational === true ? 'text-fg-muted' : 'text-fg')}
        >
          {reason.description}
        </li>
      ))}
    </ul>
  )
}
