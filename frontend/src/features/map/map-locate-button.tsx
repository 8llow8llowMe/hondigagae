'use client'

import { CrosshairIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 지도를 내 위치로 옮기는 버튼.
 *
 * **좌표를 직접 구하지 않는다.** 호출부가 `getCurrentPosition()` 결과를 이미 들고 있고
 * (거리 표시·폴백 안내가 같은 값을 쓴다), 이 버튼이 따로 물으면 같은 화면에서 위치를
 * 두 번 묻게 된다.
 *
 * **제주 밖이면 호출부가 이 버튼을 아예 렌더하지 않는다.** 이 서비스의 데이터가 제주뿐이라
 * 서울에서 눌러도 갈 곳이 없고(`lib/geo/jeju-bounds.ts`), 눌리는 버튼을 두면 왜 아무 일도
 * 안 일어나는지 화면이 설명해야 한다.
 *
 * 크기는 44 — `ViewToggle` 아이콘형과 같은 값이고 그 바로 아래에 세로로 붙는다.
 */
export function MapLocateButton({
  onLocate,
  className,
}: {
  onLocate: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onLocate}
      aria-label={messages.map.myLocation}
      title={messages.map.myLocation}
      className={cn(
        'bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 flex size-11 items-center justify-center rounded-lg border shadow-md focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      <CrosshairIcon size={20} />
    </button>
  )
}
