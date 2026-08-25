package com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED_VALUE;

import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.dto.KakaoMemberResponse;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.dto.KakaoToken;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.PostExchange;

/**
 * 카카오 OAuth HTTP Interface(WebClient 기반). 프록시는 OAuthClientConfig에서 생성한다.
 */
public interface KakaoApiClient {

    @PostExchange(url = "https://kauth.kakao.com/oauth/token", contentType = APPLICATION_FORM_URLENCODED_VALUE)
    KakaoToken fetchToken(@RequestParam MultiValueMap<String, String> params);

    @GetExchange("https://kapi.kakao.com/v2/user/me")
    KakaoMemberResponse fetchMember(@RequestHeader(name = AUTHORIZATION) String bearerToken);
}
