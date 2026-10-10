package com.hondigagae.domainlayer.walkcourse.application.model;

import com.hondigagae.domainlayer.walkcourse.domain.enums.WalkCourseSort;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.math.BigDecimal;
import lombok.Builder;

@Builder
public record WalkCourseSearchQuery(
    // 반려견 활동량. 주면 소요시간 상한(WalkCourseActivityFit)으로 거른다. null 이면 필터 없음
    ActivityLevel petActivityLevel,
    // 최대 거리(km). null 이면 필터 없음
    BigDecimal maxDistanceKm,
    WalkCourseSort sort
) {

    public WalkCourseSort resolvedSort() {
        return sort == null ? WalkCourseSort.COURSE_NO : sort;
    }
}
