import { Skeleton } from '@/components/skeleton'

/** 최초 진입 로딩. 섹션 내부 재조회 로딩은 FavoriteListSection 이 담당한다 */
export default function FavoritesLoading() {
  return (
    <main className="w-full">
      <div className="border-border flex h-14 items-center border-b px-4 md:px-10">
        <Skeleton variant="text" className="h-6 w-28" />
      </div>

      <div className="flex flex-col gap-3 px-4 py-6 md:px-10">
        <Skeleton variant="card" className="h-24 w-full" />
        <Skeleton variant="card" className="h-24 w-full" />
        <Skeleton variant="card" className="h-24 w-full" />
      </div>
    </main>
  )
}
