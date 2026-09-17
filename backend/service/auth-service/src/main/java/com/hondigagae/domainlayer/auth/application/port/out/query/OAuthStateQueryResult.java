package com.hondigagae.domainlayer.auth.application.port.out.query;

import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;

/**
 * state 에 함께 묶어 둔 인가 요청 맥락.
 *
 * <p>provider 를 같이 보관해 콜백의 provider 바꿔치기를 막고, consent 를 같이 보관해
 * 인가 전에 받은 동의를 콜백까지 나른다. 둘 다 <b>사용자가 콜백에서 조작할 수 없어야</b>
 * 의미가 있어서 state 와 한 덩어리로 저장한다.
 */
public record OAuthStateQueryResult(OAuthProvider provider, OAuthSignupConsent consent) {

}
