import { termsOfService } from '@/lib/legal/terms-of-service'
import type { LegalDocument } from '@/lib/legal/types'

/**
 * 구조 테스트가 순회하는 목록. **문서를 추가하면 여기에 넣는다** — 넣지 않으면
 * 구조 검증을 받지 않는 문서가 생긴다.
 */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [termsOfService]
