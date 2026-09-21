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
    @DisplayName("변형(A/B)이 대괄호 안으로 옮겨진 새 제목 형식도 같은 키가 된다 (#722)")
    void bracketVariantTitleYieldsSameKey() {
        // 원천이 "[제주올레 3코스] ... (A)" 를 "[제주올레 3-A코스] ..." 로 바꿨다.
        // 옛 정규식은 여기서 매치 자체가 실패해 3-A·3-B·15-A·15-B 좌표가 조용히 빠졌다.
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 3-A코스] 온평-표선 올레")).isEqualTo("3-A");
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 3-B코스] 온평-표선 올레")).isEqualTo("3-B");
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 15-A코스] 한림-고내 올레")).isEqualTo("15-A");
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 15-B코스] 한림-고내 올레")).isEqualTo("15-B");
    }

    @Test
    @DisplayName("옛 제목 형식(괄호 접미사)도 계속 받는다 - 원천이 되돌리거나 섞어 줄 수 있다")
    void legacySuffixVariantTitleStillYieldsKey() {
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 3코스] 온평-표선 올레 (A)")).isEqualTo("3-A");
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 15코스] 한림-고내 올레 (B)")).isEqualTo("15-B");
    }

    @Test
    @DisplayName("숫자 부번호를 변형으로 오독하지 않는다 - 18-2 는 18 + 변형 2 가 아니다")
    void numericSubCourseIsNotReadAsVariant() {
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 1-1코스] 우도 올레")).isEqualTo("1-1");
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 10-1코스] 가파도 올레")).isEqualTo("10-1");
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 18-2코스] 하추자 올레")).isEqualTo("18-2");
        assertThat(OlleCourseParser
            .courseKeyFromTourTitle("[제주올레 7-1코스] 서귀포 버스터미널-제주올레 여행자센터 올레")).isEqualTo("7-1");
    }

    @Test
    @DisplayName("변형 없는 코스는 코스번호만 키가 된다 - 제목 안의 '제주올레'가 끼어들지 않는다")
    void plainCourseTitleYieldsCourseNoOnly() {
        assertThat(OlleCourseParser
            .courseKeyFromTourTitle("[제주올레 6코스] 쇠소깍-제주올레 여행자센터 올레")).isEqualTo("6");
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[제주올레 21코스] 하도-종달 올레")).isEqualTo("21");
    }

    @Test
    @DisplayName("제주올레가 아닌 항목(하영올레)은 키를 내지 않는다 - 다른 길을 올레 코스로 붙이면 안 된다")
    void nonOlleTitleYieldsNull() {
        assertThat(OlleCourseParser.courseKeyFromTourTitle("[하영올레] 1코스")).isNull();
        assertThat(OlleCourseParser.courseKeyFromTourTitle("제주카약올레")).isNull();
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
    @DisplayName("시종점 원문에서 두 지점명을 가른다 - 표기는 원문 그대로 둔다")
    void splitsStartAndEndPointNames() {
        assertThat(OlleCourseParser.startPointName("시흥리정류장-광치기해변")).isEqualTo("시흥리정류장");
        assertThat(OlleCourseParser.endPointName("시흥리정류장-광치기해변")).isEqualTo("광치기해변");
        // 점으로 두 이름을 묶은 표기(우도 1-1코스)도 한 덩어리로 둔다 - 가르면 어느 항인지 알 수 없다
        assertThat(OlleCourseParser.startPointName("천진항.하우목동항-천진항.하우목동항"))
            .isEqualTo("천진항.하우목동항");
        // 공백은 원문 그대로 남는다 - 접는 것은 매칭 키에서만 한다
        assertThat(OlleCourseParser.endPointName("온평포구-제주민속촌주차장 입구"))
            .isEqualTo("제주민속촌주차장 입구");
    }

    @Test
    @DisplayName("지점명을 못 가르면 null 이다 - 여기서 실패시키면 표기 하나에 29건 적재가 멈춘다")
    void unparsableStartEndPointYieldsNull() {
        // 구분자가 없다
        assertThat(OlleCourseParser.startPointName("시흥리정류장 광치기해변")).isNull();
        // 지명 자체에 구분자가 들어와 어디가 경계인지 알 수 없다
        assertThat(OlleCourseParser.endPointName("가-나-다")).isNull();
        assertThat(OlleCourseParser.startPointName(null)).isNull();
        assertThat(OlleCourseParser.startPointName("  ")).isNull();
    }

    @Test
    @DisplayName("매칭 키는 공백만 지운다 - 같은 곳의 두 표기를 접되 부분일치로 엮지는 않는다")
    void pointNameKeyFoldsWhitespaceOnly() {
        // 원천이 같은 곳을 두 표기로 부르는 실제 쌍 둘
        assertThat(OlleCourseParser.pointNameKey("제주민속촌주차장 입구"))
            .isEqualTo(OlleCourseParser.pointNameKey("제주민속촌주차장입구"));
        assertThat(OlleCourseParser.pointNameKey("김녕 서포구"))
            .isEqualTo(OlleCourseParser.pointNameKey("김녕서포구"));
        // 한쪽이 다른 쪽을 포함할 뿐인 이름은 접지 않는다
        assertThat(OlleCourseParser.pointNameKey("월평아왜낭목쉼터"))
            .isNotEqualTo(OlleCourseParser.pointNameKey("월평아왜낭목"));
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
