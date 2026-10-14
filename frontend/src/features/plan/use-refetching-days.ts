'use client'

import { useCallback, useState } from 'react'

/**
 * 상한에서 모달이 닫힌 뒤에도 상세 재조회가 끝나지 않은 일자 — 시각 저장(#1501) · 메모 저장(#1505).
 *
 * 호출부는 이 목록을 `dayItemsSaveLocks` 로 일괄 교체 잠금에 넣는다. 재조회 전 캐시로 나간 교체가
 * 서버의 새 값(시각 · 되살린 `다녀옴`)을 덮지 못하게 한다.
 *
 * `hold` 는 모달 저장 상태(`saving`)가 풀리기 **전에** 부른다 — 둘 사이에 잠금이 비는 렌더가 없게.
 * 재조회가 이미 끝났어도 넣고 곧바로 뺀다. 같은 일자가 여러 번 들 수 있어 하나씩 뺀다.
 */
export function useRefetchingDays() {
  const [refetchingDays, setRefetchingDays] = useState<readonly number[]>([])

  const hold = useCallback((day: number, refetched: Promise<void>) => {
    setRefetchingDays((current) => [...current, day])
    void refetched.then(() =>
      setRefetchingDays((current) => {
        const index = current.indexOf(day)
        return index === -1 ? current : current.filter((_, at) => at !== index)
      }),
    )
  }, [])

  return { refetchingDays, hold }
}
