import type { WeatherWarningItem } from '@/types/insight'

/**
 * 홈이 그릴 기상특보 하나 — **화면당 1회다** (#349).
 *
 * **네 응답의 `weatherWarning` 은 같은 값이다.** 백엔드
 * `WeatherWarningProcessor.heaviestWarning()` 이 **제주 전역 단일 지점(184)** 에서 가장 무거운
 * 특보 하나를 고르고, 적합도 · 산책 위험도 · 골든타임 · 권역 비교가 그것을 함께 실어 보낸다.
 * 그래서 여기서 "어느 응답의 값이 맞나" 를 판정할 일이 없다 — **처음 잡히는 것을 쓴다.**
 *
 * **그럼 왜 폴백을 두나.** 값이 갈려서가 아니라 **응답이 없을 수 있어서**다. 홈은 세 조회를
 * 따로 하고 각각 실패하거나 아직 로딩 중일 수 있는데(권역·골든타임은 실패하면 섹션이 통째로
 * 숨는다), 하나만 보고 있으면 그 하나가 비는 날 특보가 화면에서 사라진다. 특보 조회 실패를
 * "특보 없음" 으로 말하는 것이 이 기능의 가장 위험한 실패다 (`WeatherWarningProcessor` 주석).
 *
 * **순서에 뜻이 있다.** 권역이 맨 앞인 이유는 그 조회만 **로그인·기준 장소와 무관하게**
 * 뜨기 때문이다. 산책 위험도는 기준 장소가 있어야 조회되고(`resolveBasisPlaceId`), 골든타임은
 * 위치 권한 흐름을 한 번 거친다 — 첫 방문자에게 가장 먼저 도착하는 것이 권역이다.
 *
 * **여기서 경보/주의보를 가르지 않는다.** 단계 판단은 서버 몫이고 화면은 배지 색까지만
 * 안다 (`WeatherWarningBadge`). 이 함수는 "무엇을 그릴지" 만 고른다.
 */
export function pickWeatherWarning(
  candidates: (WeatherWarningItem | null | undefined)[],
): WeatherWarningItem | null {
  return candidates.find((warning) => warning !== null && warning !== undefined) ?? null
}
