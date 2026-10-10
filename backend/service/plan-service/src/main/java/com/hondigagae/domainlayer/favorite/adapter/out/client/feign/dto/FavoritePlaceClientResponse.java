package com.hondigagae.domainlayer.favorite.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * tour-service 내부 후보 응답의 Feign 전용 표현 (coding-conventions §12-1).
 * 필요한 필드만 다시 선언하고, 상대가 필드를 늘려도 깨지지 않게 ignoreUnknown 을 켠다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FavoritePlaceClientResponse(
    Long placeId,
    String title,
    String contentTypeName,
    String addr,
    String petAllowanceName,
    Boolean indoor,
    String firstImage
) {

}
