'use client'

import { useEffect, useRef, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { AI_PLAN_JOB_QUERY_OPTIONS, aiPlanKeys } from '@/features/ai-plan/queries'
import { jobPollInterval, jobPollPhase, shouldKeepPolling } from '@/lib/ai-plan/job'
import { fetchAiPlanJob } from '@/lib/api/ai-plan'

/** 경과 시간을 갱신하는 주기. 국면(30초·90초) 판정만 하므로 초 단위로 충분하다 */
const TICK_MS = 1000

/**
 * 작업 폴링 — 명세 S4.
 *
 * **경과 시간을 화면이 세야 한다.** 서버가 남은 시간을 주지 않으므로(명세 S2) 30초·90초
 * 국면은 **구독을 시작한 시점**을 기준으로 잰다. `jobId` 가 바뀌면 다시 0부터 센다.
 *
 * 새로고침하면 경과 시간이 0으로 돌아간다. **그것이 맞다** — 상한 90초는 "이 화면이
 * 얼마나 기다렸나" 에 대한 약속이고, 다시 확인하기를 누른 사용자에게는 다시 기다려 볼
 * 여지를 주는 것이 낫다.
 */
export function useAiPlanJob(jobId: string) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAt = useRef<number | null>(null)
  const watchedJobId = useRef(jobId)

  /*
    `jobId` 가 바뀌면 시계를 처음부터 다시 센다. **렌더 중에 조정한다** — effect 로
    미루면 한 프레임 동안 이전 작업의 경과 시간이 보인다.
  */
  if (watchedJobId.current !== jobId) {
    watchedJobId.current = jobId
    startedAt.current = null
    setElapsedMs(0)
  }

  const query = useQuery({
    queryKey: aiPlanKeys.job(jobId),
    queryFn: () => fetchAiPlanJob(jobId),
    staleTime: AI_PLAN_JOB_QUERY_OPTIONS.staleTime,
    gcTime: AI_PLAN_JOB_QUERY_OPTIONS.gcTime,
    retry: AI_PLAN_JOB_QUERY_OPTIONS.retry,
    /*
      **완료·실패·상한에서 멈춘다.** 멈추지 않는 폴링이 대표 사고다.
      탭이 비활성이면 React Query 기본대로 멈추고 돌아오면 재개된다 (명세 S4).
    */
    refetchInterval: (polled): number | false => jobPollInterval(polled.state.data, elapsedMs),
  })

  const polling = query.data === undefined || shouldKeepPolling(query.data)
  const phase = jobPollPhase(elapsedMs)

  /*
    폴링이 끝났으면 시계도 멈춘다 — 완료된 화면에서 1초마다 리렌더할 이유가 없다.

    `startedAt` 을 ref 에 두는 이유: state 로 두면 초기화가 렌더에 얽혀 `jobId` 가
    바뀔 때 한 프레임 동안 이전 작업의 경과 시간이 보인다.
  */
  useEffect(() => {
    if (!polling || phase === 'exceeded') return

    startedAt.current ??= Date.now()

    const timer = globalThis.setInterval(() => {
      const startedTime = startedAt.current
      if (startedTime === null) return
      setElapsedMs(Date.now() - startedTime)
    }, TICK_MS)

    return () => globalThis.clearInterval(timer)
    /*
      **`jobId` 를 의존성에 넣는다.** 리셋을 별도 effect 로 분리하면 `jobId` 만 바뀌고
      `polling`·`phase` 가 그대로일 때 이 effect 가 재실행되지 않아 `startedAt` 이
      `null` 로 남고, 매 tick 이 early return 해 **경과 시간이 영구히 0** 이 된다 —
      30초 안내와 90초 상한이 절대 발동하지 않는다.
    */
  }, [jobId, polling, phase])

  return {
    query,
    /** 폴링 국면 — `normal` / `slow` / `exceeded` */
    phase,
    /** 아직 결과를 기다리는 중인가 (상한 초과와 무관하게 작업 자체의 상태다) */
    polling,
    /** 상한 초과 후 `다시 확인하기`. 시계도 다시 돌린다 */
    recheck: () => {
      startedAt.current = null
      setElapsedMs(0)
      void query.refetch()
    },
  }
}
