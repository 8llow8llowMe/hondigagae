'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { Surface } from '@/components/surface'
import { PetDeleteSection } from '@/features/pet/pet-delete-section'
import { PetForm } from '@/features/pet/pet-form'
import { PetPhotoSection } from '@/features/pet/pet-photo-section'
import { PET_INVALIDATE_KEY } from '@/features/pet/queries'
import { usePetDetail } from '@/features/pet/use-pet-detail'
import { classify, toErrorStatus } from '@/lib/api/error'
import { updatePet } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { toPetFormValues } from '@/lib/pet/form'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 수정 화면 — **카드 둘 + 카드 밖 액션 둘** (`DESIGN.md §0`, 이슈 #464).
 *
 * **카드 경계가 "저장해야 반영" 과 "바로 반영" 을 가른다.** 2a 때는 `PetPhotoSection` 이
 * 스스로 `border-b` 를 긋고 삭제가 폼 `footer` 안에서 `border-t` 를 그어, 한 흐름 안의
 * 수제 구분선 둘이 그 일을 하고 있었다. 3a 에서는 §0 의 "카드 경계는 이야기 단위" 가
 * 그대로 맡는다 — 사진·대표는 전용 엔드포인트라 저장 버튼과 생명주기가 다르다.
 *
 * **`lead` 는 폼 카드가 갖는다.** `DESIGN.md §3-1` 이 그 등급을 "화면의 주인공 섹션" 으로
 * 못박았고 — "카드가 하나일 때" 가 아니다(홈이 반례다: 카드 여럿에 적합도만 `lead`) —
 * 이 화면의 주인공은 정보를 고치는 쪽이다. 등록 화면과 **같은 폼이 같은 크기**로 서는
 * 것도 그래야 맞는다.
 *
 * **삭제는 카드가 아니다** — 액션이고(§0 판정), 무엇보다 "이 아이를 지운다" 는 정보를
 * 고치는 것과 다른 이야기다. `목록으로` 와 같은 L0 바닥 위에 선다.
 */
export function PetEditView({ petId }: { petId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const query = usePetDetail(petId)

  /*
    로딩·오류도 **카드 안**이다 — 카드가 생겼다 사라지지 않아야 화면이 뒤집히지 않는다
    (긴급 브리핑 #461 과 같은 처리). 제목이 아직 없으므로 `aria-label` 로 이름을 준다.
  */
  if (query.isPending) {
    /*
      **카드 수까지 같게 그린다.** 한 장으로 두면 로드되는 순간 1 → 2 로 늘어나 화면이
      한 번 뒤집힌다 — "카드가 생겼다 사라지지 않는다" 는 층 수까지 포함한다.
    */
    return (
      <>
        <Surface aria-label={messages.pet.photoSectionTitle} aria-busy>
          <div className={cn('flex flex-col gap-3 pt-2 pb-5', INSET_CLASS.card)}>
            <div className="flex items-center gap-4">
              {/* 실화면의 `PetPhoto size={80}` 자리 */}
              <Skeleton className="size-20 shrink-0 rounded-full" />
              <Skeleton variant="text" className="h-11 w-28" />
            </div>
            <Skeleton variant="text" className="h-5 w-2/3" />
          </div>
        </Surface>

        <Surface aria-label={messages.pet.editFormTitle} aria-busy>
          <div className={cn('flex flex-col gap-3 pt-2 pb-5', INSET_CLASS.card)}>
            <Skeleton variant="text" className="h-6 w-24" />
            <Skeleton variant="text" className="h-11 w-full" />
            <Skeleton variant="text" className="h-11 w-full" />
            <Skeleton variant="text" className="h-11 w-full" />
          </div>
        </Surface>
      </>
    )
  }

  // 진입 시점의 조회 실패. 404 는 서버 컴포넌트가 notFound() 로 이미 걸렀으므로
  // 여기 도달하는 것은 대개 일시 장애다 — 재시도를 준다.
  if (query.data === undefined) {
    const status = toErrorStatus(query.error)
    const kind = status === null ? 'temporary' : classify(status)
    return (
      <Surface aria-label={messages.pet.editTitle}>
        <ErrorState
          inset="card"
          title={kind === 'not-found' ? messages.pet.notFoundTitle : messages.pet.loadFailedTitle}
          description={
            kind === 'not-found'
              ? messages.pet.notFoundDescription
              : messages.pet.loadFailedDescription
          }
          onRetry={() => void query.refetch()}
        />
      </Surface>
    )
  }

  const pet = query.data

  return (
    <>
      {/*
        사진·대표가 먼저다 — 누구의 화면인지부터 말한다. 부제가 이 카드를 폼과 가르는
        이유를 그대로 적는다("저장 버튼과 상관없이 바로 반영돼요").
      */}
      <Surface
        titleId="pet-photo-heading"
        title={messages.pet.photoSectionTitle}
        description={
          <p className="text-body-2 text-fg-muted">{messages.pet.photoSectionDescription}</p>
        }
      >
        <PetPhotoSection pet={pet} />
      </Surface>

      <Surface lead titleId="pet-edit-heading" title={messages.pet.editFormTitle}>
        {/* 폼은 카드 안이라 인셋이 16/20 이다 — 페이지 인셋 40 을 쓰면 두 번 밀린다 (§0) */}
        <div className={cn('pt-2 pb-5', INSET_CLASS.card)}>
          <PetForm
            // 응답의 metadata 객체에서 code 를 꺼낸다. 이 변환을 놓치면 수정 저장이
            // 조용히 깨진다 (공통명세 S3-5)
            initialValues={toPetFormValues(pet)}
            submitLabel={messages.pet.save}
            onSave={(payload) => updatePet(pet.petId, payload)}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
              router.replace('/pets')
            }}
          />
        </div>
      </Surface>

      {/*
        **카드 밖 액션 둘을 한 묶음으로 감싼다.** 낱개로 두면 `SurfaceStack` 간격(모바일 8 /
        데스크톱 24)이 그대로 걸려 삭제 버튼이 "카드에서 떨어져 나온 액션" 이 아니라
        "다음 카드 자리" 로 읽힌다 — §0 은 그 간격을 **카드 경계**로 쓴다.
      */}
      <div className="flex flex-col items-center gap-2">
        <PetDeleteSection petId={pet.petId} petName={pet.name} />

        <Link
          href="/pets"
          // 높이 44 — 규칙이 아니라 이 자리에서 고른 값이다 (#883 이 §7 하한을 지도 타깃으로 좁혔다). 텍스트 크기는 그대로 두고
          // 히트 영역만 키운다
          className="text-body-2 text-fg-muted inline-flex h-11 items-center justify-center underline"
        >
          {messages.pet.backToList}
        </Link>
      </div>
    </>
  )
}
