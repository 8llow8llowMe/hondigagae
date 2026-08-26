import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 조건부 클래스를 병합한다.
 * 컴포넌트가 받는 `className` 은 레이아웃 유틸리티 용도로만 허용한다
 * (색·radius·shadow·padding 덮어쓰기 금지 — docs/component-guide.md §3).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
