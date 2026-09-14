'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/button'
import { SearchIcon } from '@/components/icons'
import { Input } from '@/components/input'
import { messages } from '@/lib/messages'
import { KEYWORD_MAX_LENGTH, normalizeKeyword } from '@/lib/url/keyword'
import { cn } from '@/lib/utils/cn'
import type { FacilityFilters } from '@/types/emergency'

const INPUT_ID = 'emergency-keyword'

/**
 * 시설명 · 주소 검색 — 이슈 #584.
 *
 * **`PlaceSearchField`(#431)와 같은 문법이다.** 검색어는 `FacilityFilters.keyword` 의 한
 * 축이고 URL `?keyword=` 에 산다 (`architecture-guide.md` §10) — 초기화가 검색어도 함께
 * 지우고, 목록↔지도를 오가도 조건이 유지된다. 두 화면이 한 컴포넌트를 나눠 쓰지 않는
 * 것은 상태를 쥔 곳이 다르기 때문이다: `/places` 는 훅(`usePlaceFilterNav`)이 URL 을
 * 직접 쓰지만 이 화면은 보드가 쥐고 있어 `onFiltersChange` 를 받는다
 * (`emergency-filter-rail.tsx` 머리주석과 같은 이유).
 *
 * **필터 레일이 아니라 카드 머리에 둔다.** 이슈 본문은 "데스크톱 필터 레일과 모바일 필터
 * 시트" 를 적었지만, 레일은 `hidden lg:block` 이라 거기 두면 **1024 미만에서 검색이
 * 사라진다** — 모바일 쪽은 칩 줄이지 시트가 아니라 같은 입력을 또 만들어야 한다. 카드
 * 머리(`Surface` 의 `tools`)는 두 폭 모두에 있고, #556 이 제목·도구를 거기로 모아 둔
 * 자리다. 그래서 `lg:hidden` 을 걸지 않는다 — 레일과 겹치는 축이 아니다.
 *
 * ### 지도 갈래에도 선다 — `compact`
 *
 * 처음에는 `/places`(#431)를 따라 지도에 두지 않았다. 근거는 *"지도 위에 도구를 하나만
 * 띄우면 규칙이 갈린다"* 였는데, **지도에서 검색어가 걸린 것을 알 방법이 없다는 것이 더
 * 큰 구멍이었다** — 목록은 이유 없이 줄어 있고 화면 어디에도 그 검색어가 없다. 필터바의
 * `초기화` 는 푸는 손잡이일 뿐 무엇이 걸렸는지 말하지 않는다.
 *
 * 그래서 지도 갈래에도 둔다. 자리는 둘로 갈린다:
 *
 * - **1024 미만** — 지도 위 오버레이, **보기 토글 왼쪽**. 375 실측으로 토글(90)과 좌우
 *   여백(16×2)을 뺀 245 가 전부라, `compact` 는 `검색` 글자 버튼을 아이콘으로 바꾸고
 *   짧은 placeholder 를 쓴다 (입력 193). 글자 버튼이면 입력이 177 로 줄어 문구가 잘린다
 * - **1024 이상** — 좌측 400 패널 **맨 위**. 툴바 안쪽이 374 라 목록 갈래의 모바일
 *   검색(343)보다 오히려 넓다 — 여기서는 `compact` 를 쓰지 않는다
 *
 * ### 즉시 반영하지 않는다
 *
 * 칩·레일은 누르는 즉시 URL 을 바꾸지만 **글자는 다르다** — 한 글자마다 `router.replace`
 * 가 나가면 주소가 타이핑 수만큼 덮어써진다. 제출(엔터 · `검색`)이 확정 지점이다.
 * 디바운스를 두지 않은 것은 **언제 반영됐는지 사용자가 알 수 있어야** 해서다.
 */
export function EmergencySearchField({
  filters,
  onFiltersChange,
  compact = false,
  id = INPUT_ID,
  className,
}: {
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  /** 지도 위 오버레이용 — 아이콘 제출 버튼 · 짧은 placeholder (위 머리주석) */
  compact?: boolean
  /**
   * **한 화면에 두 벌이 설 수 있어 `id` 를 받는다.** 지도 갈래는 오버레이(`lg:hidden`)와
   * 좌측 패널(`hidden lg:block`)을 **둘 다 렌더**하고 CSS 로만 감춘다 — `/places` 지도가
   * 패널과 시트를 그렇게 두는 것과 같다. 같은 `id` 가 둘이면 `htmlFor` 가 어느 쪽을
   * 가리키는지 문서가 정하지 못한다.
   */
  id?: string
  className?: string
}) {
  const [text, setText] = useState(filters.keyword ?? '')

  /*
    **URL 이 바뀌면 입력도 따라간다.** 초기화·완화 버튼·보기 전환이 `keyword` 를 바꾸는데
    입력이 제 값을 들고 있으면 화면에 보이는 검색어와 실제 조건이 갈린다.

    **"뒤로가기" 는 여기 없다** — `useEmergencyNav` 가 `replace` 라 조건 변경은 히스토리를
    만들지 않는다 (그 이유는 그 훅 머리주석에 있다). `PlaceSearchField` 의 같은 자리에서
    문장을 옮겨 오며 그 한 낱말이 따라왔었다.
  */
  useEffect(() => {
    setText(filters.keyword ?? '')
  }, [filters.keyword])

  return (
    <form
      // `search` 랜드마크 — 보조기기가 이 구간을 이름으로 찾는다
      role="search"
      aria-label={messages.emergency.searchLabel}
      className={cn(
        'flex items-start gap-2',
        /*
          **지도 위에서는 떠 있어야 한다** — 같은 줄의 보기 토글·내 위치 버튼이 `shadow-md`
          다. `box-shadow` 가 아니라 `drop-shadow` 인 것이 핵심이다: 이 폼은 배경 없는
          `flex gap-2` 라 `shadow-md` 를 주면 입력과 버튼 **사이 빈 틈까지** 한 덩어리로
          그림자가 깔린다. `drop-shadow` 는 실제로 칠해진 모양의 외곽선을 따라가므로 둘이
          각자 뜬다.

          **`Input`·`Button` 의 `className` 으로 주지 않는다** — 두 컴포넌트 모두 그 자리를
          "레이아웃 유틸리티만" 으로 못박았다 (`component-guide.md` §3). 그림자는 이 폼이
          자기 자식들에게 거는 것이라 계약을 건드리지 않는다.
        */
        compact && 'drop-shadow-md',
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault()
        onFiltersChange({ ...filters, keyword: normalizeKeyword(text) })
      }}
    >
      <label htmlFor={id} className="sr-only">
        {messages.emergency.searchLabel}
      </label>
      <Input
        id={id}
        value={text}
        onValueChange={setText}
        /*
          **`type="search"` 다** — 모바일 키보드가 `검색` 키를 내주고, 브라우저가 비우기
          버튼을 그린다. `maxLength` 는 `/places` 와 같은 상수다 — 이 화면은 검색어를
          서버로 보내지 않지만, 같은 입력이 화면에 따라 다른 길이에서 잘리면 안 된다.
        */
        type="search"
        enterKeyHint="search"
        maxLength={KEYWORD_MAX_LENGTH}
        placeholder={
          compact ? messages.emergency.searchPlaceholderShort : messages.emergency.searchPlaceholder
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
          aria-label={messages.emergency.searchAction}
          leading={<SearchIcon size={18} />}
        />
      ) : (
        <Button type="submit" variant="secondary">
          {messages.emergency.searchAction}
        </Button>
      )}
    </form>
  )
}
