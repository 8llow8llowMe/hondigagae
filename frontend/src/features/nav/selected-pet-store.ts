'use client'

import { create } from 'zustand'

/**
 * 선택된 반려견 — 전역nav-세부명세 D3-1 (확정).
 *
 * **Zustand 인 이유**는 세 가지를 전부 배제하고 남은 것이라서다.
 *  - URL `searchParams` 가 아니다: 모든 화면 URL 에 `petId` 가 붙으면 공유 링크가 지저분해지고,
 *    링크를 받은 사람의 반려견이 아니다
 *  - React Query 가 아니다: 서버가 "선택된 반려견" 을 모른다. 서버 데이터의 복사가 아니다
 *  - `useState` 가 아니다: 헤더와 홈·장소 상세가 같은 선택을 공유해야 한다
 *
 * `localStorage` 에 **`petId` 만** 남긴다. 토큰이 아니므로 허용된다
 * (`auth-guide.md` 는 토큰만 금지한다).
 */
const STORAGE_KEY = 'hdg_selected_pet'

type SelectedPetStore = {
  /** 아직 복원하지 않았으면 `undefined`. 복원했는데 저장값이 없으면 `null` */
  selectedPetId: string | null | undefined
  select: (petId: string) => void
  restore: () => void
}

/**
 * `localStorage` 는 사파리 프라이빗 모드 등에서 던진다. 실패해도 선택은 동작해야 하므로
 * 전부 삼킨다 — 복원이 안 되면 목록의 첫 번째로 떨어질 뿐이다.
 */
function readStored(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function writeStored(petId: string): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, petId)
  } catch {
    // 저장 실패는 무시한다. 이번 세션 동안은 메모리 값으로 동작한다
  }
}

export const useSelectedPetStore = create<SelectedPetStore>((set) => ({
  // 서버 렌더에서는 localStorage 를 읽을 수 없다. undefined 로 두고 마운트 후 복원한다 —
  // 초기값을 읽으려 하면 하이드레이션 불일치가 난다.
  selectedPetId: undefined,
  select: (petId) => {
    writeStored(petId)
    set({ selectedPetId: petId })
  },
  restore: () => set({ selectedPetId: readStored() }),
}))

export const SELECTED_PET_STORAGE_KEY = STORAGE_KEY
