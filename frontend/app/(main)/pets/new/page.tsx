import { PetCreateView } from '@/features/pet/pet-create-view'
import { messages } from '@/lib/messages'

export const metadata = {
  title: `${messages.pet.newTitle} · 혼디가개`,
}

/**
 * 초기 데이터가 없는 폼이라 서버 프리페치를 하지 않는다.
 * `architecture-guide.md` §9 결정 트리 1번에서 아니오로 빠진다 — 로그인·회원가입과 같다.
 */
export default function PetNewPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-title-1 text-fg font-bold">{messages.pet.newTitle}</h1>
      <PetCreateView />
    </main>
  )
}
