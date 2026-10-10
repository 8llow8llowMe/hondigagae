import { BackLink } from '@/components/back-link'
import { messages } from '@/lib/messages'

/**
 * 마이페이지로 돌아가는 링크. `/mypage/password` · `/mypage/withdraw` 가 쓴다.
 *
 * 외형·접근성 계약은 `BackLink` 가 소유한다 — `PlaceBackLink` 와 같은 구조다.
 */
export function MyPageBackLink({ className }: { className?: string }) {
  return <BackLink href="/mypage" label={messages.member.backToMyPage} className={className} />
}
