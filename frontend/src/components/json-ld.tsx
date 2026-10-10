import { type JsonLd as JsonLdData, serializeJsonLd } from '@/lib/seo/json-ld'

/**
 * 구조화 데이터 `<script type="application/ld+json">` (#1131).
 *
 * **`dangerouslySetInnerHTML` 을 쓰는 유일한 자리다.** 이 저장소는 외부 문자열을 HTML 로
 * 넣지 않는다(`lib/place/text.ts`) — 여기도 HTML 이 아니라 JSON 이고, 자식 텍스트로 넣으면
 * React 가 따옴표를 `&quot;` 로 바꿔 JSON 이 깨진다. 값에 섞인 `<` 는 `serializeJsonLd` 가
 * `<` 로 바꿔 `</script>` 로 태그를 닫는 주입을 막는다 (Next 공식 안내와 같은 처치).
 */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
