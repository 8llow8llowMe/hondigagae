import { EmptyState } from '@/components/empty-state'
import { PlaceBackLink } from '@/features/place/place-back-link'
import { messages } from '@/lib/messages'

/**
 * 경로가 가리키는 장소가 없다 (백엔드 404).
 *
 * **중립 톤이다.** 데이터 부재에 danger 톤이나 재시도 버튼을 쓰지 않는다
 * (DESIGN.md §2, api-integration-guide.md §3).
 */
export default function PlaceDetailNotFound() {
  return (
    <main className="mx-auto max-w-screen-md px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <EmptyState
        title={messages.place.detailNotFoundTitle}
        description={messages.place.detailNotFoundDescription}
        action={<PlaceBackLink />}
      />
    </main>
  )
}
