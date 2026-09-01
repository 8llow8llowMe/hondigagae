'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 반려견 프로필 사진. 없으면 이름 첫 글자로 떨어진다.
 *
 * 폴백 순서는 **업로드 → 이니셜**이다 (목록-세부명세 D8-1 의 "업로드 → 견종 일러스트 →
 * 이니셜" 중 가운데 단계는 자료가 없어 건너뛴다). 사진이 없는 것은 오류가 아니라 정상
 * 상태라 **빈 원형을 남기지 않는다.**
 *
 * ### `next/image` 가 아니라 `<img>` 인 이유
 *
 * 회원 아바타(`features/member/profile-avatar.tsx`)와 **같은 이유**다. 업로드 호스트가
 * `MINIO_PUBLIC_URL` 이라 환경마다 다른데 `remote-host.ts` 는 고정 목록이다. 등록되지
 * 않은 호스트에서는 이미지가 조용히 사라진다.
 *
 * ### 로드 실패 폴백
 *
 * URL 은 저장돼 있는데 파일이 지워졌거나 호스트가 죽은 경우가 실제로 생긴다. `<img>` 는
 * 그때 **깨진 이미지 아이콘**을 그리므로, 이니셜로 떨어뜨린다 — 사진 없는 상태와 같은
 * 모습이라 사용자가 이해할 수 있다.
 */
export function PetPhoto({
  name,
  url,
  size = 48,
  className,
}: {
  name: string
  url: string | null
  /** 원형 지름(px). 레이아웃이 흔들리지 않게 사진과 폴백이 같은 크기를 쓴다 */
  size?: 48 | 80
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  // URL 이 바뀌면 실패 기록을 지운다. 안 그러면 한 번 깨진 뒤 새 사진을 올려도
  // 계속 폴백만 보인다 — 업로드 성공이 화면에 반영되지 않는다
  useEffect(() => {
    setFailed(false)
  }, [url])

  const shape = cn('shrink-0 rounded-full', size === 48 ? 'size-12' : 'size-20', className)

  if (url === null || url.length === 0 || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          'bg-band text-fg flex items-center justify-center font-bold',
          size === 48 ? 'text-title-2' : 'text-avatar',
          shape,
        )}
      >
        {name.slice(0, 1)}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 위 주석: 업로드 호스트를 remotePatterns 에 등록할 수 없다
    <img
      src={url}
      // 이름은 항상 옆에 글자로 있다. alt 를 채우면 스크린리더가 이름을 두 번 읽는다
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn('bg-band object-cover', shape)}
    />
  )
}
