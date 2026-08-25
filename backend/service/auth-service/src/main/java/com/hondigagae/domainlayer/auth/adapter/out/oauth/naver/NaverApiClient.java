package com.hondigagae.domainlayer.auth.adapter.out.oauth.naver;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED_VALUE;

import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.dto.NaverMemberResponse;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.dto.NaverToken;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.PostExchange;

/**
 * 네이버 OAuth HTTP Interface(WebClient 기반). 프록시는 OAuthClientConfig에서 생성한다.
 */
public interface NaverApiClient {

    @PostExchange(url = "https://nid.naver.com/oauth2.0/token", contentType = APPLICATION_FORM_URLENCODED_VALUE)
    NaverToken fetchToken(@RequestParam MultiValueMap<String, String> params);

    @GetExchange("https://openapi.naver.com/v1/nid/me")
    NaverMemberResponse fetchMember(@RequestHeader(name = AUTHORIZATION) String bearerToken);
}
