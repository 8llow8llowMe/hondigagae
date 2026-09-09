package com.hondigagae.domainlayer.walkcourse.adapter.in.web.presenter;

import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.WalkCourseItem;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseDetailResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseListResponse;
import com.hondigagae.domainlayer.walkcourse.application.info.WalkCourseInfo;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class WalkCoursePresenter {

    public static final String PROVIDER_NAME = "제주특별자치도 올레코스현황 · 한국관광공사 TourAPI";

    public WalkCourseListResponse toListResponse(List<WalkCourseInfo> courses, WalkCourseSearchQuery query) {
        return WalkCourseListResponse.builder()
            .courses(courses.stream().map(this::toItem).toList())
            .totalCount(courses.size())
            .petActivityLevelApplied(query.petActivityLevel() != null)
            .providerName(PROVIDER_NAME)
            .build();
    }

    public WalkCourseDetailResponse toDetailResponse(WalkCourseInfo course) {
        return WalkCourseDetailResponse.builder()
            .walkCourseId(String.valueOf(course.walkCourseId()))
            .courseLabel(course.courseLabel())
            .name(course.name())
            .distanceKm(course.distanceKm())
            .durationText(course.durationText())
            .startEndPoint(course.startEndPoint())
            .lat(course.lat())
            .lng(course.lng())
            .firstImage(course.firstImage())
            .baseDate(course.baseDate())
            .providerName(PROVIDER_NAME)
            .build();
    }

    private WalkCourseItem toItem(WalkCourseInfo course) {
        return WalkCourseItem.builder()
            .walkCourseId(String.valueOf(course.walkCourseId()))
            .courseLabel(course.courseLabel())
            .name(course.name())
            .distanceKm(course.distanceKm())
            .durationText(course.durationText())
            .startEndPoint(course.startEndPoint())
            .lat(course.lat())
            .lng(course.lng())
            .firstImage(course.firstImage())
            .build();
    }
}
