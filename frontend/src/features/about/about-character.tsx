import { CharacterImage } from '@/components/character'
import { Reveal } from '@/features/about/reveal'
import { cn } from '@/lib/utils/cn'

/*
  소개 페이지 캐릭터 세 자리 (#917). 에셋 표와 `CharacterImage` 는 `@/components/character` 로
  올라갔다 (#939) — 다른 화면의 빈 상태 · 대기 화면이 같은 그림을 쓴다.
*/

/**
 * 히어로 — 앉아서 판정 카드를 올려다본다 (명세 §6-2).
 *
 * 판정 카드와 같은 패럴랙스 래퍼 안에 `absolute` 로 선다 — 카드가 거슬러 오르면 같이 오른다.
 * 1024 이상은 카드 왼쪽 바깥(카피 열과 카드 열 사이), 그 미만은 카드 **아래** 왼쪽에서 발을
 * 절 끝선에 댄다. 모바일에서 카드 모서리에 겹치면 카드 맨 아래 캡션 · 이유 줄을 가린다.
 *
 * 제목 어절이 다 올라온 뒤(500ms) 한 번 올라온다 — `.about-split-word` 와 같은 keyframes.
 */
export function HeroDog() {
  return (
    <span aria-hidden className="about-hero-dog">
      <CharacterImage name="sitLookup" eager className="w-full" />
    </span>
  )
}

/**
 * 마무리 CTA — 정면으로 앉는다 (명세 §6-2). 1024 이상은 7:5 의 오른쪽 열, 그 미만은 버튼 아래
 * 오른쪽이고 어느 쪽이든 **절 끝선에 발을 댄다**(음수 아래 여백 = 밴드 아래 패딩).
 *
 * 등장은 `Reveal` 한 번이다 — 반복하지 않는다.
 */
export function CtaDog({ className }: { className?: string }) {
  return (
    <Reveal className={cn('about-cta-dog', className)}>
      <span aria-hidden className="block">
        <CharacterImage name="sitFront" className="w-full" />
      </span>
    </Reveal>
  )
}
