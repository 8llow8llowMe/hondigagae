import { aboutMessages } from '@/lib/messages/about'
import { aiPlanMessages } from '@/lib/messages/ai-plan'
import { commonMessages } from '@/lib/messages/common'
import { emergencyMessages } from '@/lib/messages/emergency'
import { favoriteMessages } from '@/lib/messages/favorite'
import { footerMessages } from '@/lib/messages/footer'
import { authMessages, formMessages } from '@/lib/messages/form'
import { homeMessages } from '@/lib/messages/home'
import { legalMessages } from '@/lib/messages/legal'
import { mapMessages } from '@/lib/messages/map'
import { memberMessages } from '@/lib/messages/member'
import { petMessages } from '@/lib/messages/pet'
import { placeMessages } from '@/lib/messages/place'
import { planMessages } from '@/lib/messages/plan'

/**
 * FE가 만드는 화면 문구의 단일 출처.
 *
 * **서버가 내려주는 문구는 여기에 넣지 않는다.** 그대로 렌더한다:
 *  - `dataHeader.resultMessage`
 *  - enum metadata 의 `name` / `description`
 *  - XAI `reasons[].description`
 * (docs/api-integration-guide.md §6, styling-guide.md §7)
 *
 * 상수화하는 이유: 같은 뜻의 문구가 화면마다 "다시 시도" / "재시도" / "새로고침" 으로
 * 갈리는 것을 막는다. 용어는 DESIGN.md §1 표를 따른다 ("반려견" 고정).
 *
 * **어미는 해요체로 통일한다** (DESIGN.md §1). 예외는 두 가지뿐이고, 둘 다 우리가 쓴
 * 문장이 아니다:
 *  1. **백엔드 `ValidationMessage` 복제본** (`form.ts`, `pet.ts` 의 `// XXX_NNN` 주석이
 *     달린 줄) — 서버가 같은 문구를 내려주므로 여기서 톤을 바꾸면 **같은 폼 안에서
 *     클라이언트 검증과 서버 검증의 말투가 갈린다**
 *  2. 서버가 내려주는 문구 자체 (`resultMessage` · enum `name`/`description` · `reasons`)
 *
 * 회귀 감시는 `message-tone.test.ts` 가 한다.
 */
export const messages = {
  common: commonMessages,
  home: homeMessages,
  place: placeMessages,
  plan: planMessages,
  aiPlan: aiPlanMessages,
  emergency: emergencyMessages,
  favorite: favoriteMessages,
  footer: footerMessages,
  about: aboutMessages,
  legal: legalMessages,
  map: mapMessages,
  pet: petMessages,
  member: memberMessages,
  form: formMessages,
  auth: authMessages,
} as const
