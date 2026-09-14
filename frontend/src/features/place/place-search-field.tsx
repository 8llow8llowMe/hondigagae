'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { KEYWORD_MAX_LENGTH, normalizeKeyword } from '@/lib/url/keyword'
import { cn } from '@/lib/utils/cn'
import type { PlaceFilters } from '@/types/place'

const INPUT_ID = 'place-keyword'

/**
 * 장소 이름·주소 검색 — 이슈 #431 (계약은 #421).
 *
 * **필터와 같은 자리, 같은 축이다.** 검색어는 `PlaceFilters.keyword` 의 한 축이고 URL
 * `?keyword=` 에 산다 (`architecture-guide.md` §10). 그래서 초기화가 검색어도 함께 지우고,
 * 목록↔지도를 오가도 조건이 유지된다 — 필터 칩·레일과 **같은 `usePlaceFilterNav`** 를 쓴다.
 *
 * **레일이 아니라 본문 열에 둔다.** 레일은 1024 이상에서만 있고(`hidden lg:block`) 검색은
 * 모든 폭에서 필요하다. 카드 **밖**인 것은 필터 칩과 같은 이유다 — 검색은 목록을 좁히는
 * **도구**이고 카드는 그 결과를 담는다 (`DESIGN.md §0` 카드 판정).
 *
 * **지도 보기에는 두지 않는다.** 지도 갈래는 필터 레일도 칩도 없다 — 아트보드 05 가 지도를
 * 바탕으로 두기 때문이고, 조건은 URL 에 남아 `nearbyPlacesPath` 가 그대로 싣는다
 * (`lib/api/place.ts`). 검색만 예외로 두면 지도 위에 도구가 하나만 떠 규칙이 갈린다.
 *
 * **좌우 인셋을 스스로 갖는다** (#531). `SurfaceStack` 직속이라 모바일에서 스택이 좌우
 * 여백을 주지 않고(카드가 전폭으로 내려앉는 화면이다), 이 폼만 `px` 를 안 받아 **입력란이
 * 화면 가장자리에 붙어 있었다** — 바로 아래 칩 줄(`INSET_CLASS.card`)과 목록 행은 16 에
 * 서는데 검색만 0 이었다. 같은 축을 쓴다: 왼쪽 세로선은 페이지가 하나로 쓴다(`inset.ts`).
 *
 * ### 즉시 반영하지 않는다
 *
 * 필터 레일은 누르는 즉시 URL 을 바꾸지만 **글자는 다르다** — 한 글자마다
 * `router.replace` 가 나가면 조회가 타이핑 수만큼 생기고 주소가 그만큼 덮어써진다.
 * 제출(엔터 · `검색`)이 확정 지점이다. 디바운스를 두지 않은 이유는 **"언제 나갔는지"를
 * 사용자가 알 수 있어야** 해서다 — 모바일 필터 시트가 적용 버튼을 갖는 것과 같은 판단이다.
 */
export function PlaceSearchField({ filters }: { filters: PlaceFilters }) {
  const { apply } = usePlaceFilterNav()
  const [text, setText] = useState(filters.keyword ?? '')

  /*
    **URL 이 바뀌면 입력도 따라간다.** 초기화·뒤로가기·보기 전환이 `keyword` 를 바꾸는데
    입력이 제 값을 들고 있으면 화면에 보이는 검색어와 실제 조건이 갈린다.
  */
  useEffect(() => {
    setText(filters.keyword ?? '')
  }, [filters.keyword])

  function submit(keyword: string | null): void {
    apply({ ...filters, keyword })
  }

  return (
    <form
      // `search` 랜드마크 — 보조기기가 이 구간을 이름으로 찾는다
      role="search"
      aria-label={messages.place.searchLabel}
      className={cn('flex items-start gap-2 pt-3', INSET_CLASS.card)}
      onSubmit={(event) => {
        event.preventDefault()
        submit(normalizeKeyword(text))
      }}
    >
      <label htmlFor={INPUT_ID} className="sr-only">
        {messages.place.searchLabel}
      </label>
      <Input
        id={INPUT_ID}
        value={text}
        onValueChange={setText}
        /*
          **`type="search"` 다** — 모바일 키보드가 `검색` 키를 내주고, 브라우저가 비우기
          버튼을 그린다. `maxLength` 는 백엔드 상한과 같은 상수라(#421) 붙여넣기까지
          여기서 막힌다 — 넘겨 보내면 400 이다.
        */
        type="search"
        enterKeyHint="search"
        maxLength={KEYWORD_MAX_LENGTH}
        placeholder={messages.place.searchPlaceholder}
        className="min-w-0 flex-1"
      />
      <Button type="submit" variant="secondary">
        {messages.place.searchAction}
      </Button>
    </form>
  )
}
