'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { toLoginHref } from '@/features/nav/menu-items'
import { messages } from '@/lib/messages'

/**
 * 지도 아일랜드 알약의 계정 자리 — 비로그인 (#1300, `docs/features/place/지도-아일랜드알약-정리-세부명세.md` D1-2).
 *
 * **지금 화면으로 돌아오는 로그인이다** (`toLoginHref(현재 경로)`). 띠 헤더의 `로그인` 은 `/login`(홈 복귀)인데,
 * 지도에서 로그인하면 지도로 돌아오는 편이 낫다. **경로만 쓴다** — 쿼리까지 실으려면 `useSearchParams` 를 써야
 * 하고, 그러면 셸 헤더에 Suspense 경계가 생겨 첫 페인트에서 이 자리가 비었다 차오른다.
 *
 * **채운 버튼이 아니라 글자 링크다** — 지도 미리보기의 `일정에 담기` 와 주 버튼이 둘이 되지 않게(D0 #5).
 * `회원가입` 은 두지 않는다: 로그인 화면이 가입 방법 선택을 잇는다(`login-form.tsx` 의 `/signup?returnTo=`).
 * 알약과 동심원 — 높이 40 · `rounded-full` · 글자 14/600.
 */
export function IslandLoginLink() {
  const pathname = usePathname()

  return (
    <Link
      href={toLoginHref(pathname)}
      className="text-body-2 text-fg hover:bg-band focus-visible:ring-brand-500 inline-flex h-10 shrink-0 items-center rounded-full px-3 font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
    >
      {messages.member.login}
    </Link>
  )
}
