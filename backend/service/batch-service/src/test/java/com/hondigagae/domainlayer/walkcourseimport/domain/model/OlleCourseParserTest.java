package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 두 원천(CSV·TourAPI)의 매칭 키 규칙 (#383).
 *
 * <p>이 규칙이 한쪽에서만 바뀌면 같은 코스가 서로 다른 키가 되어 좌표 매칭이 조용히 전부
 * 빠진다 - 오류가 나지 않고 "좌표 없는 코스가 늘었네"로만 보여 눈으로 잡기 어렵다.
 */
class OlleCourseParserTest {

    @Test
    @DisplayName("CSV 코스별과 TourAPI 제목이 같은 키로 떨어진다")
    void csvAndTourTitleYieldSameKey() {
        // CSV: 코스별 "3코스" + 코스명 "온평-표선(A)"
        String csvKey = OlleCourseParser.courseKey(
            OlleCourseParser.courseNo("3코스"), OlleCourseParser.variantOf("온평-표선(A)"));
        // TourAPI: "[제주올레 3코스] 온평-표선 올레 (A)"
        String tourKey = OlleCourseParser.courseKeyFromTourTitle("[제주올레 3코스] 온평-표선 올레 (A)");

        assertThat(csvKey).isEqualTo("3-A").isEqualTo(tourKey);
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 1-1코스] 우도-올레")).isEqualTo("1-1");
    }

    @Test
    @DisplayName("제주올레가 아닌 항목(하영올레)은 키를 내지 않는다 - 다른 길을 올레 코스로 붙이면 안 된다")
    void nonOlleTitleYieldsNull() {
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[하영올레] 1코스")).isNull();
        assertThat(OlleCourseParser.courseKeyFromTourTitle(null)).isNull();
    }

    @Test
    @DisplayName("코스번호·정렬 순서 - 부번호가 본번호 순서를 깨지 않는다")
    void courseOrderKeepsNumericOrder() {
        assertThat(OlleCourseParser.courseNo("1코스")).isEqualTo("1");
        assertThat(OlleCourseParser.courseNo("18-2코스")).isEqualTo("18-2");
        assertThat(OlleCourseParser.courseOrder("1")).isEqualTo(10);
        assertThat(OlleCourseParser.courseOrder("1-1")).isEqualTo(11);
        assertThat(OlleCourseParser.courseOrder("2")).isEqualTo(20);
        assertThat(OlleCourseParser.courseOrder("18-2")).isEqualTo(182);
    }

    @Test
    @DisplayName("거리와 소요시간을 원문에서 파싱한다 - 소요시간은 큰 쪽을 잡는다")
    void parsesDistanceAndDuration() {
        assertThat(OlleCourseParser.distanceKm("15.1km")).isEqualByComparingTo(new BigDecimal("15.1"));
        assertThat(OlleCourseParser.distanceKm("19km")).isEqualByComparingTo(new BigDecimal("19"));
        // 활동량 상한 비교에 쓰므로 작은 쪽으로 잡으면 상한 근처 코스가 통과된다
        assertThat(OlleCourseParser.durationMaxMinutes("4~5시간")).isEqualTo(300);
        assertThat(OlleCourseParser.durationMaxMinutes("1~2시간")).isEqualTo(120);
        assertThat(OlleCourseParser.durationMaxMinutes("측정불가")).isNull();
    }

    @Test
    @DisplayName("규격을 벗어난 행은 조용히 건너뛰지 않고 실패시킨다")
    void invalidRowFails() {
        assertThatThrownBy(() -> OlleCourseParser.courseNo("첫번째코스"))
            .isInstanceOf(WalkCourseImportException.class);
        assertThatThrownBy(() -> OlleCourseParser.distanceKm("십오키로"))
            .isInstanceOf(WalkCourseImportException.class);
    }

    @Test
    @DisplayName("id 는 코스키에서 결정적으로 나온다 - 재실행이 같은 행에 꽂힌다")
    void idIsDeterministic() {
        assertThat(OlleCourseParser.walkCourseId("3-A")).isEqualTo(OlleCourseParser.walkCourseId("3-A"));
        assertThat(OlleCourseParser.walkCourseId("3-A")).isNotEqualTo(OlleCourseParser.walkCourseId("3-B"));
        // place 의 TourAPI contentId 대역과 겹치지 않는다
        assertThat(OlleCourseParser.walkCourseId("1")).isGreaterThanOrEqualTo(1L << 62);
    }
}
