import { Canvas } from '@/components/surface'
import { LegalDocumentView } from '@/features/legal/legal-document-view'
import { privacyPolicy } from '@/lib/legal/privacy-policy'
import { messages } from '@/lib/messages'

/**
 * 개인정보 처리방침 — 이슈 #610.
 *
 * **미로그인에서도 열려야 한다** — 약관 페이지와 같은 이유다 (`terms/page.tsx`).
 */
export const metadata = {
  title: `${messages.legal.privacyTitle} · 혼디가개`,
  description: messages.legal.privacyDescription,
}

export default function PrivacyPage() {
  return (
    <Canvas as="main" id="main-content">
      <LegalDocumentView doc={privacyPolicy} />
    </Canvas>
  )
}
