import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type IntroBandTone = 'plain' | 'tint' | 'brand'

/**
 * `plain` 은 **배경을 칠하지 않는다.** 바닥(`--bg-sunken`)은 `Canvas` 의 것이고
 * (`token-usage.test.ts` 가 소유자를 하나로 잠근다), 이 밴드는 그 위에 서므로 같은 색을 또
 * 칠하면 층만 하나 늘고 어느 것이 바닥인지 읽히지 않는다 — `surface.tsx` 머리주석과 같은 축.
 */
const TONE: Record<IntroBandTone, string> = {
  plain: 'text-fg',
  tint: 'bg-intro-band text-fg',
  brand: 'bg-brand-700 text-fg-inverse',
}

/**
 * 소개 페이지 전폭 밴드 (#635, 명세 §6 · §7). **`Canvas` 안에서 전폭으로 서고 안쪽 내용만
 * 1152(`max-w-6xl`)다** — §0 "바닥은 전폭, 쌓기는 폭 안". 이 화면은 `SurfaceStack` 을 쓰지
 * 않는다. 밴드가 그 역할(세로 쌓기 · 간격)을 맡는다.
 *
 * 이름이 `Band` 가 아닌 이유: 2a 의 `Band`(8px 경계 밴드)는 폐기됐고(#475) 그 이름을 되살리면
 * 다른 것으로 읽힌다. 이 밴드는 경계가 아니라 **면**이다.
 *
 * 그린 밴드(`brand`)의 글자는 `--fg-inverse`(6.91:1). 안의 링크·버튼은 `inverse` 변형을 쓴다.
 */
export function IntroBand({
  tone,
  labelledBy,
  className,
  children,
}: {
  tone: IntroBandTone
  labelledBy: string
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn('w-full', TONE[tone])}>
      <div
        className={cn('mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-16 lg:px-10', className)}
      >
        {children}
      </div>
    </section>
  )
}
