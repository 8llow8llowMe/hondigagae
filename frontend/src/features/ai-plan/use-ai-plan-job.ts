'use client'

import { useEffect, useRef, useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { AI_PLAN_JOB_QUERY_OPTIONS, aiPlanKeys } from '@/features/ai-plan/queries'
import { useAiPlanJobStream } from '@/features/ai-plan/use-ai-plan-job-stream'
import {
  JOB_STREAM_SAFETY_POLL_MS,
  jobPollInterval,
  jobPollPhase,
  shouldKeepPolling,
} from '@/lib/ai-plan/job'
import { mergeJobUpdate } from '@/lib/ai-plan/job-stream'
import { cancelAiPlanJob, fetchAiPlanJob } from '@/lib/api/ai-plan'
import { ApiError } from '@/lib/api/error'
import type { AiPlanJob } from '@/types/ai-plan'

/** 이미 완료·실패해 취소할 것이 없다 — 요청 오류가 아니라 대상의 상태가 지나간 것이다 */
const NOT_CANCELABLE = 'AIPLAN_019'

/** 경과 시간을 갱신하는 주기. 국면(안내·상한) 판정만 하므로 초 단위로 충분하다 */
const TICK_MS = 1000

/**
 * 작업 구독 — 명세 S3(SSE) · S4(폴링).
 *
 * **SSE 가 앞에 서고 폴링이 받친다** (#91). 구독이 살아 있는 동안 폴링은 멈추고, 끊기면
 * 2초 폴링이 재개된다 — 둘이 같은 query 캐시를 쓰므로 화면은 출처를 구분하지 않는다.
 *
 * **경과 시간을 화면이 세야 한다.** 서버가 남은 시간을 주지 않으므로(명세 S2) 안내·상한
 * 국면은 **구독을 시작한 시점**을 기준으로 잰다. `jobId` 가 바뀌면 다시 0부터 센다.
 *
 * 새로고침하면 경과 시간이 0으로 돌아간다. **그것이 맞다** — 폴링 상한은 "이 화면이
 * 얼마나 기다렸나" 에 대한 약속이고, 다시 확인하기를 누른 사용자에게는 다시 기다려 볼
 * 여지를 주는 것이 낫다.
 */
export function useAiPlanJob(jobId: string) {
  const queryClient = useQueryClient()
  const streaming = useAiPlanJobStream(jobId)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [canceling, setCanceling] = useState(false)
  const [cancelFailed, setCancelFailed] = useState(false)
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
    // 앞 작업의 취소 실패 문구가 새 작업의 진행 화면에 남지 않게 한다
    setCancelFailed(false)
  }

  const query = useQuery({
    queryKey: aiPlanKeys.job(jobId),
    /*
      **첫 조회는 구독 여부와 무관하게 한 번 돈다.** 구독이 열리기까지의 공백을 메우고,
      스트림이 아예 열리지 않는 환경(프록시가 SSE 를 막는 경우)에서도 화면이 데이터를 받는다.

      늦게 도착한 응답이 구독이 받은 종결 상태를 되돌리지 않게 `mergeJobUpdate` 로 거른다.
    */
    queryFn: async (): Promise<AiPlanJob> => {
      const fetched = await fetchAiPlanJob(jobId)
      const cached = queryClient.getQueryData<AiPlanJob>(aiPlanKeys.job(jobId))
      return mergeJobUpdate(cached, fetched)
    },
    staleTime: AI_PLAN_JOB_QUERY_OPTIONS.staleTime,
    gcTime: AI_PLAN_JOB_QUERY_OPTIONS.gcTime,
    retry: AI_PLAN_JOB_QUERY_OPTIONS.retry,
    /*
      **완료·실패·상한에서 멈춘다.** 멈추지 않는 폴링이 대표 사고다.
      탭이 비활성이면 React Query 기본대로 멈추고 돌아오면 재개된다 (명세 S4).
    */
    refetchInterval: (polled): number | false => {
      const interval = jobPollInterval(polled.state.data, elapsedMs)

      // 종결·상한에서는 구독 여부와 무관하게 멈춘다 — 멈추지 않는 폴링이 대표 사고다
      if (interval === false) return false

      /*
        **구독 중에는 2초 폴링을 끊지만 완전히 끄지는 않는다.** 하트비트가 코멘트 프레임이라
        JS 가 구독의 생존을 볼 수 없어(`JOB_STREAM_SAFETY_POLL_MS`), 반열림 연결에서
        `onerror` 가 오지 않으면 상한까지 화면이 멈춘다. 끊기면 이 값이 다시 2초가 된다.
      */
      return streaming ? JOB_STREAM_SAFETY_POLL_MS : interval
    },
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
      대기 안내와 폴링 상한이 절대 발동하지 않는다.
    */
  }, [jobId, polling, phase])

  /**
   * 그만두기 (#250).
   *
   * **응답을 캐시에 바로 쓴다.** 취소 응답이 취소된 작업 그 자체라 다음 폴링을 기다릴
   * 이유가 없고, SSE 는 `CANCELED` 를 보낸 직후 닫히므로 기다리면 오히려 늦다.
   * `mergeJobUpdate` 를 거치는 이유는 구독이 먼저 종결 상태를 써 뒀을 수 있어서다.
   */
  async function cancel(): Promise<void> {
    setCanceling(true)
    setCancelFailed(false)

    try {
      const canceled = await cancelAiPlanJob(jobId)
      queryClient.setQueryData<AiPlanJob>(aiPlanKeys.job(jobId), (cached) =>
        mergeJobUpdate(cached, canceled),
      )
    } catch (error) {
      /*
        **409 는 오류로 띄우지 않는다.** 취소하려는 사이에 작업이 끝난 것이라 사용자가
        볼 것은 오류가 아니라 **결과**다 — 다시 조회해 완료·실패 화면으로 넘긴다.
      */
      if (error instanceof ApiError && error.resultCode === NOT_CANCELABLE) {
        await query.refetch()
      } else {
        // 그 외에는 작업이 계속 돌고 있다. 진행 화면을 유지한 채 다시 누를 수 있게 한다
        setCancelFailed(true)
      }
    } finally {
      setCanceling(false)
    }
  }

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
    /** 그만두기 — 협조적 취소라 즉시 멈추지 않는다 (#250) */
    cancel: (): void => void cancel(),
    canceling,
    /** 취소 요청 자체가 실패했는가. 작업은 계속 돌고 있다 */
    cancelFailed,
  }
}
