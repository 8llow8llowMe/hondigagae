import { Canvas } from '@/components/surface'
import { LegalDocumentView } from '@/features/legal/legal-document-view'
import { termsOfService } from '@/lib/legal/terms-of-service'
import { messages } from '@/lib/messages'

/**
 * 이용약관 — 이슈 #610.
 *
 * **미로그인에서도 열려야 한다.** 약관은 가입 전에 읽는 문서다. `proxy.ts` 의
 * `PROTECTED_PATHS` 에 `/terms` 가 없으므로 기본값이 공개이고, `(main)` 레이아웃은
 * `readSession()` 이 `null` 인 경우를 이미 다룬다 — 따로 할 일이 없다.
 *
 * **데이터 조회가 없다.** 본문이 상수라 프리페치할 것도, 로딩 상태도 없다.
 */
export const metadata = {
  title: `${messages.legal.termsTitle} · 혼디가개`,
  description: messages.legal.termsDescription,
}

export default function TermsPage() {
  return (
    <Canvas as="main" id="main-content">
      <LegalDocumentView doc={termsOfService} />
    </Canvas>
  )
}
