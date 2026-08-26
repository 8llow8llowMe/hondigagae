import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * 세션 페이로드를 AES-256-GCM 으로 봉인/해제한다.
 * 순수 함수이므로 테스트 가능하다 (secret 을 인자로 받는다).
 *
 * 토큰은 이 봉인 안에서만 존재하고 브라우저 JS는 읽을 수 없다 — docs/auth-guide.md §2.
 */
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function seal(payload: unknown, secret: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, data].map((part) => part.toString('base64url')).join('.')
}

/** 위조·손상된 토큰은 예외를 던지지 않고 null 을 반환한다 (쿠키는 사용자가 조작할 수 있다) */
export function unseal<T>(token: string, secret: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [ivPart, tagPart, dataPart] = parts
  if (!ivPart || !tagPart || !dataPart) return null

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      deriveKey(secret),
      Buffer.from(ivPart, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

    const json = Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8')

    return JSON.parse(json) as T
  } catch {
    return null
  }
}
