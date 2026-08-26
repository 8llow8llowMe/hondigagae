import { commonMessages } from '@/lib/messages/common'
import { placeMessages } from '@/lib/messages/place'

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
 */
export const messages = {
  common: commonMessages,
  place: placeMessages,
} as const
