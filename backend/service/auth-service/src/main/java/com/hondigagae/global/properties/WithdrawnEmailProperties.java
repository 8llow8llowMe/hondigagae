package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 탈퇴 회원의 이메일을 다이제스트로 치환할 때 쓰는 비밀값(pepper).
 *
 * <p>탈퇴 시 {@code member.email} 은 원문 대신 {@code HMAC-SHA256(pepper, 정규화된 이메일)} 로
 * 치환된다. 재가입 차단은 원문 비교가 아니라 이 다이제스트 비교로 이뤄진다. pepper 가 필요한
 * 이유는 이메일 공간이 열거 가능하기 때문이다 — 순수 SHA-256 은 흔한 주소 목록을 돌려
 * 그대로 역산된다.
 *
 * <p><b>⚠ 한번 정하면 바꾸지 않는다.</b> pepper 를 바꾸면 이미 저장된 다이제스트와 새로 계산한
 * 다이제스트가 달라져 <b>대조가 불가능해진다</b> — 탈퇴자가 같은 이메일로 다시 가입할 수 있게
 * 되고(일반·소셜 양쪽), 이미 저장된 행은 어떤 이메일이었는지 확인할 수단 없이 남는다.
 * 원문이 없으므로 <b>재계산으로 복구할 수도 없다.</b> 유출 등으로 교체가 불가피하면, 교체와
 * 함께 기존 탈퇴 행을 전부 삭제하는 것이 유일한 정합 수단이다.
 *
 * <p>값은 Vault(kv/hondigagae/backend/{dev,prod}/env)의 {@code WITHDRAWN_EMAIL_PEPPER} 로
 * 주입한다. dev/prod 프로파일은 기본값을 두지 않는다 — 비밀 없이 해시만 도는 상태가 최악이라
 * 기동 시점에 {@code WithdrawnEmailHasher} 가 터진다.
 */
@ConfigurationProperties(prefix = "member.withdrawn-email")
public record WithdrawnEmailProperties(String pepper) {

}
