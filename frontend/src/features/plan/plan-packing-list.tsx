'use client'

import { useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/badge'
import { Button, type ButtonVariant } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { CloseIcon } from '@/components/icons'
import { Input } from '@/components/input'
import { Skeleton } from '@/components/skeleton'
import { planKeys } from '@/features/plan/queries'
import { usePlanPackingList } from '@/features/plan/use-plan-packing'
import { generatePackingList } from '@/lib/api/ai-plan'
import {
  addPackingItem,
  deletePackingItem,
  savePackingItems,
  setPackingItemChecked,
} from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import {
  groupByCategory,
  hasAiItems,
  isUserPackingItem,
  packingAddErrorMessage,
  type PackingAddValues,
  packingCategories,
  toPackingAddPayload,
  toPackingSavePayload,
  validatePackingAdd,
  withCheckedItem,
} from '@/lib/plan/packing'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlanPackingDetailItem, PlanPackingListResponse } from '@/types/plan'

/**
 * 반려견 여행 준비물 (#155 생성 · **#586 저장**).
 *
 * **`useQuery` 다.** 예전에는 `useMutation` 이었고 그 근거가 *"POST 이고 결과가 저장되지
 * 않아 조회로 캐시할 것이 없다"* 였는데, plan-service 가 결과를 보관하게 되면서
 * (`GET /plans/{planId}/packing-items`) 조회가 됐다.
 *
 * **읽기 우선이다.** 상세에 들어오면 저장된 목록부터 읽고, 비어 있고 `generatedAt` 이
 * null 일 때만 AI 생성을 권한다 — *"items 가 있으면 LLM 을 다시 돌리지 않습니다"* 가
 * 서버가 적어 둔 흐름이다. 예전에는 상세를 열 때마다 수십 초짜리 LLM 이 다시 돌았다.
 *
 * 갈래 판정(`shouldOfferGeneration` · `hasAiItems`)은 `lib/plan/packing.ts` 가 갖는다 —
 * 훅을 든 컴포넌트는 provider 없이 렌더할 수 없어, 여기 두면 테스트가 갈래를 못 본다.
 */
export function PlanPackingList({
  planId,
  preview = false,
}: {
  planId: string
  preview?: boolean
}) {
  const queryClient = useQueryClient()
  const key = planKeys.packing(planId)

  /** 체크·삭제 실패 문구. 두 동작 모두 응답이 목록이 아니라 되돌림·재조회로 처리한다 */
  const [actionError, setActionError] = useState<string | null>(null)

  const list = usePlanPackingList(planId)

  /** 저장·추가 응답은 **목록 전체**라 다시 조회하지 않는다 (`updatePlan` 과 같은 처리) */
  function apply(next: PlanPackingListResponse) {
    queryClient.setQueryData(key, next)
  }

  /*
    **생성과 저장이 한 mutation 이다.** 둘을 갈라 두면 생성은 됐는데 저장만 실패한 상태가
    화면에 남고, 그때 목록은 보이는데 새로고침하면 사라진다 — #586 이 없애려던 바로 그
    증상이다. 실패하면 통째로 실패로 보이고 `다시` 가 생성부터 다시 한다.

    생성은 여전히 **동기 · 수십 초**다. 그것을 비동기 잡으로 바꾸는 것은 #590 이고,
    바뀌면 이 `mutationFn` 안의 첫 줄만 갈아끼우면 된다.
  */
  const generate = useMutation({
    mutationFn: async () => {
      const created = await generatePackingList(planId)
      return savePackingItems(planId, toPackingSavePayload(created.items))
    },
    onSuccess: apply,
  })

  const add = useMutation({
    mutationFn: (values: PackingAddValues) => addPackingItem(planId, toPackingAddPayload(values)),
    onSuccess: apply,
  })

  const remove = useMutation({
    mutationFn: (packingItemId: string) => deletePackingItem(planId, packingItemId),
    /** 응답이 `Void` 라 갱신된 목록이 없다 — 다시 읽는다 */
    onSuccess: () => {
      setActionError(null)
      void queryClient.invalidateQueries({ queryKey: key })
    },
    onError: () => setActionError(messages.plan.packingRemoveError),
  })

  /*
    **체크는 낙관적으로 먼저 그린다.** 응답이 `Void` 라 목록이 오지 않고, 왕복을 기다리면
    체크박스가 한 박자 늦게 켜진다 — 짐을 싸며 연달아 누르는 자리라 그 지연이 그대로
    "안 눌렸다" 로 읽힌다. 실패하면 **되돌리고 되돌렸다고 말한다.**
  */
  const check = useMutation({
    mutationFn: ({ packingItemId, checked }: { packingItemId: string; checked: boolean }) =>
      setPackingItemChecked(planId, packingItemId, { checked }),
    onMutate: ({ packingItemId, checked }) => {
      setActionError(null)
      const previous = queryClient.getQueryData<PlanPackingListResponse>(key)
      if (previous !== undefined) apply(withCheckedItem(previous, packingItemId, checked))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) apply(context.previous)
      setActionError(messages.plan.packingCheckError)
    },
  })

  return (
    <PackingListPanel
      preview={preview}
      list={list.data ?? null}
      loading={list.isPending}
      failed={list.isError}
      onReload={() => void list.refetch()}
      generating={generate.isPending}
      generateFailed={generate.isError}
      onGenerate={() => generate.mutate()}
      onToggleChecked={(packingItemId, checked) => check.mutate({ packingItemId, checked })}
      onRemove={(packingItemId) => remove.mutate(packingItemId)}
      onAdd={(values) => add.mutate(values)}
      adding={add.isPending}
      addError={add.isError ? packingAddErrorMessage(add.error) : null}
      actionError={actionError}
    />
  )
}

/**
 * 요약 모드에서 직접 보여 주는 항목 수 (#732).
 *
 * **다섯이면 "무엇이 들어 있는 목록인지" 가 읽힌다.** 그보다 많으면 승격된 카드가 개요보다
 * 길어져 그날 이 화면을 연 사람이 브리핑에 닿기 전에 짐 목록을 다 지나야 한다 — 나머지는
 * `전체 보기` 가 편다.
 */
export const PACKING_PREVIEW_MAX_ITEMS = 5

export type PackingListPanelProps = {
  /**
   * 요약 모드 (#732). **승격 자리(위 레일)에서만 켠다** — 진행률 한 줄과 항목 몇 개로
   * 줄이고, 나머지·도구는 `전체 보기` 뒤에 둔다.
   *
   * **목록이 비었을 때는 애초에 승격하지 않으므로**(`packingPlacement`) 이 모드에서 빈
   * 상태를 그릴 일이 없다 — 그래도 갈래를 없애지는 않는다: 카드가 올라간 뒤 마지막 항목을
   * 지우면 같은 프레임에서 빈 목록이 요약 모드로 그려진다.
   */
  preview?: boolean
  /** 저장된 목록. **`null` 은 "비었다" 가 아니라 "아직 못 읽었다"** 다 */
  list: PlanPackingListResponse | null
  loading: boolean
  failed: boolean
  onReload: () => void
  generating: boolean
  generateFailed: boolean
  onGenerate: () => void
  onToggleChecked: (packingItemId: string, checked: boolean) => void
  onRemove: (packingItemId: string) => void
  onAdd: (values: PackingAddValues) => void
  adding: boolean
  /** 직접 추가 실패 문구. `PLAN_012` · `PLAN_013` 를 갈라 말한다 */
  addError: string | null
  /** 체크·삭제 실패 문구 */
  actionError: string | null
}

/**
 * 표현 전용. **호출을 갖지 않는다** — 이 저장소의 테스트는 jsdom 없이
 * `renderToStaticMarkup` 문자열로 검증하므로, 훅을 든 컴포넌트는 provider 없이 렌더할 수
 * 없다. `PlanDetailView` → `PlanDetailSection` 과 같은 나눔이다.
 * (`useState` 는 폼 입력용으로만 쓰고, 그것은 정적 렌더에서도 성립한다.)
 */
export function PackingListPanel(props: PackingListPanelProps) {
  const { list } = props
  return (
    /*
      **카드 안 내용이다** (#447). 카드(`Surface`)와 그 이름(`aria-label`)은 호출부
      (`plan-detail-section.tsx`)가 만든다 — 여기서 `section` 을 또 열면 랜드마크가 겹친다.
      인셋은 카드 값(16/20)이다.
    */
    <div className={cn('flex flex-col gap-3 py-4 md:py-5', INSET_CLASS.card)}>
      {/*
        **제목 옆에 AI 배지를 둔다** (#397). accent 는 "AI 가 생성·판단한 것" 표시
        전용이고(DESIGN.md §2-5), 헤더 nav 의 `AI 일정 생성` 배지와 **같은 낱말·같은
        톤**이어야 한다.

        **저장이 붙어도 배지를 걷지 않는다** (#586). 항목을 고르는 주체는 여전히 AI 이고,
        직접 추가한 항목만 그 행에서 `직접 추가` 로 따로 밝힌다.

        `lg:` 승급과 `items-center` 정렬의 근거는 #358 — 같은 레일의 `h1` 과 값이 겹치지
        않게 하고, 제목이 22 로 커질 때 배지가 아래로 떨어지지 않게 한다.
      */}
      <div className="flex items-center gap-2">
        <h2 className="text-title-2 text-fg lg:text-title-1 font-semibold lg:font-bold">
          {messages.plan.packingHeading}
        </h2>
        <Badge tone="accent" size="sm" className="font-semibold">
          {messages.plan.packingAiBadge}
        </Badge>
        {/*
          **챙김 요약이 제목 줄 끝에 선다.** 목록을 다 펼쳐 세지 않아도 남은 것이 있는지
          읽힌다. `0 / 12` 도 그린다 — 아직 아무것도 안 챙겼다는 것도 사실이다.
        */}
        {list !== null && list.items.length > 0 && (
          <span className="text-caption text-fg-muted ml-auto font-semibold tabular-nums">
            {messages.plan.packingCheckedSummary
              .replace('{checked}', String(list.checkedCount))
              .replace('{total}', String(list.items.length))}
          </span>
        )}
      </div>

      <Body {...props} />
    </div>
  )
}

function Body(props: PackingListPanelProps) {
  const { list, loading, failed, onReload, generating } = props

  if (generating) return <Pending />
  if (loading) return <PanelSkeleton />

  /*
    조회 실패는 화면 전체가 아니라 이 절만 덮는다 — 일정 본문은 그대로 쓸모가 있다.
    **404 가 아니다**: 없는 일정·남의 일정이면 상세 자체가 이미 404 로 갈렸다.
  */
  if (failed || list === null) {
    return (
      <ErrorState inset="card" title={messages.plan.packingLoadErrorTitle} onRetry={onReload} />
    )
  }

  /*
    **빈 목록은 갈래가 하나다.** 서버가 `items` 가 비면 `generatedAt` 도 null 로 주므로
    ("AI 항목이 하나도 없으면 null") 화면이 "아직 안 만들었다" 와 "만들고 다 지웠다" 를
    구분할 방법이 없다 — 구분하는 척하지 않고 둘 다 생성을 권한다.
  */
  if (list.items.length === 0) return <Intro {...props} />

  return <Result {...props} list={list} />
}

/** 조회 대기. 성공 모습(분류 머리 + 항목들)과 같은 골격이라 자리가 흔들리지 않는다 */
function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-5 w-3/5" />
    </div>
  )
}

/** 생성 대기. **시간을 먼저 말한다** — 동기 호출이라 기다리는 것 말고 할 일이 없다 */
function Pending() {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      <p className="text-body-2 font-semibold">{messages.plan.packingPending}</p>
      <p className="text-caption text-fg-muted font-medium">{messages.plan.packingPendingNote}</p>
    </div>
  )
}

/** 아직 만든 적 없다 — `generatedAt` 이 null 인 갈래 하나뿐이다 */
function Intro(props: PackingListPanelProps) {
  const { generateFailed, onGenerate } = props

  /*
    AI 를 부르기 전에도 직접 적어 둘 수 있다 — 그 항목은 생성·재생성에도 남는다.

    **생성 실패 갈래에도 선다.** 생성이 막힌 사람에게는 직접 적는 것이 준비물을 남기는
    유일한 길이라, 그 갈래에서 빼면 화면이 할 수 있는 일을 감추는 것이 된다.

    **`secondary` 는 여기서만이다** (#841). 빈 카드에서는 이 버튼이 CTA 와 나란히 선
    **두 번째 진입점**이라 테두리를 갖는다 — `ghost` 는 맨텍스트로 읽혀 절이 미완성처럼
    보였다. `Result` 에서는 같은 버튼이 `ghost` 로 남는다(그쪽 근거는 호출부 주석).
  */
  const addSection = (collapsedClassName: string | undefined) => (
    <AddSection
      {...props}
      categories={[]}
      collapsedVariant="secondary"
      {...(collapsedClassName === undefined ? {} : { collapsedClassName })}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      {/*
        **빈 칸을 메우는 일러스트다** (#841). 결과의 *모양*을 칩으로 미리 보여 주는 안은
        기각했다 — 칩 문구가 실제 AI 응답과 어긋나면 화면이 하지 않은 약속을 한 것이 된다
        (`lib/place/illustration.ts` 가 "우리가 아는 것만 말한다"를 요구한 것과 같은 규율).
        장식이 아니라 자리 채움이므로 `alt=""` 다.
      */}
      <div className="bg-band flex flex-col items-center gap-3 rounded-md px-4 py-6">
        {/*
          저장소 안의 정적 SVG 라 `next/image` 로 최적화할 것이 없다 — `PlaceThumbnail` 이
          카테고리 일러스트를 `<img>` 로 그리는 것과 같은 근거다.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/packing-empty.svg" alt="" width={64} height={56} />
        {/*
          **실패해도 안내 문장을 남긴다.** `ErrorState` 만 남기면 다시 눌렀을 때 무엇이
          만들어지는지 화면에 아무 설명이 없다. `text-fg-muted` 를 쓰지 않는 근거는 #397 —
          이 문장이 CTA 를 누를지 정하는 유일한 근거다. **`packingSavedNote` 는 여기
          없다** (#841): 저장 여부가 실제로 궁금해지는 것은 목록이 생긴 뒤라 `Result` 가
          그 자리를 갖는다.
        */}
        <p className="text-body-2 text-fg text-center break-keep">{messages.plan.packingIntro}</p>
      </div>

      {/*
        생성 실패 코드가 `AIPLAN_016` 하나다 — 일정이 없거나 본인 소유가 아니면 같은
        코드라 화면이 두 경우를 구분해 말하지 않는다.

        **재시도 버튼을 두 개 두지 않는다** — `ErrorState` 가 이미 하나를 갖고 있다.
        **일러스트 면과 안내 문장은 실패해도 남는다** — 다시 눌렀을 때 무엇이 만들어지는지가
        화면에 있어야 한다.
      */}
      {generateFailed ? (
        /*
          **여기서는 접힘 버튼이 `self-start` 를 스스로 든다** — `Result` 와 같은 처리다.
          이 래퍼는 `flex-col` 이라 `align-items` 기본값이 `stretch` 이고, 주지 않으면
          `sm` 버튼이 카드 폭 전체로 늘어나 **바로 위 `다시 시도`(`md`)보다 넓게 선다.**

          래퍼에 `items-start` 를 주는 쪽은 택하지 않았다 — `ErrorState` 루트까지 내용
          폭으로 줄어들어 오류 면이 카드 폭을 잃는다.
        */
        <div className="flex flex-col gap-3">
          <ErrorState inset="card" title={messages.plan.packingErrorTitle} onRetry={onGenerate} />
          {addSection('self-start')}
        </div>
      ) : (
        /*
          **두 진입점이 같은 줄에 나란히 선다** (#841).

          **CTA 는 `primary` 다.** 빈 카드에서 이것이 그 카드의 주요 액션인데
          (`DESIGN.md` §2-4 — 주요 액션은 채운 버튼), `직접 추가` 까지 테두리를 갖게 되면서
          둘의 외형이 똑같아졌다 — 크기(44/32)만으로는 무엇을 먼저 누르는 화면인지 안 읽힌다.

          **행이 `items-center` 를 갖는다.** 높이가 다른 두 버튼(`h-11` · `h-8`)이라
          정렬을 주지 않으면 작은 쪽이 위로 붙어 12px 어긋난다. 그래서 접힘 버튼의
          `self-start` 도 이 갈래에서는 넘기지 않는다 — 넘기면 행의 정렬을 이긴다.
        */
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onGenerate}>{messages.plan.packingCta}</Button>
          {addSection(undefined)}
        </div>
      )}
    </div>
  )
}

/**
 * 저장된 목록. **분류로 묶되 분류를 지어내지 않는다** — 서버가 문자열로 주고 enum 이
 * 아니라서, 모르는 분류가 와도 버리지 않고 온 순서대로 묶는다.
 */
function Result(props: PackingListPanelProps & { list: PlanPackingListResponse }) {
  const { list, onToggleChecked, onRemove, actionError } = props
  const groups = groupByCategory(list.items)
  /** AI 항목이 하나라도 저장돼 있는가. 없으면 이 목록은 사용자가 적은 것뿐이다 */
  const aiBacked = hasAiItems(list)

  /*
    **요약 모드는 펼칠 수 있다** (#732). 승격된 자리에서 처음 보이는 것은 진행률 한 줄과
    항목 몇 개뿐이고, `전체 보기` 가 나머지와 도구(재생성 · 직접 추가)를 연다.

    **자리를 옮기지 않고 같은 카드 안에서 편다.** 눌렀을 때 화면 아래 다른 카드로 보내면
    방금 읽던 목록이 사라진다 — 같은 목록의 나머지를 보는 일이라 이동이 아니다.
  */
  const [expanded, setExpanded] = useState(false)
  if (props.preview === true && !expanded) {
    return (
      <PreviewResult
        list={list}
        onToggleChecked={onToggleChecked}
        onRemove={onRemove}
        actionError={actionError}
        onExpand={() => setExpanded(true)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        **무엇에 근거한 목록인지 결과 머리에서 다시 못박는다** (#397). 목록만 남으면
        어디서든 구할 수 있는 체크리스트와 구분되지 않는다 — 아래 각 항목의 `reason` 이
        그 차이를 증명하지만, 그것을 읽기 전에 기준이 서 있어야 한다.

        **저장된다는 사실이 그 아래 한 줄이다** (#586). 예전에는 반대(`저장되지 않는
        제안이에요`)가 이 자리에 있었다.
      */}
      <div className="flex flex-col gap-1">
        {/*
          **AI 항목이 있을 때만 "AI가 골랐어요" 라고 말한다** — 직접 적어 둔 항목만 있는
          목록에 이 문장을 붙이면 거짓말이 된다. `generatedAt` 이 그 답을 그대로 준다.
        */}
        {aiBacked && (
          <p className="text-body-2 text-accent-700 font-semibold">
            {messages.plan.packingResultBasis}
          </p>
        )}
        <p className="text-caption text-fg-muted font-medium">{messages.plan.packingSavedNote}</p>
      </div>

      {groups.map(([category, group]) => (
        <div key={category} className="flex flex-col gap-1.5">
          <h3 className="text-caption text-fg-muted font-semibold">{category}</h3>
          <ul className="flex flex-col gap-2">
            {group.map((item) => (
              <PackingRow
                key={item.packingItemId}
                item={item}
                onToggleChecked={onToggleChecked}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </div>
      ))}

      {/* 체크·삭제 실패는 항목 옆이 아니라 목록 아래 한자리다 — 어느 행이었는지는 화면이 이미 되돌려 보여 준다 */}
      <FormAlert message={actionError} />

      <div className="flex flex-col gap-1">
        {/*
          **처음 만드는 것과 다시 만드는 것은 다른 말이다.** 직접 적어 둔 항목만 있는
          목록에서 `다시 만들기` 라고 하면 무엇을 다시 만든다는 것인지 알 수 없다.
        */}
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onGenerate}
          className="self-start"
          disabled={props.adding}
        >
          {aiBacked ? messages.plan.packingRetryCta : messages.plan.packingCta}
        </Button>
        {/*
          **무엇이 지워지지 않는지 말한다** (#586). 서버가 AI 항목만 교체하고 사용자 항목과
          같은 이름의 체크는 승계하는데, 그것을 말하지 않으면 직접 적어 둔 것이나 반쯤 싸 둔
          체크를 잃을까 봐 이 버튼을 누르지 못한다.
        */}
        <p className="text-caption text-fg-muted">{messages.plan.packingRegenerateNote}</p>
      </div>

      {/*
        **여기서는 `ghost` 를 지킨다** (#841). 바로 위가 AI 재생성(`ghost sm`)이라 테두리를
        주면 직접 추가가 재생성보다 강하게 선다 — 이 목록에서 더 중요한 것은 AI 쪽이다.
        `flex-col` 부모라 정렬은 버튼이 스스로 갖는다.
      */}
      <AddSection
        {...props}
        categories={packingCategories(list.items)}
        collapsedVariant="ghost"
        collapsedClassName="self-start"
      />
    </div>
  )
}

/**
 * 요약 모드의 결과 (#732 · 진단 665-3).
 *
 * **승격은 내용이 있을 때만 일어난다**(`packingPlacement`). 그렇게 올라온 카드가 해야 할
 * 일은 *"짐을 얼마나 쌌는가"* 에 답하는 것이지 목록 전체를 펴는 것이 아니다 — 출발 전날
 * 화면에서 이 카드가 개요보다 길어지면 그날의 다른 과업(브리핑)이 아래로 밀린다.
 *
 * 그래서 셋만 남긴다: **진행률 한 줄 · 항목 다섯 · `전체 보기`.**
 *
 * **분류 머리를 세우지 않는다.** 다섯 줄을 두세 묶음으로 쪼개면 머리가 항목만큼 많아진다 —
 * 분류는 전체 보기 뒤의 목록이 갖는다.
 *
 * **체크는 여기서도 된다.** 요약이 읽기 전용이면 그날 짐을 싸면서 체크하려고 매번 펴야 한다.
 */
function PreviewResult({
  list,
  onToggleChecked,
  onRemove,
  actionError,
  onExpand,
}: {
  list: PlanPackingListResponse
  onToggleChecked: PackingListPanelProps['onToggleChecked']
  onRemove: PackingListPanelProps['onRemove']
  actionError: string | null
  onExpand: () => void
}) {
  const shown = list.items.slice(0, PACKING_PREVIEW_MAX_ITEMS)

  return (
    <div className="flex flex-col gap-3">
      {/*
        **진행률을 문장으로 쓴다.** 제목 줄 끝의 `3 / 12 챙김` 은 훑는 눈에 걸리라고 둔
        작은 값이고, 승격된 자리에서는 이 카드가 답하는 질문 자체라 본문 첫 줄이다.
      */}
      <p className="text-body-2 text-fg font-semibold tabular-nums">
        {messages.plan.packingProgress
          .replace('{total}', String(list.items.length))
          .replace('{checked}', String(list.checkedCount))}
      </p>

      <ul className="flex flex-col gap-2">
        {shown.map((item) => (
          <PackingRow
            key={item.packingItemId}
            item={item}
            onToggleChecked={onToggleChecked}
            onRemove={onRemove}
          />
        ))}
      </ul>

      <FormAlert message={actionError} />

      {/*
        **항목이 다섯 이하여도 남긴다.** 이 버튼이 여는 것은 나머지 항목만이 아니라 도구
        (재생성 · 직접 추가)이기도 하다 — 다섯 개짜리 목록에서 버튼이 사라지면 승격된 동안
        준비물을 **더할 방법이 없어진다.**
      */}
      <Button variant="ghost" size="sm" onClick={onExpand} className="self-start">
        {messages.plan.packingExpandAction}
      </Button>
    </div>
  )
}

/**
 * 항목 한 줄. **품목 이름이 체크박스의 라벨이다** — 챙기는 대상이 곧 누르는 대상이라
 * 라벨을 따로 세우면 체크박스가 무엇을 가리키는지 이름 없이 떠 있게 된다.
 *
 * **이유는 `Checkbox` 의 `description` 으로 넘기지 않는다.** 그 자리는 `text-caption
 * text-fg-muted` 로 고정돼 있는데, 이유를 caption 에서 `body-2` 로 올린 것이 #397 의
 * 결론이었다 — 이 기능이 다른 체크리스트와 다른 유일한 지점이 가장 작은 글자로 서
 * 있었다. 라벨 아래 같은 열에 직접 그린다.
 */
function PackingRow({
  item,
  onToggleChecked,
  onRemove,
}: {
  item: PlanPackingDetailItem
  onToggleChecked: (packingItemId: string, checked: boolean) => void
  onRemove: (packingItemId: string) => void
}) {
  /*
    **이유가 이 기능의 핵심이다.** 일반적인 준비물 목록이 아니라 이 여행의 예보·일정·
    반려견에 근거한 문장이고, 서버가 완성형으로 준다 — 접거나 줄이지 않는다
    (styling-guide.md §7).

    **직접 추가한 항목은 이유가 null 이다.** 빈 자리로 두지 않고 그것이 실패가 아니라는
    것을 말한다 — "AI 가 이유를 못 냈다" 와 다른 사실이다.
  */
  const reason = isUserPackingItem(item) ? messages.plan.packingUserNoReason : (item.reason ?? null)

  return (
    <li className="flex flex-col">
      <div className="flex items-start gap-2">
        <Checkbox
          id={`packing-${item.packingItemId}`}
          label={item.name}
          checked={item.checked}
          onCheckedChange={(checked) => onToggleChecked(item.packingItemId, checked)}
          className="min-w-0 flex-1"
        />
        {isUserPackingItem(item) && (
          <Badge tone="neutral" size="sm" className="mt-3 shrink-0">
            {messages.plan.packingUserBadge}
          </Badge>
        )}
        {/* icon-only 라 `aria-label` 이 접근 가능한 이름이다 (D6). 높이 44 는 이 자리의 선택이다 */}
        <button
          type="button"
          onClick={() => onRemove(item.packingItemId)}
          aria-label={messages.plan.packingRemoveLabel.replace('{name}', item.name)}
          className="text-fg-muted hover:text-fg focus-visible:ring-brand-500 inline-flex h-11 w-11 shrink-0 items-center justify-center focus-visible:ring-2 focus-visible:outline-none"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      {/*
        **라벨과 같은 열에 세운다.** `pl-8` 은 체크박스 상자(20) + `Checkbox` 안의
        `gap-3`(12) 이다 — 이유가 상자 아래로 흘러내리면 어느 품목의 근거인지 흐려진다.
      */}
      {reason !== null && <span className="text-body-2 text-fg-muted -mt-1 pl-8">{reason}</span>}
    </li>
  )
}

/**
 * 직접 추가. **접어 둔다** — 목록을 읽는 것이 이 절의 주된 일이고, 빈 입력 두 칸이 늘
   펼쳐져 있으면 목록보다 폼이 먼저 읽힌다.
 */
function AddSection({
  onAdd,
  adding,
  addError,
  categories,
  collapsedVariant,
  collapsedClassName,
}: PackingListPanelProps & {
  categories: string[]
  /**
   * 접힘 버튼의 외형 — **호출부가 정한다** (#841).
   *
   * 같은 버튼이 두 자리에 서는데 **옆에 선 것이 다르다.** 빈 카드에서는 CTA 와 나란한
   * 두 번째 진입점이라 테두리가 필요하고, `Result` 에서는 바로 위가 AI 재생성이라
   * 테두리를 주면 **재생성보다 강하게 선다.** 하나로 고정하면 한쪽이 반드시 틀린다.
   */
  collapsedVariant: ButtonVariant
  /**
   * 접힘 버튼의 정렬. **부모가 row 인지 column 인지에 따라 갈린다** — row 면 행이
   * `items-center` 로 정렬을 갖고, column 이면 버튼이 `self-start` 로 스스로 갖는다.
   */
  collapsedClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<PackingAddValues>({ category: '', name: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!open) {
    return (
      <Button
        variant={collapsedVariant}
        size="sm"
        onClick={() => setOpen(true)}
        {...(collapsedClassName === undefined ? {} : { className: collapsedClassName })}
      >
        {messages.plan.packingAddAction}
      </Button>
    )
  }

  function submit() {
    const validation = validatePackingAdd(values)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    onAdd(values)
    setValues({ category: '', name: '' })
  }

  return (
    /*
      **`w-full` 이 필요하다** (#841). 접힘 버튼이 빈 상태에서 CTA 와 같은 `flex flex-wrap`
      줄에 서게 되면서, 펼친 폼도 그 줄의 flex item 이 된다 — 폭을 주지 않으면 입력 두 칸이
      콘텐츠 폭으로 쪼그라든다. `flex-col` 부모(`Result`)에서는 stretch 가 기본이라 무해하다.
    */
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-body-2 text-fg font-semibold">{messages.plan.packingAddTitle}</p>
        {/* 서버가 `reason` 을 받지 않는 이유를 그대로 옮긴다 — 이유 칸이 없는 것에 대한 답이다 */}
        <p className="text-caption text-fg-muted">{messages.plan.packingAddHint}</p>
      </div>

      <Field
        id="packing-add-category"
        label={messages.plan.packingAddCategoryLabel}
        required
        // 같은 이름을 쓰면 같은 묶음으로 붙는다 (서버 스키마 설명). 쓸 수 있는 값을 알려 준다
        {...(categories.length === 0
          ? {}
          : {
              hint: messages.plan.packingAddCategoryHint.replace(
                '{categories}',
                categories.join(' · '),
              ),
            })}
        {...(errors.category === undefined ? {} : { error: errors.category })}
      >
        <Input
          id="packing-add-category"
          value={values.category}
          onValueChange={(category) => setValues((prev) => ({ ...prev, category }))}
          placeholder={messages.plan.packingAddCategoryPlaceholder}
          invalid={errors.category !== undefined}
          // 서버 상한과 같은 값이다 — 잘리는 자리를 서버가 아니라 입력이 먼저 알려 준다
          maxLength={30}
        />
      </Field>

      <Field
        id="packing-add-name"
        label={messages.plan.packingAddNameLabel}
        required
        {...(errors.name === undefined ? {} : { error: errors.name })}
      >
        <Input
          id="packing-add-name"
          value={values.name}
          onValueChange={(name) => setValues((prev) => ({ ...prev, name }))}
          placeholder={messages.plan.packingAddNamePlaceholder}
          invalid={errors.name !== undefined}
          maxLength={100}
        />
      </Field>

      {/* 중복 이름(`PLAN_012`)과 50개 초과(`PLAN_013`)는 사용자가 할 일이 달라 갈라 말한다 */}
      <FormAlert message={addError} />

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={adding}>
          {messages.plan.packingAddSubmit}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          {messages.plan.packingAddCancel}
        </Button>
      </div>
    </div>
  )
}
