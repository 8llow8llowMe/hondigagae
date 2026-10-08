import { SearchIcon } from '@/components/icons'
import { messages } from '@/lib/messages'

/**
 * "이 지역에서 재검색" 알약 — 두 지도 화면(`/places` · `/emergency`)이 **같은 문구 · 같은 모양**으로 쓴다
 * (#396). 자리는 호출부가 정한다 — 데스크톱은 지도 하단 중앙(`.map-research-offset`), `lg` 미만은 상단
 * 컨트롤 묶음 맨 아래(흐름 안, #1278). 한 화면에 두 벌이 서지만 폭마다 하나만 보인다.
 *
 * **`rounded-full` 은 `ScrollRailArrows` 가 이미 낸 예외를 따른다** — 면 위에 떠 있는 오버레이라
 * 아래 지도의 사각 격자와 같은 모양이면 지도의 일부로 읽힌다.
 */
export function ResearchHereButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-body-2 bg-bg text-fg border-border hover:bg-band focus-visible:ring-brand-500 pointer-events-auto inline-flex h-11 max-w-full items-center gap-2 rounded-full border px-5 font-semibold whitespace-nowrap shadow-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <SearchIcon size={16} />
      {messages.map.researchHere}
    </button>
  )
}
