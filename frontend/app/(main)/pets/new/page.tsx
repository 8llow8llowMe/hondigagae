import Link from 'next/link'

import { Canvas, SurfaceStack } from '@/components/surface'
import { PetCreateView } from '@/features/pet/pet-create-view'
import { messages } from '@/lib/messages'

export const metadata = {
  title: `${messages.pet.newTitle} · 혼디가개`,
}

/**
 * 초기 데이터가 없는 폼이라 서버 프리페치를 하지 않는다.
 * `architecture-guide.md` §9 결정 트리 1번에서 아니오로 빠진다 — 로그인·회원가입과 같다.
 *
 * **3층 표면** (`DESIGN.md §0`, 이슈 #464). 폼 규약은 일정 만들기(#453)를 따른다 —
 * `Canvas` 가 전폭으로 바닥을 깔고 폭 제한은 그 위에 쌓는 `SurfaceStack` 이 가져간다.
 * 예전 `main` 하나가 바닥과 배치를 겸하던 패턴(`mx-auto max-w-lg ... px-4 py-6`)이
 * §3-1 이 지목하던 바로 그 모양이었다 — 바닥색을 얹으면 컨테이너 안쪽만 회색이 된다.
 *
 * **폭이 `max-w-lg`(512)에서 `max-w-2xl`(672)로 넓어졌다** — 일정 만들기와 같은 한 단
 * 폭이다. 512 는 테두리 없는 폼일 때의 값이고, 카드가 좌우 인셋 20 을 더 먹는다.
 */
export default function PetNewPage() {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        {/*
          보이는 제목은 카드의 `h2` 다 (§0 "섹션 제목은 섹션 안에 있다"). 카드가 하나뿐이고
          그 이름이 곧 페이지의 이름이라 `h1` 은 `sr-only` 로 남긴다 — #439 · #453 과 같다.
        */}
        <h1 className="sr-only">{messages.pet.newTitle}</h1>

        <PetCreateView />

        {/*
          **`목록으로` 는 카드 밖이다.** 액션은 카드가 아니다 (§0 판정에서 "액션 바" 가
          빠진다 — 일정 만들기 #453 의 취소 링크와 같은 자리). L0 바닥 위에 그대로 선다.
        */}
        <Link
          href="/pets"
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 텍스트 크기는 그대로 두고
          // 히트 영역만 키운다
          className="text-body-2 text-fg-muted inline-flex h-11 items-center justify-center self-center underline"
        >
          {messages.pet.backToList}
        </Link>
      </SurfaceStack>
    </Canvas>
  )
}
