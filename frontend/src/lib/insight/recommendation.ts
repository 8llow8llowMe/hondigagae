import { ApiError, shouldOfferRetry } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import type { PlaceCardPlace } from '@/lib/insight/place-cards'
import { messages } from '@/lib/messages'
import type {
  PlaceRecommendationResponse,
  PlaceSuitabilityResponse,
  WeatherWarningItem,
} from '@/types/insight'

/**
 * 홈 `오늘 갈 만한 곳` 의 추천 응답 규칙 (#1380 · 홈-세부명세 D10).
 *
 * 카드(`place-insight-card.tsx`)는 #1069 부터 **적합도 응답 + 장소 요약** 두 덩어리를 받는다 —
 * 그 둘이 따로 오던 때(목록 + 적합도 3건) 짜인 모양이다. 추천 API 는 둘을 한 항목에 담아 주므로
 * 여기서 갈라 옮기고, 카드는 그대로 둔다.
 */

/** 카드 한 장이 받는 것 */
export type RecommendationCard = {
  /** 판정 — 적합도 응답과 같은 모양. 공통 근거 · 실내 대안 · 반영 축도 이것을 읽는다 */
  data: PlaceSuitabilityResponse
  /** 사진 · 동반 칩 · `지역 · 실내외` 줄 */
  place: PlaceCardPlace
}

/**
 * 추천 응답을 카드 묶음으로 옮긴다.
 *
 * **값을 바꾸지 않고 자리만 옮긴다.** 항목의 판정 필드는 서버가 적합도의 Item 을 그대로 실은
 * 것이라(`PlaceRecommendationItem` 머리주석) 이름만 맞추면 된다 — `title` → `placeTitle`.
 * 머리의 `targetDate` · `weatherProviderName` · `weatherWarning` 은 지역 공통이라 카드마다 같은
 * 값을 싣는다(적합도 응답도 장소마다 같은 값을 실었다).
 *
 * **순서를 바꾸지 않는다** (D10-2). 점수 → 동반 `ALLOWED` 먼저 → 덜 붐비는 곳 → `placeId` 에 유형
 * 다양성까지 서버가 정했다(`weather-insight-integration.md` §6-5). 예전 `orderByScore` 는 목록 앞
 * N곳을 도착 순서대로 받던 때의 처방이었다.
 *
 * **기준 장소는 뺀다** (#428). 좌측 판정이 "{장소} 기준" 으로 이미 그 장소를 말하고 있다. **조회는
 * 그대로 두고 여기서만 뺀다** — `basisPlaceId` 는 `localStorage` 를 읽는 effect 뒤에야 정해져, 질의에
 * 묶으면 하이드레이션 뒤 key 가 바뀌어 콜드 18초짜리 조회를 한 번 더 돌린다.
 */
export function toRecommendationCards(
  response: PlaceRecommendationResponse,
  basisPlaceId: string | null,
): RecommendationCard[] {
  return response.items
    .filter((item) => item.placeId !== basisPlaceId)
    .map((item) => ({
      data: {
        placeId: item.placeId,
        placeTitle: item.title,
        targetDate: response.targetDate,
        score: item.score,
        suitabilityLevel: item.suitabilityLevel,
        headline: item.headline,
        reasons: item.reasons,
        weather: item.weather,
        congestion: item.congestion,
        indoorAlternatives: item.indoorAlternatives,
        petConditionApplied: item.petConditionApplied,
        weatherApplied: item.weatherApplied,
        congestionApplied: item.congestionApplied,
        weatherProviderName: response.weatherProviderName,
        weatherWarning: response.weatherWarning,
      },
      place: {
        firstImage: item.firstImage,
        contentType: item.contentType,
        petAllowanceType: item.petAllowanceType,
        addr1: item.addr1,
        indoor: item.indoor,
      },
    }))
}

/**
 * `갈 만하다` 고 말할 근거가 없는 적합도 등급 — shared-travel `SuitabilityLevel`.
 *
 * `LOW`(주의 필요)와, 추천에는 오지 않지만 갈 만하다는 근거도 아닌 `INSUFFICIENT`(판단 근거 부족).
 * **나머지를 나열하지 않는다** — 서버가 등급을 하나 더 내면 그것은 모르는 값이고, 모르는 것을
 * 나쁘다고 말하지 않는다(`suitabilityTone` 과 같은 태도).
 */
const CAUTIOUS_LEVEL_CODES: ReadonlySet<string> = new Set(['LOW', 'INSUFFICIENT'])

/**
 * 카드로 선 곳이 **전부** `주의 필요` 이하인가 (#1380 · D10-3).
 *
 * 참이면 섹션 제목이 `오늘 {이름}과 갈 만한 곳` 대신 `오늘 장소 상황` 으로 낮아진다. 추천 API 는
 * 후보 중 **가장 나은 곳**을 고를 뿐이라, 비 · 특보 날에는 1위도 `주의 필요` 다 — 그 카드 셋 위에
 * `갈 만한 곳` 이 서면 제목과 카드가 서로를 부정한다(ux-review-2026-10-11 §3-4).
 *
 * **한 곳이라도 나으면 거짓이다.** 그 곳이 1위(첫 카드)이고 제목의 약속이 지켜진다. **카드가 없으면
 * 거짓이다** — 골격 · 빈 상태 · 오류 동안 제목을 바꿀 근거가 없고, 바뀌었다 돌아오면 깜빡인다.
 */
export function allCardsCautious(
  cards: readonly { suitabilityLevel: { code: string } }[],
): boolean {
  return (
    cards.length > 0 && cards.every((card) => CAUTIOUS_LEVEL_CODES.has(card.suitabilityLevel.code))
  )
}

/** 경보 — 추천을 막는 유일한 특보 단계다 (BE `WeatherWarning.suppressesRecommendation`) */
const WARNING_LEVEL_CODE = 'WARNING'

/**
 * 추천이 **빈 목록**으로 온 날 카드 자리가 할 말 (#1513 · BE #1434).
 *
 * - **경보 날** — 경보가 점수를 0 으로 눌러 늘 빈 목록이다. 특보 때문에 쉰다고 말한다. 특보 내용은 홈 맨 위
 *   띠(`WeatherWarningStrip`)가 이미 말하므로 여기서 다시 적지 않는다.
 * - **그 밖** — '주의 필요'(60점 미만)만 남은 날, 날씨를 못 받아 점수가 없는 날이 같은 빈 목록이다. 이유를
 *   단정하지 않는다. **주의보는 추천을 막지 않으므로** 주의보 날 빈 목록도 이쪽이다.
 *
 * 단계는 `level.code` 로만 가른다 — 한국어 `name` 으로 가르지 않는다 (api-integration-guide §6).
 */
export function emptyRecommendationNotice(warning: WeatherWarningItem | null): {
  title: string
  description: string
} {
  return warning?.level.code === WARNING_LEVEL_CODE
    ? {
        title: messages.home.emptyRecommendWarningTitle,
        description: messages.home.emptyRecommendWarningDesc,
      }
    : { title: messages.home.emptyRecommendTitle, description: messages.home.emptyRecommendDesc }
}

/**
 * 추천 조회가 실패했을 때 카드 자리가 할 말 (api-integration-guide.md §3).
 *
 * - **5xx · 무응답** — 일시 장애다. `잠시 문제가 생겼어요` + 재시도(훅이 이미 1회 재시도한 뒤다).
 * - **404 · 그 밖 4xx** — 다시 눌러도 같은 답이라 **재시도 버튼을 달지 않는다.** 서버
 *   `resultMessage` 를 그대로 내고, 문자열이 아니면(백엔드 타입이 `Object` 다) 빈 상태 문구다.
 *   공개 API 에 FE 가 고정 값만 실어 보내므로 실제로는 계약이 어긋났을 때만 온다.
 */
export function recommendationFailure(error: unknown): { retry: boolean; title: string } {
  if (shouldOfferRetry(error)) {
    return { retry: true, title: messages.common.temporaryErrorTitle }
  }

  return {
    retry: false,
    title: toMessage(
      error instanceof ApiError ? error.rawMessage : null,
      messages.home.emptyPlacesTitle,
    ),
  }
}
