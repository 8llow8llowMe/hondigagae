import { BackLink } from '@/components/back-link'
import { messages } from '@/lib/messages'

/**
 * 장소 목록으로 돌아가는 링크.
 *
 * 외형·접근성 계약은 `BackLink` 가 소유한다. 이 파일은 **목적지와 문구만** 정한다.
 *
 * 필터 보존은 이번 범위가 아니다 (세부명세 D8 #3). 브라우저 뒤로 가기는 이미 유지된다.
 */
export function PlaceBackLink({ className }: { className?: string }) {
  return <BackLink href="/places" label={messages.place.backToList} className={className} />
}
