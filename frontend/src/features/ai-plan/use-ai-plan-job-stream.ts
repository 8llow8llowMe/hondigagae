'use client'

import { useEffect, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { aiPlanKeys } from '@/features/ai-plan/queries'
import {
  isTerminalJob,
  JOB_STREAM_EVENT,
  mergeJobUpdate,
  parseJobEvent,
} from '@/lib/ai-plan/job-stream'
import { bffUrl } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type { AiPlanJob } from '@/types/ai-plan'

/**
 * 작업 상태 SSE 구독 — 명세 S3 · 이슈 #91.
 *
 * **폴링을 대체하지 않고 앞에 선다.** 받은 이벤트를 폴링과 **같은 query 캐시**에 써서
 * (`aiPlanKeys.job`) 화면은 출처를 모른다 — `ai-plan-job-view.tsx` 가 바뀌지 않는 이유다.
 *
 * **`EventSource` 로 충분하다.** 스키마는 fetch 기반 SSE 클라이언트를 권하지만 그 이유는
 * `Authorization` 헤더인데, 이 저장소는 BFF 가 토큰을 붙인다(`bffUrl`) — 브라우저는
 * 같은 오리진에 세션 쿠키만 실어 보낸다.
 *
 * @returns 구독이 살아 있는가. `false` 면 호출부가 폴링으로 내려앉아야 한다
 */
export function useAiPlanJobStream(jobId: string): boolean {
  const queryClient = useQueryClient()
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    // SSR·구형 브라우저 — 폴링으로 간다
    if (typeof globalThis.EventSource !== 'function') {
      setStreaming(false)
      return
    }

    const key = aiPlanKeys.job(jobId)
    const source = new globalThis.EventSource(bffUrl(paths.aiPlans.jobStream(jobId)))
    let live = true

    /** 구독을 접고 폴링에 넘긴다. 재연결은 `EventSource` 에 맡기지 않는다 */
    const handOverToPolling = (): void => {
      if (!live) return
      live = false
      source.close()
      setStreaming(false)
    }

    source.onopen = () => {
      if (live) setStreaming(true)
    }

    /*
      **이름 있는 이벤트다.** `onmessage` 로는 오지 않는다 — 백엔드가 `job-update` 로
      보낸다. 25초 하트비트는 코멘트 프레임이라 여기에도 오지 않고, 처리할 것도 없다.
    */
    source.addEventListener(JOB_STREAM_EVENT, (event) => {
      if (!live) return

      const job = parseJobEvent((event as MessageEvent<string>).data)
      // 깨진 프레임 하나로 구독을 끊지 않는다 — 다음 프레임이 정상일 수 있다
      if (job === null) return

      queryClient.setQueryData<AiPlanJob>(key, (cached) => mergeJobUpdate(cached, job))

      /*
        **종결이면 우리가 닫는다.** 백엔드는 종결 상태를 보낸 뒤 `emitter.complete()` 로
        연결을 닫는데, `EventSource` 는 서버가 닫은 연결을 자동 재연결 대상으로 본다 —
        닫지 않으면 재구독 → 종결 스냅샷 → 닫힘이 끝없이 돈다.
      */
      if (isTerminalJob(job)) handOverToPolling()
    })

    /*
      끊김·스트림 아님(스트림 시작 전 오류가 JSON 으로 온 경우)·게이트웨이 미기동이 모두
      여기로 온다. **원인을 가리지 않고 폴링으로 내려앉는다** — 폴링은 오류를 공통 래퍼로
      받아 화면이 이유를 말할 수 있고(404 `AIPLAN_002` 등), BFF 의 재발급도 그 경로에 있다.
    */
    source.onerror = handOverToPolling

    return () => {
      live = false
      source.close()
      setStreaming(false)
    }
  }, [jobId, queryClient])

  return streaming
}
