import Link from 'next/link'

import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 장소 목록으로 돌아가는 링크.
 *
 * `Button` 을 쓰지 않는 이유: 이동은 `<a>` 여야 새 탭·주소 복사·스크린리더 안내가 성립한다.
 * `Button` 에 `href` 를 뚫거나 버튼 외형을 복제하지 않고 **텍스트 링크**로 둔다
 * (component-guide.md §3 — 외형은 컴포넌트가 소유한다).
 *
 * 필터 보존은 이번 범위가 아니다 (세부명세 D8 #3). 브라우저 뒤로 가기는 이미 유지된다.
 */
export function PlaceBackLink({ className }: { className?: string }) {
  return (
    <Link
      href="/places"
      className={cn(
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        'text-body-2 text-brand-600 inline-flex h-11 items-center gap-1 font-semibold',
        'focus-visible:ring-brand-500 rounded-md focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      <span aria-hidden>←</span>
      {messages.place.backToList}
    </Link>
  )
}
