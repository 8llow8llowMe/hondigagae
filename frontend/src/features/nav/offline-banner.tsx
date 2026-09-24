'use client'

import { useOnline } from '@/lib/hooks/use-online'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 오프라인 띠 — 헤더 바로 아래 (#912).
 *
 * **`role="status"` 상자는 늘 있고 내용만 갈린다.** 라이브 영역은 내용이 바뀌기 **전에**
 * DOM 에 있어야 보조기기가 변화를 읽는다 — 끊기는 순간 상자째 붙이면 조용히 지나간다.
 * 온라인일 때는 비어 있어 높이가 0 이다.
 *
 * **헤더 아래에 붙어 따라온다** (`sticky`). 끊김은 스크롤 위치와 무관하게 알아야 하는
 * 사실이다 — 목록을 내려 둔 채 끊기면 맨 위 띠는 보이지 않는다. `top-14 md:top-16` 은
 * 헤더 높이(`--header-h` 56/64)와 같은 값이고, `z-30` 은 헤더(`z-40`) 바로 아래다.
 *
 * **반전 띠(`bg-fg` · `text-fg-inverse`)다 — 경보색이 아니다.** 이슈는 "warning 톤" 을
 * 적었지만 저장소에 경고 토큰이 없고, `--metric-*` 은 **등급** 스케일이라(DESIGN.md §2-3)
 * 연결 상태에 쓰면 판정처럼 읽힌다. danger 는 장애처럼 읽힌다. 반전 띠는 "화면 밖의 사정" 을
 * 말하는 시스템 알림의 관례이고 본문 어느 색과도 겹치지 않는다.
 */
export function OfflineBanner() {
  return <OfflineBannerView offline={!useOnline()} />
}

/** 표시만 — node 환경에서 렌더해 잰다 (`testing-guide.md` §1) */
export function OfflineBannerView({ offline }: { offline: boolean }) {
  return (
    <div role="status" className="sticky top-14 z-30 md:top-16">
      {offline && (
        <p
          className={cn(
            'bg-fg text-fg-inverse text-body-2 py-3 font-medium break-keep',
            INSET_CLASS.main,
          )}
        >
          {messages.common.offlineBanner}
        </p>
      )}
    </div>
  )
}
