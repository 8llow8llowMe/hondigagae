import Link from 'next/link'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'

/**
 * 인증 화면의 서비스 표식 — 홈으로 가는 락업 링크 (#532 → #1283).
 *
 * **셸이 아니라 화면이 단다** (#1283 C2). 예전에는 `(auth)` 레이아웃이 네 화면 모두의 위에
 * 락업을 그렸는데, 화면마다 세로 정렬이 달라(로그인 · 가입은 위, 비밀번호 찾기는 가운데)
 * 넘길 때마다 락업이 위아래로 튀었다. 하위 화면(가입 · 비밀번호 찾기)은 이제 `AuthTopBar` 의
 * `←` 가 출구이고, 락업은 **들어오는 자리**(로그인 · 소셜 콜백)에만 선다.
 *
 * **크기는 셸 크기 그대로다** (심볼 48 · 워드마크 40, `DESIGN.md` §1 개정). 자리만 옮겼다.
 *
 * **`aria-label` 을 링크에 다시 붙이지 않는다** — `Wordmark` 가 스스로 든 `role="img"` +
 * `aria-label` 이 링크의 이름이 된다. 붙이면 스크린리더가 이름을 두 번 읽는다 (브랜드 명세 B4).
 */
export function AuthBrand({ tagline }: { tagline?: string | undefined }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/*
        `min-h-11` — 기준(44)은 지키되 심볼(48)이 잘리지 않게 최소값으로 둔다. 예전 셸의 링크와
        같은 배선이다.
      */}
      <Link
        href="/"
        className="text-fg focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-4 rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <BrandSymbol size={48} />
        <Wordmark height={40} />
      </Link>
      {tagline !== undefined && <p className="text-body-2 text-fg-muted">{tagline}</p>}
    </div>
  )
}
