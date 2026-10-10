import type { SliceResponse } from '@/types/api'

/** 커서 기반 페이지들을 하나의 목록으로 합친다 */
export function mergeSlices<T>(pages: readonly SliceResponse<T>[]): T[] {
  return pages.flatMap((page) => page.contents)
}

/** 다음 페이지를 더 불러올 수 있는가. 마지막 페이지의 hasNext 가 기준이다 */
export function hasMore<T>(pages: readonly SliceResponse<T>[]): boolean {
  const last = pages.at(-1)
  return last?.hasNext ?? false
}
