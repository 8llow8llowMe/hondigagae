package com.hondigagae.domainlayer.dining.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 주변 식음료 검색 구분.
 *
 * <p>{@code categoryGroupCode} 는 카카오 로컬의 분류 코드지만, 이 값은 도메인이 "무엇을 찾는지"를
 * 나타내는 식별자로만 쓰고 어댑터 밖에서는 노출하지 않는다.
 */
@Getter
@RequiredArgsConstructor
public enum DiningType {

    RESTAURANT("식당", "FD6", "밥을 먹을 수 있는 곳"),
    CAFE("카페", "CE7", "커피·디저트를 파는 곳");

    private final String displayName;
    private final String categoryGroupCode;
    private final String description;
}
