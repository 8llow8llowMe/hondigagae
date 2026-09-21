package com.hondigagae.domainlayer.walkcourse.adapter.in.web.presenter;

import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.AppliedPetActivityLevelItem;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.WalkCourseItem;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseDetailResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseListResponse;
import com.hondigagae.domainlayer.walkcourse.application.info.WalkCourseInfo;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;
import com.hondigagae.domainlayer.walkcourse.domain.model.WalkCourseActivityFit;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class WalkCoursePresenter {

    public static final String PROVIDER_NAME = "제주특별자치도 올레코스현황 · 한국관광공사 TourAPI";

    public WalkCourseListResponse toListResponse(List<WalkCourseInfo> courses, WalkCourseSearchQuery query) {
        AppliedPetActivityLevelItem applied = toAppliedPetActivityLevel(query.petActivityLevel());

        return WalkCourseListResponse.builder()
            .courses(courses.stream().map(this::toItem).toList())
            .totalCount(courses.size())
            .appliedPetActivityLevel(applied)
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
            .durationMaxMinutes(course.durationMaxMinutes())
            .startEndPoint(course.startEndPoint())
            .startPointName(course.startPointName())
            .endPointName(course.endPointName())
            .lat(course.lat())
            .lng(course.lng())
            .endLat(course.endLat())
            .endLng(course.endLng())
            .firstImage(course.firstImage())
            .baseDate(course.baseDate())
            .fitsActivityLevels(course.fitActivityLevels().stream().map(ActivityLevel::toMetadata).toList())
            .providerName(PROVIDER_NAME)
            .build();
    }

    /**
     * 적용된 활동량 필터. 활동량을 주지 않은 조회는 <b>객체 자체가 null</b> 이다 - 별도 불리언을
     * 두면 같은 사실을 두 곳이 말하게 되고, 둘이 어긋나면 화면은 어느 쪽을 믿을지 알 수 없다.
     *
     * <p>상한은 {@link WalkCourseActivityFit#maxMinutesOf} 에서만 가져온다 - 여기서 240·360 을
     * 다시 적으면 목록을 거른 기준과 화면이 말하는 기준이 어긋난다. HIGH 는 상한이 없어 null 이다.
     */
    private AppliedPetActivityLevelItem toAppliedPetActivityLevel(ActivityLevel petActivityLevel) {
        if (petActivityLevel == null) {
            return null;
        }
        return AppliedPetActivityLevelItem.builder()
            .level(petActivityLevel.toMetadata())
            .maxDurationMinutes(WalkCourseActivityFit.maxMinutesOf(petActivityLevel))
            .build();
    }

    /**
     * 목록 항목에는 {@code fitsActivityLevels} 를 싣지 않는다 - 목록은 이미 활동량으로 걸러
     * 내려가므로 항목마다 같은 판정을 반복하면 응답만 부푼다. 코스 한 건을 놓고 "우리 아이에게
     * 맞나" 를 보는 곳은 상세라, 그 목록은 상세 응답에만 있다.
     */
    private WalkCourseItem toItem(WalkCourseInfo course) {
        return WalkCourseItem.builder()
            .walkCourseId(String.valueOf(course.walkCourseId()))
            .courseLabel(course.courseLabel())
            .name(course.name())
            .distanceKm(course.distanceKm())
            .durationText(course.durationText())
            .durationMaxMinutes(course.durationMaxMinutes())
            .startEndPoint(course.startEndPoint())
            .startPointName(course.startPointName())
            .endPointName(course.endPointName())
            .lat(course.lat())
            .lng(course.lng())
            .endLat(course.endLat())
            .endLng(course.endLng())
            .firstImage(course.firstImage())
            .build();
    }
}
