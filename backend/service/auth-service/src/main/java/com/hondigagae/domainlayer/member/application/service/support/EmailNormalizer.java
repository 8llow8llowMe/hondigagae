package com.hondigagae.domainlayer.member.application.service.support;

import java.util.Locale;

/**
 * 이메일 정규화의 <b>단일 기준점</b>.
 *
 * <p>Redis 키(case-sensitive)와 DB 조회(collation 기반) 간 대소문자 정합성을 위해 이메일은 항상
 * trim + 소문자로 정규화해 사용한다.
 *
 * <p>규칙을 한곳에 모아 둔 이유는 <b>탈퇴 이메일 다이제스트</b> 때문이다. 다이제스트는 정규화된
 * 문자열을 입력으로 계산하므로, 가입/로그인 경로와 다이제스트 계산 경로의 정규화가 한 글자라도
 * 어긋나면 같은 이메일이 다른 다이제스트로 계산되고 <b>재가입 차단이 조용히 뚫린다</b>.
 * 복사본을 만들지 말고 이 메서드를 부른다.
 *
 * <p>회원 식별자(email 컬럼)의 주인이 member 컨텍스트라 여기에 둔다. auth 의 로그인·이메일
 * 인증·비밀번호 재설정 경로가 같은 규칙을 그대로 쓴다.
 */
public final class EmailNormalizer {

    private EmailNormalizer() {
    }

    public static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
