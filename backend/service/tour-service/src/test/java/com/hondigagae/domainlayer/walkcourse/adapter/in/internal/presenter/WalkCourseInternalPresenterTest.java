package com.hondigagae.domainlayer.walkcourse.adapter.in.internal.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.walkcourse.adapter.in.internal.dto.WalkCourseCandidateInternalResponse;
import com.hondigagae.domainlayer.walkcourse.application.info.WalkCourseInfo;
import com.hondigagae.domainlayer.walkcourse.domain.model.WalkCourseActivityFit;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 내부 코스 요약 응답 (#619).
 *
 * <p>{@code fitsActivityLevels} 는 이 응답의 핵심이다 — plan-service 가 남의 반려견 활동량을
 * tour-service 로 넘기지 않고도 "이 코스가 우리 아이에게 맞는가"를 판단할 수 있게 하는 값이라,
 * 판정이 {@link WalkCourseActivityFit} 과 어긋나면 두 서비스가 같은 코스를 다르게 읽는다.
 */
class WalkCourseInternalPresenterTest {

    private final WalkCourseInternalPresenter presenter = new WalkCourseInternalPresenter();

    @Test
    @DisplayName("활동량 힌트는 WalkCourseActivityFit 판정과 정확히 같다")
    void fitHintsMatchActivityFit() {
        List<WalkCourseCandidateInternalResponse> responses = presenter.toCandidateResponses(List.of(
            course("1", null, "4~5시간", 300),
            course("3", "A", "6~7시간", 420),
            course("10-1", null, "1~2시간", 120)));

        assertThat(responses).extracting(WalkCourseInternalPresenterTest::codesOf)
            .containsExactly(
                List.of(ActivityLevel.MEDIUM.name(), ActivityLevel.HIGH.name()),
                List.of(ActivityLevel.HIGH.name()),
                List.of(ActivityLevel.LOW.name(), ActivityLevel.MEDIUM.name(), ActivityLevel.HIGH.name()));
    }

    @Test
    @DisplayName("활동량은 code 뿐 아니라 표시명·설명까지 내린다 — 소비 서비스가 enum 을 다시 해석하지 않는다")
    void activityFitCarriesNameAndDescription() {
        WalkCourseCandidateInternalResponse.ActivityFit fit =
            presenter.toCandidateResponses(List.of(course("3", "A", "6~7시간", 420))).get(0)
                .fitsActivityLevels().get(0);

        assertThat(fit.code()).isEqualTo(ActivityLevel.HIGH.name());
        assertThat(fit.name()).isEqualTo(ActivityLevel.HIGH.getDisplayName());
        assertThat(fit.description()).isEqualTo(ActivityLevel.HIGH.getDescription());
    }

    @Test
    @DisplayName("소요시간을 모르는 코스는 상한이 null 인 채로 세 값이 다 담긴다 — 지어내지 않는다")
    void unknownDurationKeepsNullAndFitsAll() {
        WalkCourseCandidateInternalResponse response =
            presenter.toCandidateResponses(List.of(course("20", null, "미상", null))).get(0);

        assertThat(response.durationMaxMinutes()).isNull();
        assertThat(response.durationText()).isEqualTo("미상");
        assertThat(response.fitsActivityLevels()).hasSize(ActivityLevel.values().length);
    }

    @Test
    @DisplayName("이름표는 서비스가 만들어 준다 — 소비 서비스마다 코스번호를 다시 조립하지 않는다")
    void courseLabelIsBuiltHere() {
        List<WalkCourseCandidateInternalResponse> responses = presenter.toCandidateResponses(List.of(
            course("3", "A", "6~7시간", 420),
            course("10-1", null, "1~2시간", 120)));

        assertThat(responses).extracting(WalkCourseCandidateInternalResponse::courseLabel)
            .containsExactly("3코스 (A)", "10-1코스");
    }

    private static List<String> codesOf(WalkCourseCandidateInternalResponse response) {
        return response.fitsActivityLevels().stream()
            .map(WalkCourseCandidateInternalResponse.ActivityFit::code)
            .toList();
    }

    private static WalkCourseInfo course(String courseNo, String variant, String durationText, Integer maxMinutes) {
        return WalkCourseInfo.builder()
            .walkCourseId(1L)
            .courseNo(courseNo)
            .variant(variant)
            .courseOrder(10)
            .name("시흥-광치기")
            .distanceKm(new BigDecimal("15.1"))
            .durationText(durationText)
            .durationMaxMinutes(maxMinutes)
            .startEndPoint("시점-종점")
            .lat(33.4d)
            .lng(126.5d)
            .firstImage("https://example.test/course.jpg")
            .baseDate("2025-04-28")
            .build();
    }
}
