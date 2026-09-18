package com.hondigagae.domainlayer.walkcourse.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.AppliedPetActivityLevelItem;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item.WalkCourseItem;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseDetailResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseListResponse;
import com.hondigagae.domainlayer.walkcourse.application.info.WalkCourseInfo;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;
import com.hondigagae.domainlayer.walkcourse.domain.model.WalkCourseActivityFit;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 코스 조회 응답의 상한·소요·적합도 (#718).
 *
 * <p>상한의 정본은 {@link WalkCourseActivityFit} 하나이고 응답이 그것을 실어 내린다 — 화면이
 * "4시간"·"6시간"을 제 상수로 적으면 서버가 상한을 바꿔도 화면만 옛 숫자를 말한다.
 */
class WalkCoursePresenterTest {

    private final WalkCoursePresenter presenter = new WalkCoursePresenter();

    @Test
    @DisplayName("활동량으로 거르지 않은 조회는 적용 필터 객체가 통째로 null 이다 — 객체의 유무가 곧 적용 여부다")
    void noActivityFilterLeavesAppliedObjectNull() {
        WalkCourseListResponse response = presenter.toListResponse(List.of(course(300)), query(null));

        assertThat(response.appliedPetActivityLevel()).isNull();
        assertThat(response.totalCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("deprecated 불리언은 새 객체의 유무에서 유도된다 — 공존하는 동안 둘이 어긋날 수 없다")
    void deprecatedBooleanNeverDisagreesWithTheObject() {
        for (ActivityLevel level : ActivityLevel.values()) {
            WalkCourseListResponse response = presenter.toListResponse(List.of(course(300)), query(level));

            assertThat(response.petActivityLevelApplied())
                .isEqualTo(response.appliedPetActivityLevel() != null)
                .isTrue();
        }

        WalkCourseListResponse none = presenter.toListResponse(List.of(course(300)), query(null));

        assertThat(none.petActivityLevelApplied())
            .isEqualTo(none.appliedPetActivityLevel() != null)
            .isFalse();
    }

    @Test
    @DisplayName("LOW·MEDIUM 은 상한 분이 함께 내려간다 — 화면이 4시간·6시간을 스스로 적지 않게 한다")
    void boundedLevelsCarryTheirMaxDuration() {
        AppliedPetActivityLevelItem low = applied(ActivityLevel.LOW);
        AppliedPetActivityLevelItem medium = applied(ActivityLevel.MEDIUM);

        assertThat(low.level().code()).isEqualTo(ActivityLevel.LOW.name());
        assertThat(low.maxDurationMinutes()).isEqualTo(240);
        assertThat(medium.level().code()).isEqualTo(ActivityLevel.MEDIUM.name());
        assertThat(medium.maxDurationMinutes()).isEqualTo(360);
    }

    @Test
    @DisplayName("HIGH 는 객체는 있고 상한만 null 이다 — 상한 없음과 필터 미적용은 다른 뜻이다")
    void highHasObjectWithoutMaxDuration() {
        AppliedPetActivityLevelItem high = applied(ActivityLevel.HIGH);

        assertThat(high).isNotNull();
        assertThat(high.level().code()).isEqualTo(ActivityLevel.HIGH.name());
        assertThat(high.maxDurationMinutes()).isNull();
    }

    @Test
    @DisplayName("활동량 설명은 반려견 성향 문구 그대로다 — 상한 문구를 섞으면 내부 API 와 같은 enum 이 다른 말을 한다")
    void appliedLevelDescriptionStaysPetTemperament() {
        AppliedPetActivityLevelItem low = applied(ActivityLevel.LOW);

        assertThat(low.level().name()).isEqualTo(ActivityLevel.LOW.getDisplayName());
        assertThat(low.level().description()).isEqualTo(ActivityLevel.LOW.getDescription());
        assertThat(low.level().description()).doesNotContain("4시간", "240", "분");
    }

    @Test
    @DisplayName("목록 항목도 소요시간 상한을 싣고, 파싱에 실패한 코스는 null 그대로 나간다 — 지어내지 않는다")
    void listItemsCarryDurationMaxMinutesIncludingNull() {
        WalkCourseListResponse response =
            presenter.toListResponse(List.of(course(300), course(null)), query(null));

        assertThat(response.courses()).extracting(WalkCourseItem::durationMaxMinutes)
            .containsExactly(300, null);
    }

    @Test
    @DisplayName("상세는 적합 활동량을 함께 내린다 — 판정은 목록 필터와 같은 WalkCourseActivityFit 이다")
    void detailCarriesFitsActivityLevels() {
        WalkCourseDetailResponse response = presenter.toDetailResponse(course(300));

        assertThat(response.durationMaxMinutes()).isEqualTo(300);
        assertThat(response.fitsActivityLevels()).extracting(CodeNameDescriptionMetadata::code)
            .containsExactly(ActivityLevel.MEDIUM.name(), ActivityLevel.HIGH.name());
        assertThat(response.fitsActivityLevels()).extracting(CodeNameDescriptionMetadata::description)
            .containsExactly(ActivityLevel.MEDIUM.getDescription(), ActivityLevel.HIGH.getDescription());
    }

    @Test
    @DisplayName("소요시간을 모르는 코스의 상세는 세 활동량을 다 담는다 — 빈 목록이면 화면이 '맞는 코스가 없다'로 읽는다")
    void detailOfUnparsedCourseFitsEveryLevel() {
        WalkCourseDetailResponse response = presenter.toDetailResponse(course(null));

        assertThat(response.durationMaxMinutes()).isNull();
        assertThat(response.fitsActivityLevels()).extracting(CodeNameDescriptionMetadata::code)
            .containsExactly(ActivityLevel.LOW.name(), ActivityLevel.MEDIUM.name(), ActivityLevel.HIGH.name());
    }

    @Test
    @DisplayName("목록 항목에는 적합 활동량이 없다 — 이미 활동량으로 걸러 내려가므로 항목마다 반복하면 응답만 부푼다")
    void listItemHasNoFitsActivityLevels() {
        assertThat(WalkCourseItem.class.getRecordComponents())
            .extracting(java.lang.reflect.RecordComponent::getName)
            .doesNotContain("fitsActivityLevels");
    }

    private AppliedPetActivityLevelItem applied(ActivityLevel activityLevel) {
        return presenter.toListResponse(List.of(course(300)), query(activityLevel)).appliedPetActivityLevel();
    }

    private static WalkCourseSearchQuery query(ActivityLevel activityLevel) {
        return WalkCourseSearchQuery.builder()
            .petActivityLevel(activityLevel)
            .build();
    }

    private static WalkCourseInfo course(Integer durationMaxMinutes) {
        return WalkCourseInfo.builder()
            .walkCourseId(212481712381923328L)
            .courseNo("1")
            .variant(null)
            .courseOrder(10)
            .name("시흥-광치기")
            .distanceKm(new BigDecimal("15.1"))
            .durationText(durationMaxMinutes == null ? "미상" : "4~5시간")
            .durationMaxMinutes(durationMaxMinutes)
            .startEndPoint("시흥리정류장-광치기해변")
            .lat(33.4796218839d)
            .lng(126.8955024257d)
            .firstImage("https://example.test/course.jpg")
            .baseDate("2025-04-28")
            .build();
    }
}
