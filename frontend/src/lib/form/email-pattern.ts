import { z } from 'zod'

/**
 * 공유 이메일 정규식.
 *
 * zod 4 기본 이메일 정규식은 TLD 2자 이상을 요구해 `a@b.c` 같은 1자 TLD를
 * 거부한다. 백엔드는 이런 형식 제약을 두지 않으므로 더 관대한 HTML5 패턴을 쓴다.
 *
 * `src/lib/` 에 두는 이유: `src/features/auth/schemas.ts`(zod 스키마)와
 * `src/lib/api/mock/auth-data.ts`(mock 검증)가 **같은 관용도**를 써야 한다.
 * mock 이 스키마보다 엄격하면 FE 스키마는 통과하는 이메일이 mock 에서만 400 으로
 * 거부되는 드리프트가 생긴다 — 이슈 #24 최종 리뷰 I5. `src/lib/` 은 `src/features/`
 * 를 임포트할 수 없으므로(architecture-guide.md §3) 공유 지점을 lib 쪽에 둔다.
 */
export const EMAIL_PATTERN = z.regexes.html5Email
