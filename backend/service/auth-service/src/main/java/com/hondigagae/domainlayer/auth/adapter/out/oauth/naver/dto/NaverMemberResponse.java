package com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NaverMemberResponse(
    // 네이버 응답 필드는 언더스코어 없는 "resultcode"라 명시 매핑한다.
    @JsonProperty("resultcode") String resultCode,
    String message,
    NaverAccount response
) {

}
