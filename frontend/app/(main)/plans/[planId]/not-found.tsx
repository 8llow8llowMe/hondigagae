import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { messages } from '@/lib/messages'

/**
 * 경로가 가리키는 일정이 없다 (백엔드 404).
 *
 * **"없는 일정" 과 "남의 일정" 을 구분하지 않는다** — 백엔드가 본인 소유가 아니면
 * 404 로 응답한다(컨트롤러 설명 명시). 화면도 존재 여부를 흘리지 않는다.
 *
 * **중립 톤이다.** 데이터 부재에 danger 톤이나 재시도 버튼을 쓰지 않는다.
 */
export default function PlanDetailNotFound() {
  return (
    <main className="mx-auto max-w-screen-md px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <EmptyState
        title={messages.plan.detailNotFoundTitle}
        description={messages.plan.detailNotFoundDescription}
        action={
          <ButtonLink href="/plans" variant="secondary">
            {messages.plan.backToList}
          </ButtonLink>
        }
      />
    </main>
  )
}
