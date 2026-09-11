import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas, SurfaceStack } from '@/components/surface'
import { PetEditView } from '@/features/pet/pet-edit-view'
import { petKeys } from '@/features/pet/queries'
import { ApiError, isRetriable } from '@/lib/api/error'
import { petDetailPath } from '@/lib/api/pet'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { Pet } from '@/types/pet'

export const metadata = {
  title: `${messages.pet.editTitle} · 혼디가개`,
}

export default async function PetEditPage({ params }: { params: Promise<{ petId: string }> }) {
  // petId 는 문자열이다. number 로 파싱하지 않는다 — Snowflake 라 정밀도가 손상된다
  const { petId } = await params

  const session = await readSession()
  const queryClient = getServerQueryClient()

  if (session !== null) {
    try {
      const pet = await serverFetch<Pet>(petDetailPath(petId), {
        accessToken: session.accessToken,
      })
      queryClient.setQueryData(petKeys.detail(petId), pet)
    } catch (error) {
      // 404(PET_001) 는 없거나 타인 소유다. 존재 자체를 노출하지 않는 백엔드 판정을
      // 그대로 따라 not-found 로 보낸다.
      if (error instanceof ApiError && error.status === 404) notFound()

      // **재조회로 복구되지 않는 실패는 삼키지 않는다.**
      //
      // 숫자가 아닌 petId 는 404 가 아니라 400(`PET_113`) 이다 (@PathVariable long).
      // 이건 요청 자체가 잘못된 것이라 클라이언트가 몇 번을 다시 불러도 같은 400 이다
      // — api-integration-guide.md §7 이 "400 도 retry 대상이 아니다" 로 규정한 그 경우다.
      // 삼키면 클라이언트 조회에 기대게 되는데, 그 조회도 실패로 확정되기 전까지
      // 화면이 스켈레톤에 머문다. 던져서 error.tsx 가 받게 한다 — 수정-세부명세 D5.
      //
      // 반대로 5xx·무응답은 삼킨다. 그건 다시 부르면 성공할 수 있는 실패라
      // 화면 전체를 죽이지 않고 클라이언트가 재시도 UI 를 준다
      // (architecture-guide.md §9).
      if (!isRetriable(error)) throw error
    }
  }

  return (
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #464). 폼 규약은 일정 만들기(#453)와 같고
      **카드가 둘**이다 — 사진·대표(바로 반영)와 정보 수정(저장해야 반영). 그 판단과
      삭제·`목록으로` 가 카드 밖인 근거는 `pet-edit-view.tsx` 주석에 있다.

      폭이 `max-w-lg`(512)에서 `max-w-2xl`(672)로 넓어졌다 — 등록 화면과 같은 한 단 폭이다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        {/*
          보이는 제목은 카드의 `h2` 들이다 (§0 "섹션 제목은 섹션 안에 있다"). 카드가 둘이라
          어느 하나가 페이지 이름을 대신할 수 없어, `h1` 은 `sr-only` 로 남되 **문서에는
          있어야 한다** — 없으면 이 화면에 제목 없는 `h2` 둘만 남는다.
        */}
        <h1 className="sr-only">{messages.pet.editTitle}</h1>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <PetEditView petId={petId} />
        </HydrationBoundary>
      </SurfaceStack>
    </Canvas>
  )
}
