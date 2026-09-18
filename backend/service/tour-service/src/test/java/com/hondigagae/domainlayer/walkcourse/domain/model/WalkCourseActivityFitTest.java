package com.hondigagae.domainlayer.walkcourse.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 활동량별 소요시간 상한 (#718).
 *
 * <p>상한 숫자가 응답에 실려 나가게 됐으므로(목록의 {@code appliedPetActivityLevel}) 이제 값 자체가
 * 계약이다 — 여기서 고정하지 않으면 상한을 조용히 바꿔도 아무 테스트가 깨지지 않는다.
 */
class WalkCourseActivityFitTest {

    @Test
    @DisplayName("LOW 는 240분·MEDIUM 은 360분이 상한이고 HIGH 는 상한이 없어 null 이다")
    void maxMinutesOfEachLevel() {
        assertThat(WalkCourseActivityFit.maxMinutesOf(ActivityLevel.LOW)).isEqualTo(240);
        assertThat(WalkCourseActivityFit.maxMinutesOf(ActivityLevel.MEDIUM)).isEqualTo(360);
        assertThat(WalkCourseActivityFit.maxMinutesOf(ActivityLevel.HIGH)).isNull();
    }

    @Test
    @DisplayName("활동량을 주지 않으면 상한도 없다 — 필터 없음을 상한 0 으로 읽지 않는다")
    void maxMinutesOfNullLevel() {
        assertThat(WalkCourseActivityFit.maxMinutesOf(null)).isNull();
    }

    @Test
    @DisplayName("걸을 만한지 판정은 상한 접근자와 같은 숫자를 쓴다 — 경계값이 어긋나면 응답이 거짓말을 한다")
    void fitsUsesSameBoundaryAsAccessor() {
        assertThat(WalkCourseActivityFit.fits(ActivityLevel.LOW, 240)).isTrue();
        assertThat(WalkCourseActivityFit.fits(ActivityLevel.LOW, 241)).isFalse();
        assertThat(WalkCourseActivityFit.fits(ActivityLevel.MEDIUM, 360)).isTrue();
        assertThat(WalkCourseActivityFit.fits(ActivityLevel.MEDIUM, 361)).isFalse();
        assertThat(WalkCourseActivityFit.fits(ActivityLevel.HIGH, 9999)).isTrue();
    }

    @Test
    @DisplayName("소요시간을 모르는 코스는 세 활동량 모두에 담긴다 — 모르는 것을 나쁜 것으로 판정하지 않는다")
    void unknownDurationFitsEveryLevel() {
        assertThat(WalkCourseActivityFit.fits(ActivityLevel.LOW, null)).isTrue();
        assertThat(WalkCourseActivityFit.fittingLevels(null))
            .containsExactly(ActivityLevel.LOW, ActivityLevel.MEDIUM, ActivityLevel.HIGH);
    }

    /**
     * 활동량 필터가 없는 모든 목록 조회가 지나는 길이다 ({@code WalkCourseQueryProcessor}). 예전에는
     * {@code fits} 가 {@code activityLevel == null} 을 명시 가드로 걸렀는데, 지금은 그 판단이
     * {@code maxMinutesOf(null) == null} 에 얹혀 있다 — 접근자가 null 활동량에 0 이나 예외를 내도록
     * 바뀌면 <b>기본 조회가 통째로 비는데</b> 다른 테스트는 하나도 깨지지 않는다.
     */
    @Test
    @DisplayName("활동량을 주지 않으면 어떤 소요시간도 거르지 않는다 — 필터 없는 기본 조회가 지나는 길이다")
    void noActivityLevelFiltersNothing() {
        assertThat(WalkCourseActivityFit.fits(null, 9999)).isTrue();
        assertThat(WalkCourseActivityFit.fits(null, 1)).isTrue();
        assertThat(WalkCourseActivityFit.fits(null, null)).isTrue();
    }
}
