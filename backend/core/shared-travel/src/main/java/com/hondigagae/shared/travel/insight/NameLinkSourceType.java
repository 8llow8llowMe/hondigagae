package com.hondigagae.shared.travel.insight;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 명칭 기반 통계 원천 구분.
 *
 * <p>집중률과 연관 관광지는 둘 다 {@code contentId} 없이 관광지 이름만 주는 API 라 같은 연결
 * 테이블을 쓴다. 어느 쪽 매칭인지는 이 값으로 나눈다.
 */
@Getter
@RequiredArgsConstructor
public enum NameLinkSourceType {

    CONGESTION("집중률", "관광지 집중률 예측 API 의 명칭 매칭입니다."),
    RELATED_PLACE("연관 관광지", "관광지별 연관 관광지 API 의 명칭 매칭입니다.");

    private final String displayName;
    private final String description;
}
