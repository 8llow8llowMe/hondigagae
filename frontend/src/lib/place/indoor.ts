import { messages } from '@/lib/messages'

/**
 * 실내 여부를 메타 줄 낱말로 옮긴다 — 이슈 #112.
 *
 * **`null` 은 "야외" 가 아니라 "모름" 이다.** 원천에 정보가 없는 장소가 실제로 흔하고
 * (`indoor` 필터 어느 쪽에도 잡히지 않는다), `false` 로 뭉개면 화면이 "야외" 라고 단정한다.
 * 그래서 메타 줄에서는 **빼고**, 그것을 설명할 자리가 있는 화면만 별도 배지로 드러낸다
 * (장소 목록 행·장소 상세 — 둘 다 실내 필터를 가진 화면이다).
 *
 * **문구를 화면마다 만들지 않는다.** 목록 행이 쓰던 것을 그대로 꺼냈다 — 같은 값을
 * 목록·상세·일정 항목·AI 초안 네 곳이 말하게 되면서 갈릴 자리가 생겼다.
 */
export function indoorLabel(indoor: boolean | null): string | null {
  if (indoor === null) return null
  return indoor ? messages.place.rowIndoor : messages.place.rowOutdoor
}
