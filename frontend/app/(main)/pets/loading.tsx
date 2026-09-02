import { Skeleton } from '@/components/skeleton'

/** 최초 진입 로딩. 섹션 내부 재조회 로딩은 PetListSection 이 담당한다 */
export default function PetsLoading() {
  return (
    <main className="mx-auto flex max-w-screen-md flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <Skeleton variant="text" className="h-9 w-32" />
      <Skeleton variant="text" className="h-5 w-64" />
      <div className="flex flex-col gap-3">
        <Skeleton variant="card" className="h-32 w-full" />
        <Skeleton variant="card" className="h-32 w-full" />
      </div>
    </main>
  )
}
