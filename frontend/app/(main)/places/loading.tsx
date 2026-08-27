import { Skeleton } from '@/components/skeleton'

/** 최초 진입 로딩. 섹션 내부 재조회 로딩은 PlaceListSection 이 담당한다 */
export default function PlacesLoading() {
  return (
    <main className="mx-auto flex max-w-screen-md flex-col gap-6 px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <Skeleton variant="text" className="h-9 w-40" />
      <Skeleton variant="text" className="h-5 w-72" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="card" className="h-28" />
        ))}
      </div>
    </main>
  )
}
