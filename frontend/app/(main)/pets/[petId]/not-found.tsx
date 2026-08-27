import Link from 'next/link'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { messages } from '@/lib/messages'

/**
 * 경로가 가리키는 반려견이 없다. **타인 소유도 같은 404 다** — 백엔드가 존재
 * 자체를 노출하지 않는다 (공통명세 S4).
 *
 * **중립 톤이다.** 데이터 부재에 danger 톤이나 재시도 버튼을 쓰지 않는다.
 */
export default function PetNotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
      <EmptyState
        title={messages.pet.notFoundTitle}
        description={messages.pet.notFoundDescription}
        action={
          <Link href="/pets">
            <Button variant="secondary">{messages.pet.backToList}</Button>
          </Link>
        }
      />
    </main>
  )
}
