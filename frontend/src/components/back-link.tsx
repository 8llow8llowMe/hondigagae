import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

/**
 * 상위 화면으로 돌아가는 텍스트 링크.
 *
 * `Button` 을 쓰지 않는 이유: 이동은 `<a>` 여야 새 탭·주소 복사·스크린리더 안내가
 * 성립한다. `Button` 에 `href` 를 뚫거나 버튼 외형을 복제하지 않는다
 * (component-guide.md §3 — 외형은 컴포넌트가 소유한다).
 *
 * `PlaceBackLink`(장소 상세)에만 있던 것을 마이페이지 하위 두 화면이 같은 모양을
 * 필요로 하면서 승격했다. **호출부가 바뀌지 않도록 `PlaceBackLink` 는 남기고 이것을
 * 쓰게 했다** — #79 가 `ConfirmModal` 을 `Modal` 위에 얹은 것과 같은 방식이다.
 */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string
  label: string
  /**
   * 레이아웃 유틸리티만 허용한다 (component-guide.md §3).
   *
   * `?:` 가 아니라 `| undefined` 인 이유는 `exactOptionalPropertyTypes` 다 — 감싸는
   * 컴포넌트가 자기 optional prop 을 그대로 넘길 수 있어야 한다.
   */
  className?: string | undefined
}) {
  return (
    <Link
      href={href}
      className={cn(
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        'text-body-2 text-link hover:text-link-hover inline-flex h-11 items-center gap-1 font-semibold',
        'focus-visible:ring-brand-500 rounded-md focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  )
}
