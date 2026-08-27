/**
 * 인증 화면 셸.
 *
 * `loading.tsx` 를 두지 않는다. 클라이언트 폼이라 서버 대기가 없고,
 * 경계가 있으면 응답이 먼저 스트리밍돼 리다이렉트 상태를 바꿀 수 없다
 * — docs/architecture-guide.md §7.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      {children}
    </main>
  )
}
