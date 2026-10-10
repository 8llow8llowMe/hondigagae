'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/button'
import { SearchIcon } from '@/components/icons'
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
 * ### 지도 보기에도 선다 — `compact` (#596)
 *
 * #431 은 지도 갈래에 두지 않기로 했다. 근거는 *"지도 갈래는 필터 레일도 칩도 없으니
 * 검색만 예외로 두면 지도 위에 도구가 하나만 떠 규칙이 갈린다"* 였는데, **그 전제가
 * 그때 이미 참이 아니었다** — 지도에는 `PlaceMapFilterBar` 가 패널 머리와 시트 툴바
 * 양쪽에 있다. 그리고 더 큰 구멍이 남았다: **지도에서 검색어는 보이지 않는 필터다.**
 * 칩은 자기 축만 상태를 보여주고 캡션은 개수뿐이라, `?keyword=` 를 달고 넘어온
 * 사용자는 목록이 왜 줄었는지 알 수 없다. `초기화` 는 전량 리셋이라 검색어만 푸는
 * 경로도 되지 못한다. `/emergency` 가 #584 에서 같은 판단으로 먼저 뒤집었다.
 *
 * 자리는 셋이고 폭이 자리를 가른다:
 *
 * - **1024 미만** — 지도 위 오버레이, **보기 토글 왼쪽**. 375 실측으로 토글(90)과 좌우
 *   여백(16×2)을 뺀 245 가 전부라 `compact` 는 `검색` 글자 버튼을 아이콘으로 바꾸고
 *   짧은 placeholder 를 쓴다 (입력 193). 글자 버튼이면 입력이 177 로 줄어 문구가 잘린다
 * - **1024 이상** — 좌측 400 패널 **맨 위**. 툴바 안쪽이 374 라 목록 갈래의 모바일
 *   검색(343)보다 오히려 넓다 — 여기서는 `compact` 를 쓰지 않는다
 * - **SDK 실패 폴백** — 안내 줄 아래. 그 갈래에는 필터 칩도 `초기화` 도 없어, 검색을
 *   빼면 `?keyword=` 를 지울 길이 화면에서 사라진다
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
export function PlaceSearchField({
  filters,
  compact = false,
  id = INPUT_ID,
  className,
}: {
  filters: PlaceFilters
  /** 지도 위 오버레이용 — 아이콘 제출 버튼 · 짧은 placeholder · `drop-shadow` (머리주석) */
  compact?: boolean
  /**
   * **한 화면에 두 벌이 설 수 있어 `id` 를 받는다** (#596). 지도 갈래는 오버레이
   * (`lg:hidden`)와 좌측 패널(`hidden lg:block`)을 **둘 다 렌더**하고 CSS 로만 감춘다 —
   * 같은 `id` 가 둘이면 `htmlFor` 가 어느 입력을 가리키는지 문서가 정하지 못한다.
   */
  id?: string
  /** 레이아웃 유틸리티만. 카드/지도 어느 면에 서는지는 담는 곳이 정한다 */
  className?: string
}) {
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
      className={cn(
        'flex items-start gap-2',
        /*
          **지도 위에서는 떠 있어야 한다** — 같은 줄의 보기 토글·내 위치 버튼이 `shadow-md`
          다. `box-shadow` 가 아니라 `drop-shadow` 인 것이 핵심이다: 이 폼은 배경 없는
          `flex gap-2` 라 `shadow-md` 를 주면 입력과 버튼 **사이 빈 틈까지** 한 덩어리로
          그림자가 깔린다. `drop-shadow` 는 실제로 칠해진 모양의 외곽선을 따라가므로 둘이
          각자 뜬다. `Input`·`Button` 의 `className` 으로 주지 않는 이유는 두 컴포넌트 모두
          그 자리를 "레이아웃 유틸리티만" 으로 못박았기 때문이다 (`component-guide.md` §3).
        */
        compact && 'drop-shadow-md',
        /*
          **목록 갈래의 인셋은 기본값으로 남긴다** (#531). `SurfaceStack` 직속이라 스택이
          좌우 여백을 주지 않는 화면이고, 넘겨받은 `className` 이 있으면 담는 곳이 자기
          면에 맞는 값을 이미 정한 것이다.
        */
        className ?? cn('pt-3', INSET_CLASS.card),
      )}
      onSubmit={(event) => {
        event.preventDefault()
        submit(normalizeKeyword(text))
      }}
    >
      <label htmlFor={id} className="sr-only">
        {messages.place.searchLabel}
      </label>
      <Input
        id={id}
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
        placeholder={
          compact ? messages.place.searchPlaceholderShort : messages.place.searchPlaceholder
        }
        className="min-w-0 flex-1"
      />
      {/*
        **아이콘 버튼도 `aria-label` 을 갖는다** — `Button` 의 `iconOnly` 가 타입으로
        강제한다. 이름은 글자 버튼과 같은 `검색` 이라 보조기기에는 두 자리가 같게 들린다.
      */}
      {compact ? (
        <Button
          type="submit"
          variant="secondary"
          iconOnly
          aria-label={messages.place.searchAction}
          leading={<SearchIcon size={18} />}
        />
      ) : (
        <Button type="submit" variant="secondary">
          {messages.place.searchAction}
        </Button>
      )}
    </form>
  )
}
