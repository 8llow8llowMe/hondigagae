package com.hondigagae.domainlayer.walkcourse.adapter.in.internal.presenter;

import com.hondigagae.domainlayer.walkcourse.adapter.in.internal.dto.WalkCourseCandidateInternalResponse;
import com.hondigagae.domainlayer.walkcourse.application.info.WalkCourseInfo;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class WalkCourseInternalPresenter {

    public List<WalkCourseCandidateInternalResponse> toCandidateResponses(List<WalkCourseInfo> courses) {
        return courses.stream()
            .map(this::toCandidateResponse)
            .toList();
    }

    private WalkCourseCandidateInternalResponse toCandidateResponse(WalkCourseInfo info) {
        return WalkCourseCandidateInternalResponse.builder()
            .walkCourseId(info.walkCourseId())
            .name(info.name())
            .courseLabel(info.courseLabel())
            .distanceKm(info.distanceKm())
            .durationText(info.durationText())
            .durationMaxMinutes(info.durationMaxMinutes())
            .lat(info.lat())
            .lng(info.lng())
            .firstImage(info.firstImage())
            .fitsActivityLevels(info.fitActivityLevels().stream().map(this::toActivityFit).toList())
            .build();
    }

    /**
     * 활동량은 code/name/description 셋을 다 내린다 - 소비 서비스가 {@code ActivityLevel} 을 다시
     * 해석하지 않게 한다. 코드만 주면 각 서비스가 제 표시 문구를 갖게 되고, 그러면 같은 코스에
     * 서로 다른 말을 하는 화면이 생긴다.
     */
    private WalkCourseCandidateInternalResponse.ActivityFit toActivityFit(ActivityLevel activityLevel) {
        return WalkCourseCandidateInternalResponse.ActivityFit.builder()
            .code(activityLevel.name())
            .name(activityLevel.getDisplayName())
            .description(activityLevel.getDescription())
            .build();
    }
}
