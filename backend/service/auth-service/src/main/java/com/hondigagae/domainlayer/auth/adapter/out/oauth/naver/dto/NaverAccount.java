package com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies.SnakeCaseStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(SnakeCaseStrategy.class)
public record NaverAccount(
    String id,
    String email,
    String name,
    String nickname,
    String profileImage
) {

}
