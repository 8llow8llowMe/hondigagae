'use client'

import { useMutation } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { generatePackingList } from '@/lib/api/ai-plan'
import { messages } from '@/lib/messages'
import type { PackingListItem } from '@/types/ai-plan'

/**
 * 반려견 여행 준비물 — `POST /ai-plans/packing-list/{planId}` (#155).
 *
 * **`useMutation` 이다.** POST 이고 결과가 저장되지 않아 조회로 캐시할 것이 없다 — 같은
 * 일정을 다시 눌러도 다른 목록이 온다. `useQuery` 로 두면 캐시가 "저장된 결과" 처럼 굴어
 * 서버가 보관하지 않는다는 사실과 어긋난다.
 *
 * **동기 API 이고 수십 초가 걸릴 수 있다** (컨트롤러 설명). AI 일정 생성(202 + 폴링)과
 * 달리 잡이 없으므로 대기 상태를 이 컴포넌트가 스스로 그리고, **걸리는 시간을 먼저
 * 말한다** — 아무 안내 없이 30초를 기다리게 하면 사용자는 고장으로 읽는다.
 */
export function PlanPackingList({ planId }: { planId: string }) {
  const generate = useMutation({ mutationFn: () => generatePackingList(planId) })

  return (
    <PackingListPanel
      items={generate.data?.items ?? null}
      pending={generate.isPending}
      failed={generate.isError}
      onGenerate={() => generate.mutate()}
    />
  )
}

export type PackingListPanelProps = {
  /** null 이면 아직 만들지 않았다 */
  items: PackingListItem[] | null
  pending: boolean
  failed: boolean
  onGenerate: () => void
}

/**
 * 표현 전용. **호출을 갖지 않는다** — 이 저장소의 테스트는 jsdom 없이
 * `renderToStaticMarkup` 문자열로 검증하므로, 훅을 든 컴포넌트는 provider 없이 렌더할 수
 * 없다. `PlanDetailView` → `PlanDetailSection` 과 같은 나눔이다.
 */
export function PackingListPanel({ items, pending, failed, onGenerate }: PackingListPanelProps) {
  return (
    <section aria-label={messages.plan.packingHeading} className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        {/*
          **`md:` 가 아니라 `lg:` 다** (#358). 홈의 섹션 제목은 `md:text-title-1` 인데
          (DESIGN.md §3-1), 홈에는 화면 안에 보이는 `h1` 이 없다(sr-only). 여기는 같은
          레일 위에 일정 제목 `h1` 이 서 있어서, md 에서 22 로 올리면 그 `h1`(md 까지
          22)과 같은 값이 된다. `lg` 은 레일이 레일이 되는 지점이고 `h1` 이 28 로
          올라가는 지점이기도 하다 — `place-detail-section` 의 섹션 제목과 같은 변형이다.
        */}
        <h2 className="text-title-2 text-fg lg:text-title-1 font-semibold lg:font-bold">
          {messages.plan.packingHeading}
        </h2>

        {pending ? (
          <Pending />
        ) : items !== null ? (
          <Result items={items} onRetry={onGenerate} />
        ) : (
          <Intro failed={failed} onGenerate={onGenerate} />
        )}
      </div>

      <div aria-hidden className="bg-band h-2 w-full" />
    </section>
  )
}

function Intro({ failed, onGenerate }: { failed: boolean; onGenerate: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {/*
        **실패해도 안내 문장을 남긴다.** `ErrorState` 만 남기면 다시 눌렀을 때 무엇이
        만들어지는지 화면에 아무 설명이 없다.
      */}
      <p className="text-body-2 text-fg-muted">{messages.plan.packingIntro}</p>

      {/*
        실패 코드가 `AIPLAN_016` 하나다 — 일정이 없거나 본인 소유가 아니면 같은 코드로 온다.
        남의 일정을 가리켜도 "없다" 고 답하는 쪽이라 화면이 두 경우를 구분해 말하지 않는다.

        **재시도 버튼을 두 개 두지 않는다** — `ErrorState` 가 이미 하나를 갖고 있어,
        아래 버튼을 함께 남기면 같은 동작의 버튼이 나란히 선다.
      */}
      {failed ? (
        <ErrorState title={messages.plan.packingErrorTitle} onRetry={onGenerate} />
      ) : (
        <Button variant="secondary" onClick={onGenerate} className="self-start">
          {messages.plan.packingCta}
        </Button>
      )}
    </div>
  )
}

/** 대기. **시간을 먼저 말한다** — 동기 호출이라 사용자가 기다리는 것 말고 할 일이 없다 */
function Pending() {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      <p className="text-body-2 font-semibold">{messages.plan.packingPending}</p>
      <p className="text-caption text-fg-muted font-medium">{messages.plan.packingPendingNote}</p>
    </div>
  )
}

/**
 * 결과. **분류로 묶되 분류를 지어내지 않는다** — 서버가 문자열로 주고 enum 이 아니라서,
 * 모르는 분류가 와도 버리지 않고 온 순서대로 묶는다.
 */
function Result({ items, onRetry }: { items: PackingListItem[]; onRetry: () => void }) {
  const groups = groupByCategory(items)

  return (
    <div className="flex flex-col gap-3">
      {/*
        저장되지 않는다는 사실만 밝힌다. **"대표 반려견 기준" 안내가 여기 있었고 #179 로
        걷었다** — 백엔드가 동행 반려견 전체를 근거로 삼게 됐다. 몇 마리가 실제로 근거에
        들어갔는지는 응답이 말해 주지 않아 개수를 대신 적지도 않는다 (`messages/plan.ts` 주석).
      */}
      <p className="text-caption text-fg-muted font-medium">{messages.plan.packingNotSaved}</p>

      {groups.map(([category, group]) => (
        <div key={category} className="flex flex-col gap-1.5">
          <h3 className="text-caption text-fg-muted font-semibold">{category}</h3>
          <ul className="flex flex-col gap-2">
            {group.map((item) => (
              <li key={`${category}-${item.name}`} className="flex flex-col">
                <span className="text-body-2 font-semibold">{item.name}</span>
                {/*
                  **이유가 이 기능의 핵심이다.** 일반적인 준비물 목록이 아니라 이 여행의
                  예보·일정·반려견에 근거한 문장이고, 서버가 완성형으로 준다 — 접거나
                  줄이지 않는다 (styling-guide.md §7).
                */}
                <span className="text-caption text-fg-muted">{item.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={onRetry} className="self-start">
        {messages.plan.packingRetryCta}
      </Button>
    </div>
  )
}

/**
 * 분류별로 묶는다. **서버 순서를 유지한다** — 처음 나온 분류가 먼저다.
 * 알파벳·가나다로 정렬하면 "필수" 가 "날씨 대비" 뒤로 밀린다.
 */
function groupByCategory(items: PackingListItem[]): [string, PackingListItem[]][] {
  const groups = new Map<string, PackingListItem[]>()

  for (const item of items) {
    const group = groups.get(item.category)
    if (group === undefined) groups.set(item.category, [item])
    else group.push(item)
  }

  return [...groups.entries()]
}
