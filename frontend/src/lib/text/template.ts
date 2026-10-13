/**
 * 문구 템플릿의 `{key}` 자리표시자를 값으로 채운다.
 *
 * **사용자 입력이나 서버의 자유 텍스트(일정 제목 · 반려견 이름 · 요청 문구 · 장소명 ·
 * 검색어 등)를 문구에 넣을 때는 이 함수를 쓴다** (#1487).
 *
 * `template.replace('{title}', title)` 처럼 문자열을 두 번째 인자로 주면 JS 가 값 안의
 * `$&` · `$'` · `` $` `` · `$$` 를 치환 패턴으로 해석한다 — 요청 문구 `가격 $& 이하` 가
 * `가격 {note} 이하` 로 찍힌다. 여기서는 치환 함수로 넣어 값이 글자 그대로 보인다.
 *
 * 한 번에 훑어 치환하므로 `.replace().replace()` 연쇄와 달리 앞 값에 든 `{time}` 같은
 * 글자를 뒤 치환이 다시 바꾸지 않는다. 값이 없는 자리표시자는 그대로 둔다 — 문구 키와
 * 호출부가 어긋난 것이 화면에 드러나야 고칠 수 있다.
 */
export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    if (!Object.hasOwn(values, key)) return placeholder
    return String(values[key])
  })
}
