import Link from 'next/link'

import { ListIcon, MapIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * ViewToggle — 목록 ↔ 지도 보기 전환.
 *
 * 아트보드 `혼디가개 장소 찾기` 05 마지막 단락: **세 화면(장소 목록·장소 지도·긴급 시설)이
 * 같은 컨트롤을 쓴다.** 그래야 새로 배울 것이 없다. 담기 화면(#370)도 같은 것을 쓴다.
 *
 * **세그먼트가 아니라 버튼 하나다** (#1125). 지금 보기가 **아닌 쪽**으로 가는 링크 하나만
 * 둔다 — 목록에서 `지도 보기`, 지도에서 `목록 보기`. 예전의 아이콘 두 칸(고른 쪽 검정
 * 채움)은 지금 상태와 갈 곳을 함께 말하느라 무겁고 커 보였고, 아이콘만으로는 무엇을 하는
 * 버튼인지 바로 읽히지 않았다(#240 이 `title` 툴팁으로 메우던 구멍이다). 지금 보기는 화면
 * 자체가 말한다 — 버튼은 **갈 곳**만 말하면 된다.
 *
 * **버튼이 아니라 링크다.** 보기 방식은 URL(`?view=map`)이 소유하는 상태라
 * (architecture-guide.md §10) 공유·뒤로가기가 그대로 성립해야 하고, JS 가 아직 안 붙은
 * 순간에도 전환이 동작한다. 탭 전환은 사용자가 명시적으로 한 이동이므로 `push` 다 —
 * `Link` 의 기본 동작이 그것이다.
 *
 * **자리는 두 보기에서 같다** — 우상단(#412). #1121 이 데스크톱 지도에서 좌측 패널 머리로
 * 옮겼다가, 목록 보기 토글과 1000px 가까이 벌어져 되돌렸다(#1125).
 *
 * **모양은 지도 위 떠 있는 컨트롤과 한 벌이다** — `MapLocateButton` 과 같은 `bg-bg` ·
 * `border-border` · `rounded-lg`. `ButtonLink` 를 쓰지 않는 이유가 이것이다: `secondary` 는
 * `border-border-strong` · `rounded-md` 라 바로 아래 `내 위치` 와 테두리·곡률이 갈린다.
 */
export function ViewToggle({
  current,
  listHref,
  mapHref,
  size = 'md',
  className,
}: {
  /** 지금 보기. 버튼은 **반대쪽**으로 간다 */
  current: 'list' | 'map'
  listHref: string
  mapHref: string
  /**
   * `md`(44) 는 **지도 위 떠 있는 줄**이다 — 같은 줄의 검색(44)·`내 위치`(44)와 높이가 맞아야
   * 한다. 지도 위에만 쓰므로 `shadow-md` 를 스스로 갖는다. `sm`(36) 은 **카드 제목 줄**이다 —
   * 26~28px 제목 옆에서 44 는 제목보다 무거웠다. `sm` 도 누르는 자리는 `::before` 로 46 을
   * 되찾는다 (DESIGN §7 #905 R3, `Chip` `sm` 과 같은 값).
   */
  size?: 'sm' | 'md'
  /** 레이아웃 유틸리티만 허용한다 (component-guide.md §3) */
  className?: string
}) {
  const toMap = current === 'list'
  const Icon = toMap ? MapIcon : ListIcon

  return (
    <Link
      href={toMap ? mapHref : listHref}
      className={cn(
        'bg-bg border-border text-fg hover:bg-band text-body-2 focus-visible:ring-brand-500 inline-flex shrink-0 items-center gap-1.5 rounded-lg border font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        size === 'md'
          ? // 지도 위에 뜬다 — 바로 아래 `내 위치` 와 같은 그림자를 컴포넌트가 갖는다 (component-guide §3)
            'h-11 px-4 shadow-md'
          : // `::before` 는 패딩 상자 기준이라 36 − 테두리 2 = 34 에 6 씩 더해 46 이다 — `Chip` `sm` 과 같은 값
            "relative h-9 px-3 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
        className,
      )}
    >
      <Icon size={size === 'md' ? 18 : 16} />
      {toMap ? messages.map.showMap : messages.map.showList}
    </Link>
  )
}
