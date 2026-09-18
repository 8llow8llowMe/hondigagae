'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { planKeys } from '@/features/plan/queries'
import { markItemVisited } from '@/lib/api/plan'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import { toVisitToggleError } from '@/lib/plan/visit-error'

/**
 * 항목 방문 체크 토글 — 이슈 #124.
 *
 * **낙관적 업데이트를 하지 않는다** (`api-integration-guide.md` §7). 응답이
 * `Response<Void>` 라 갈아끼울 상세가 없고, `PLAN_005` 처럼 재시도로 풀리지 않는
 * 실패가 있어 롤백이 잦다. 그래서 왕복(PUT → 상세 재조회)이 끝날 때까지 **그 행만**
 * 잠긴다.
 *
 * **일괄 교체와 달리 항목별로 동시에 진행할 수 있다.** 담기·순서편집은 일자 하나를
 * 통째로 덮어써서 두 요청이 겹치면 한쪽이 사라지지만, 방문 체크는 항목 한 행만 바꾸므로
 * 서로 충돌하지 않는다 (`PlanCommandProcessor.markItemVisited` 는 그 항목만 save 한다).
 * 그래서 전역 잠금이 아니라 **`planItemId` 집합**으로 진행 상태를 든다.
 */
export type PlanVisitState = {
  /** 저장 중인 항목. 그 행의 토글만 잠긴다 */
  pending: ReadonlySet<string>
  /** 실패한 항목. **행마다 따로 든다** — 좁히지 않으면 안 누른 행에도 오류가 남는다 */
  failures: ReadonlyMap<string, PlanDaySaveError>
  toggle: (planItemId: string, visited: boolean) => void
}

export function usePlanVisit({ planId }: { planId: string }): PlanVisitState {
  const queryClient = useQueryClient()

  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const [failures, setFailures] = useState<ReadonlyMap<string, PlanDaySaveError>>(() => new Map())

  /*
    disabled 반영 전 빠른 연속 클릭을 막는다 (`form-guide.md` §6). **`pending` state 를
    보고 판단할 수 없다** — 같은 tick 안의 두 번째 클릭은 아직 갱신되지 않은 값을 읽는다.
  */
  const inFlight = useRef<Set<string>>(new Set())

  const toggle = useCallback(
    (planItemId: string, visited: boolean) => {
      if (inFlight.current.has(planItemId)) return
      inFlight.current.add(planItemId)

      setPending((current) => new Set(current).add(planItemId))
      setFailures((current) => {
        if (!current.has(planItemId)) return current
        const next = new Map(current)
        next.delete(planItemId)
        return next
      })

      /*
        **`.then(onSuccess, onError)` 2인자 형태다.** `.then().catch()` 체인이면 성공
        후처리(무효화)에서 던진 예외가 저장 실패로 분류돼 **서버는 저장했는데 화면이
        "저장하지 못했어요" 를 낸다** — 담기 훅에서 같은 함정을 주석으로 남겨 뒀다.
      */
      void markItemVisited(planId, planItemId, visited)
        .then(
          () => {
            /*
              **무효화가 유일한 갱신 경로다.** 응답이 `Response<Void>` 라 `setQueryData`
              로 갈아끼울 상세가 없다.

              **판정(`planKeys.weather`)은 무효화하지 않는다.** 그날 판정은 첫 장소 항목을
              기준으로 하는데(컨트롤러 설명) 방문 체크는 항목 구성·순서를 바꾸지 않는다.
              담기·순서편집이 판정을 다시 받는 것과 갈리는 지점이다.

              **`planKeys.walkSafety` 도 같은 이유로 무효화하지 않는다** (#625 · D15-6).
              방문 체크는 `planItemId`·`startTime`·장소를 바꾸지 않으므로 그 항목의
              산책 위험도 판정도 그대로 유효하다.
            */
            void queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) })
          },
          (cause: unknown) =>
            setFailures((current) => new Map(current).set(planItemId, toVisitToggleError(cause))),
        )
        .finally(() => {
          inFlight.current.delete(planItemId)
          setPending((current) => {
            const next = new Set(current)
            next.delete(planItemId)
            return next
          })
        })
    },
    [planId, queryClient],
  )

  return { pending, failures, toggle }
}
