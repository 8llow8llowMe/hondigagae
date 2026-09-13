'use client'

import { type ReactNode, useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Input } from '@/components/input'
import { Skeleton } from '@/components/skeleton'
import { SurfaceList } from '@/components/surface'
import { useFavoriteList } from '@/features/favorite/use-favorite-list'
import { usePlaceList } from '@/features/place/use-place-list'
import { isPinnable, MAX_PINNED_PLACES, togglePinnedPlace } from '@/lib/ai-plan/pinned'
import { toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import { messages } from '@/lib/messages'
import { placeMetaLine } from '@/lib/place/meta'
import { INSET_CLASS } from '@/lib/ui/inset'
import {
  DEFAULT_PLACE_FILTERS,
  KEYWORD_MAX_LENGTH,
  normalizeKeyword,
} from '@/lib/url/place-filters'
import { cn } from '@/lib/utils/cn'
import type { PinnedPlace } from '@/types/ai-plan'

/**
 * 꼭 넣을 장소 고르기 — 아트보드 `혼디가개 AI 일정 생성` 05.
 *
 * **저장한 장소에서 고른다.** 아트보드가 이유를 적었다: 10곳 상한을 채우는 가장 빠른
 * 길이고, 이미 마음에 든 곳이다.
 *
 * **검색 탭이 열렸다** (#431 · 계약은 #421). 아트보드의 `저장한 장소` / `검색` 두 탭이
 * 이제 둘 다 있다. 저장한 장소가 기본이다 — 아트보드의 이유가 그대로고, 이미 마음에 든
 * 곳이 10곳 상한을 채우는 가장 빠른 길이다.
 *
 * **행은 두 탭이 같은 것을 쓴다** (`PickerRow`). 저장 목록과 검색 결과는 응답 모양만
 * 다르고 **고르는 규칙(상한 · 요약 없는 곳 · 선택 tint)은 하나**라, 행을 두 벌로 두면
 * 한쪽만 고쳐지는 자리가 여섯 개 생긴다.
 *
 * **선택을 시트 안에서만 들고 있다.** 담기 전까지 폼을 건드리지 않아 `닫기` 로 취소할 수
 * 있다 — 아트보드의 `N곳 담기` 가 확정 지점이다.
 *
 * **시트 자체는 카드가 아니다** (`DESIGN.md §0` 판정 · `styling-guide.md` §3-2). 오버레이는
 * radius 16 채널이고 `Surface` 는 12 라, 시트를 카드로 만들면 "이 곡률을 보면 떠 있는 것"
 * 이라는 신호가 죽는다. **목록만 2a → 3a 로 옮긴다** (#473) — 이 파일이 `Row`·`RowList` 의
 * 마지막 production 사용처였다.
 */
export function AiPlanPlacePickerSheet({
  open,
  onClose,
  selected,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  /** 폼이 이미 들고 있는 선택. 시트를 열 때의 출발점이다 */
  selected: PinnedPlace[]
  onConfirm: (places: PinnedPlace[]) => void
}) {
  /*
    **`open` 을 key 로 초기화한다.** 시트를 닫고 다시 열면 폼의 현재 값에서 다시
    시작해야 하는데, `useState` 는 첫 마운트의 초기값만 취한다. `BottomSheet` 는
    닫혀 있을 때도 마운트를 유지하므로 여기서 명시적으로 갈아 준다.
  */
  return open ? (
    <PickerBody key={String(open)} onClose={onClose} selected={selected} onConfirm={onConfirm} />
  ) : null
}

/** 두 탭이 같은 모양으로 다루는 한 줄 — 저장 목록과 검색 결과의 교집합이다 */
type PickerItem = {
  placeId: string
  title: string | null
  addr: string | null
  indoor: boolean | null
}

type PickerTab = 'favorites' | 'search'

const TABS = ['favorites', 'search'] as const

function PickerBody({
  onClose,
  selected,
  onConfirm,
}: {
  onClose: () => void
  selected: PinnedPlace[]
  onConfirm: (places: PinnedPlace[]) => void
}) {
  const query = useFavoriteList()
  const [draft, setDraft] = useState<PinnedPlace[]>(selected)
  const [tab, setTab] = useState<PickerTab>('favorites')

  /*
    **검색어는 탭 밖에 둔다** (#431). 탭을 오가는 동안 패널이 마운트를 잃는데, 여기에
    두면 `저장한 장소` 를 잠깐 확인하고 돌아와도 찾던 말이 그대로 있다.
  */
  const [keyword, setKeyword] = useState<string | null>(null)

  const limitReached = draft.length >= MAX_PINNED_PLACES

  function toggle(item: PickerItem): void {
    setDraft((prev) => togglePinnedPlace(prev, { placeId: item.placeId, title: item.title ?? '' }))
  }

  const panel = { draft, limitReached, onToggle: toggle }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={messages.aiPlan.pickerTitle}
      footer={
        <Button size="lg" className="w-full" onClick={() => onConfirm(draft)}>
          {draft.length === 0
            ? messages.aiPlan.pickerConfirmEmpty
            : messages.aiPlan.pickerConfirm.replace('{count}', String(draft.length))}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {/*
          **시트 안 좌우 축을 `INSET_CLASS.panel`(평평한 16)로 모은다** (#473). 예전에는
          `px-4 md:px-6`(16/24)을 세 군데에 따로 적어 두고 있었고, 목록만 3a 로 옮기면
          기준 줄과 행의 세로선이 md 에서 어긋난다 — 값을 한 상수로 모은다.

          **`card`(16/20)가 아니라 `panel` 이다** (`lib/ui/inset.ts` JSDoc). 시트는 md 이상에서
          `md:max-w-sm`(384) **고정 폭 컨테이너**이고, `md:` 는 언제나 **뷰포트** 기준이라
          `card` 의 `md:px-5` 는 컨테이너 자신의 폭이 아니라 화면 폭을 보고 붙는다 — 시트
          자신의 머리(`px-4`)·footer(`px-4`)는 그대로인데 본문만 20 으로 밀려 1280 실측에서
          4px 어긋났다. `card` 는 3층 표면 **안쪽 전용**이고 시트는 카드가 아니다(§3-2).
          저장소의 다른 시트 본문(`place-add-to-plan-sheet` · `map-sheet` ·
          `place-login-prompt-sheet`)도 전부 평평한 16 이다.
        */}
        <div className={cn('flex items-center justify-between gap-2', INSET_CLASS.panel)}>
          <PickerTabs current={tab} onChange={setTab} favoritesCount={query.data?.totalCount} />
          <p className="text-caption text-fg-muted shrink-0 tabular-nums">
            {messages.aiPlan.pinnedCount
              .replace('{count}', String(draft.length))
              .replace('{max}', String(MAX_PINNED_PLACES))}
          </p>
        </div>

        {tab === 'favorites' ? (
          <FavoritesPanel query={query} {...panel} />
        ) : (
          <SearchPanel keyword={keyword} onKeywordChange={setKeyword} {...panel} />
        )}
      </div>
    </BottomSheet>
  )
}

/**
 * `저장한 장소` / `검색` — 아트보드 05 의 두 탭.
 *
 * **ARIA 탭 패턴을 그대로 쓴다.** 좌우 화살표로 옮기고 선택과 동시에 패널이 바뀐다
 * (automatic activation) — 패널이 둘뿐이고 내용이 가벼워 "고르고 나서 확인" 단계를 둘
 * 이유가 없다. 포커스는 선택된 탭 하나만 받는다(roving tabindex) — 둘 다 탭 키로 닿으면
 * 키보드 사용자가 목록에 가기 전에 컨트롤 둘을 지난다.
 */
function PickerTabs({
  current,
  onChange,
  favoritesCount,
}: {
  current: PickerTab
  onChange: (tab: PickerTab) => void
  /** 아직 못 받았으면 `undefined` — 그때는 숫자를 그리지 않는다 */
  favoritesCount: number | undefined
}) {
  function move(step: number): void {
    const next = TABS[(TABS.indexOf(current) + step + TABS.length) % TABS.length]
    if (next === undefined) return

    onChange(next)
    /*
      **포커스도 따라가야 한다.** roving tabindex 는 선택된 탭 하나만 탭 키 순서에 두는데,
      화살표로 선택만 옮기고 포커스를 두고 오면 사용자는 `tabIndex={-1}` 이 된 버튼 위에
      남는다 — 다음 화살표가 어디서 출발하는지 알 수 없게 된다.
    */
    document.getElementById(tabId(next))?.focus()
  }

  return (
    /*
      **화살표는 탭 버튼이 받는다** — `tablist` 자신이 아니다. 컨테이너에 키 핸들러를 달면
      포커스를 못 받는 요소가 키보드를 다루게 되고(`jsx-a11y/interactive-supports-focus`),
      실제로 키가 오는 곳은 포커스를 가진 **탭** 이다.
    */
    <div
      role="tablist"
      aria-label={messages.aiPlan.pickerTabsLabel}
      className="flex min-w-0 items-center gap-1"
    >
      {TABS.map((value) => {
        const active = value === current

        return (
          <button
            key={value}
            type="button"
            role="tab"
            id={tabId(value)}
            aria-selected={active}
            aria-controls={panelId(value)}
            // roving tabindex — 선택된 탭 하나만 탭 키 순서에 남는다
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') move(1)
              else if (event.key === 'ArrowLeft') move(-1)
              else return

              event.preventDefault()
            }}
            className={cn(
              'text-body-2 focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-sm px-1 font-semibold focus-visible:ring-2 focus-visible:outline-none',
              active ? 'text-fg' : 'text-fg-subtle',
            )}
          >
            {value === 'favorites'
              ? messages.aiPlan.pickerFavoritesTab
              : messages.aiPlan.pickerSearchTab}
            {value === 'favorites' && favoritesCount !== undefined && (
              <span className="text-fg-muted ml-1 font-medium tabular-nums">{favoritesCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function tabId(tab: PickerTab): string {
  return `picker-tab-${tab}`
}

function panelId(tab: PickerTab): string {
  return `picker-panel-${tab}`
}

type PanelProps = {
  draft: PinnedPlace[]
  limitReached: boolean
  onToggle: (item: PickerItem) => void
}

/** 저장한 장소 — 기본 탭 */
function FavoritesPanel({
  query,
  ...panel
}: PanelProps & { query: ReturnType<typeof useFavoriteList> }) {
  const errorStatus = toErrorStatus(query.error)
  const places = query.data?.places ?? []

  return (
    <TabPanel tab="favorites">
      {query.isPending ? (
        <PickerSkeleton />
      ) : errorStatus !== null ? (
        <ErrorState
          inset="panel"
          headingLevel={3}
          title={messages.aiPlan.pickerLoadFailedTitle}
          description={messages.favorite.loadFailedDescription}
          onRetry={() => void query.refetch()}
        />
      ) : places.length === 0 ? (
        <EmptyState
          inset="panel"
          headingLevel={3}
          title={messages.aiPlan.pickerEmptyTitle}
          description={messages.aiPlan.pickerEmptyDescription}
        />
      ) : (
        <PickerRowList items={places} {...panel} />
      )}
    </TabPanel>
  )
}

/**
 * 이름으로 찾기 — `GET /places?keyword=` (#431 · 계약은 #421).
 *
 * **검색어를 받기 전에는 조회하지 않는다.** 탭을 여는 것만으로 전체 목록을 한 번 받으면,
 * 사용자가 아직 아무것도 묻지 않았는데 답부터 나오는 셈이다.
 *
 * **`/places` 와 같은 key 를 쓴다** (`usePlaceList`) — 같은 조건을 이미 받아 뒀으면 요청이
 * 아예 나가지 않는다. 필터는 걸지 않는다: 여기서 고르는 것은 "꼭 넣을 장소" 한 곳이고,
 * 그 사람은 이미 이름을 알고 찾아 들어왔다.
 */
function SearchPanel({
  keyword,
  onKeywordChange,
  ...panel
}: PanelProps & {
  keyword: string | null
  onKeywordChange: (keyword: string | null) => void
}) {
  const filters = { ...DEFAULT_PLACE_FILTERS, keyword }
  const query = usePlaceList(filters, keyword !== null)

  const errorStatus = toErrorStatus(query.error)
  const places = query.data === undefined ? [] : mergeSlices(query.data.pages)

  return (
    <TabPanel tab="search">
      <div className={INSET_CLASS.panel}>
        <PlaceKeywordSearchForm value={keyword} onSubmit={onKeywordChange} />
      </div>

      {keyword === null ? (
        /* 아직 묻지 않았다 — 빈 결과가 아니라 **시작점**이라 `EmptyState` 를 쓰지 않는다 */
        <p className={cn('text-caption text-fg-subtle', INSET_CLASS.panel)}>
          {messages.aiPlan.pickerSearchHint}
        </p>
      ) : query.isPending ? (
        <PickerSkeleton />
      ) : errorStatus !== null ? (
        <ErrorState
          inset="panel"
          headingLevel={3}
          title={messages.aiPlan.pickerSearchFailedTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={() => void query.refetch()}
        />
      ) : places.length === 0 ? (
        <EmptyState
          inset="panel"
          headingLevel={3}
          title={messages.place.searchEmptyTitle.replace('{keyword}', keyword)}
          description={messages.aiPlan.pickerSearchEmptyDescription}
        />
      ) : (
        <PickerRowList
          items={places.map((place) => ({
            placeId: place.placeId,
            title: place.title,
            addr: place.addr1,
            indoor: place.indoor,
          }))}
          {...panel}
        />
      )}
    </TabPanel>
  )
}

function TabPanel({ tab, children }: { tab: PickerTab; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={panelId(tab)}
      aria-labelledby={tabId(tab)}
      // 목록이 길어 스크롤될 수 있다 — 패널 자체가 포커스를 받아야 키보드로 훑을 수 있다
      tabIndex={0}
      className="flex flex-col gap-3 focus-visible:outline-none"
    >
      {children}
    </div>
  )
}

function PickerSkeleton() {
  return (
    <div className={cn('flex flex-col gap-2', INSET_CLASS.panel)}>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  )
}

/**
 * 고를 수 있는 행들 — **두 탭이 같은 것을 쓴다.**
 *
 * **`RowList`+`Row` → `SurfaceList`+`li`** (`styling-guide.md` §3-1 대응표, #473).
 * 구분선 규약이 행에서 목록으로 옮겨 가 `last` 가 사라졌다 — `[&>li+li]` 는 인접
 * 형제에만 걸리므로 행 수를 아는 호출자가 아니어도 목록을 그릴 수 있다.
 *
 * **선택 표시는 `--row-selected` 채움 그대로다.** `Row` 의 `selected` 가 실제로
 * 그리던 것이 이 tint 하나였고(높이도 테두리도 건드리지 않는다) §0 이 금지하는
 * 것은 **아이템 테두리**라, 채움은 그대로 옮겨도 규칙에 걸리지 않는다.
 * `--band` 로 바꾸지 않는다 — `DESIGN.md §2` 가 `--band` 를 "아이템 채움 · 태그 ·
 * 스켈레톤" 의 **중립** 채움으로, `--row-selected` 를 "선택된 행 tint" 로 갈라
 * 두었고, 이 저장소의 선택 표시 네 곳(`radio-group` · `pet-checkbox-group` ·
 * `place-map-panel` · `emergency-map-panel`)이 전부 후자를 쓴다. 여기만 `--band`
 * 로 가면 같은 뜻에 두 색이 생기고, 중립 채움과도 구분되지 않는다.
 * **체크박스에만 맡기지 않는 이유**는 상한이 10곳이라 고른 것을 한눈에 세어야
 * 하기 때문이다 — 체크 표시는 20px 한 점이고 tint 는 행 전체다.
 */
function PickerRowList({
  items,
  draft,
  limitReached,
  onToggle,
}: PanelProps & { items: readonly PickerItem[] }) {
  return (
    <SurfaceList>
      {items.map((item) => {
        const pinnable = isPinnable(item.title)
        const checked = draft.some((place) => place.placeId === item.placeId)

        return (
          <li key={item.placeId} className={cn(INSET_CLASS.panel, checked && 'bg-row-selected')}>
            {/*
              라벨 전체가 터치 대상이다. 행에 링크를 두지 않는다 — 여기서 할 일은
              고르기이고, 장소를 확인하러 나가면 고른 것이 사라진다.
            */}
            {/*
              **grid 로 평평하게 둔다.** 텍스트를 `span > span` 으로 감싸면
              `jsx-a11y/label-has-associated-control` 이 라벨의 접근 이름을 찾지
              못한다(기본 depth 2). 체크박스가 두 줄을 세로로 걸치는 배치라
              flex + 열 래퍼가 자연스러웠지만, 규칙을 끄는 대신 마크업을 편다.
            */}
            <label
              htmlFor={`pinned-${item.placeId}`}
              className={
                pinnable
                  ? 'grid min-h-14 cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 py-3'
                  : 'grid min-h-14 grid-cols-[auto_1fr] items-center gap-x-3 py-3 opacity-60'
              }
            >
              <input
                type="checkbox"
                id={`pinned-${item.placeId}`}
                checked={checked}
                /*
                  상한에 닿으면 **아직 고르지 않은 행만** 막는다. 고른 행은 계속
                  해제할 수 있어야 한다 — 10곳을 채운 뒤 바꿀 길이 없어진다.
                */
                disabled={!pinnable || (limitReached && !checked)}
                onChange={() => onToggle(item)}
                className="accent-brand-500 focus-visible:ring-brand-500 row-span-2 size-5 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
              />

              <span className="text-body-2 text-fg min-w-0 truncate font-medium">
                {pinnable ? item.title : messages.favorite.missingTitle}
              </span>
              <span className="text-caption text-fg-muted min-w-0 truncate">
                {pinnable
                  ? (placeMetaLine(item.addr, item.indoor) ?? '')
                  : messages.aiPlan.pickerUnpinnable}
              </span>
            </label>
          </li>
        )
      })}
    </SurfaceList>
  )
}

/**
 * 시트 안 검색 입력.
 *
 * **`/places` 의 `PlaceSearchField` 와 나누지 않았다.** 저쪽은 URL 을 바꾸는 것이 일이고
 * (`usePlaceFilterNav`) 여기는 시트 안 상태를 바꾼다 — 같은 것은 입력 모양뿐이라, 합치면
 * "URL 을 쓸지" 를 prop 으로 가르는 컴포넌트가 된다. **정규화 규칙은 공유한다**
 * (`normalizeKeyword`) — 갈리면 같은 말이 화면마다 다르게 취급된다.
 */
function PlaceKeywordSearchForm({
  value,
  onSubmit,
}: {
  value: string | null
  onSubmit: (keyword: string | null) => void
}) {
  const [text, setText] = useState(value ?? '')

  return (
    <form
      role="search"
      aria-label={messages.aiPlan.pickerSearchTab}
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(normalizeKeyword(text))
      }}
    >
      <label htmlFor="picker-keyword" className="sr-only">
        {messages.place.searchLabel}
      </label>
      <Input
        id="picker-keyword"
        value={text}
        onValueChange={setText}
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
