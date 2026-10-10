import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { validate } from '@/lib/form/validate'

const schema = z.object({
  email: z.string().min(1, '이메일은 필수입니다.'),
  password: z.string().min(8, '8자 이상이어야 합니다.').regex(/\d/, '숫자를 포함해야 합니다.'),
})

describe('validate', () => {
  it('통과하면 파싱된 값을 준다', () => {
    const result = validate(schema, { email: 'a@b.c', password: 'abcd1234' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.email).toBe('a@b.c')
  })

  it('실패하면 필드별 메시지를 준다', () => {
    const result = validate(schema, { email: '', password: 'abcd1234' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.email).toBe('이메일은 필수입니다.')
  })

  it('한 필드에 오류가 여러 개면 첫 오류만 채택한다', () => {
    // 서버 규칙(field-errors)과 같은 동작이어야 한다 — docs/form-guide.md §5
    const result = validate(schema, { email: 'a@b.c', password: 'abc' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.password).toBe('8자 이상이어야 합니다.')
  })

  it('클라이언트 검증은 폼 전체 오류를 만들지 않는다', () => {
    const result = validate(schema, { email: '', password: '' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.form).toBeNull()
  })
})
