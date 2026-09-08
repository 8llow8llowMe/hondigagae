package com.hondigagae.domainlayer.placeimport.adapter.out.file;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
import com.hondigagae.global.properties.CultureFacilityProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * 문화정보원 CSV → 여행 장소 매핑 검증.
 *
 * <p>여기서 고정하는 것은 <b>영업시간 구조화</b>다 — 원문(useTime)은 그대로 보존하면서
 * spec(weeklyHoursSpec)과 open24 를 함께 만드는지, 못 푸는 원문이 "모름"(null spec)으로
 * 남는지를 본다. 긴급 시설과 같은 규칙이 여행 장소에도 적용된다.
 */
class CultureFacilityCsvAdapterTest {

    @TempDir
    Path tempDir;

    private static final String HEADER =
        "시설명,카테고리3,시도 명칭,위도,경도,반려동물 동반 가능정보,도로명주소,운영시간";

    private List<ImportedCultureFacility> readFixture(String... rows) throws IOException {
        Path csv = tempDir.resolve("pet_culture.csv");
        Files.writeString(csv, HEADER + "\n" + String.join("\n", rows) + "\n");
        CultureFacilityCsvAdapter adapter = new CultureFacilityCsvAdapter(
            new CultureFacilityProperties(csv.toString()));
        return adapter.readTravelFacilities("제주특별자치도");
    }

    @Test
    @DisplayName("풀 수 있는 운영시간 원문은 원문 보존 + spec 구조화가 같이 된다")
    void buildsWeeklyHoursSpecFromUseTime() throws IOException {
        List<ImportedCultureFacility> facilities = readFixture(
            "달빛카페,카페,제주특별자치도,33.5,126.5,Y,제주시 어딘가 1,매일 09:00~21:00");

        assertThat(facilities).hasSize(1);
        ImportedCultureFacility facility = facilities.get(0);
        assertThat(facility.useTime()).isEqualTo("매일 09:00~21:00");
        assertThat(facility.weeklyHoursSpec()).isEqualTo("1234567:0900-2100");
        assertThat(facility.open24()).isFalse();
    }

    @Test
    @DisplayName("정보없음이어도 상호의 24시 신호는 open24 로 살린다")
    void trustsNameSignalForOpen24() throws IOException {
        List<ImportedCultureFacility> facilities = readFixture(
            "감귤24시카페,카페,제주특별자치도,33.4,126.4,Y,제주시 어딘가 2,정보없음");

        ImportedCultureFacility facility = facilities.get(0);
        assertThat(facility.weeklyHoursSpec()).isNull();
        assertThat(facility.open24()).isTrue();
    }

    @Test
    @DisplayName("풀 수 없는 원문은 spec 을 만들지 않는다 — 닫힘이 아니라 모름으로 남긴다")
    void leavesUnparseableHoursAsUnknown() throws IOException {
        // "연중무휴"는 매일 연다는 뜻이지 24시간이라는 뜻이 아니다 (OperatingHoursParser 규칙)
        List<ImportedCultureFacility> facilities = readFixture(
            "숲속쉼터,여행지,제주특별자치도,33.3,126.3,Y,제주시 어딘가 3,연중무휴");

        ImportedCultureFacility facility = facilities.get(0);
        assertThat(facility.useTime()).isEqualTo("연중무휴");
        assertThat(facility.weeklyHoursSpec()).isNull();
        assertThat(facility.open24()).isFalse();
    }

    @Test
    @DisplayName("00:00~24:00 은 spec 0000-2400 과 open24 가 함께 켜진다")
    void marksAllDayHoursAsOpen24() throws IOException {
        // dev 에서 이 원문이 open24=false 로 내려온 것이 #301 의 가장 분명한 신호였다 —
        // 파서가 돌았다면 반드시 true 여야 하는 값이라, 여기서 고정해 둔다.
        List<ImportedCultureFacility> facilities = readFixture(
            "군산오름,여행지,제주특별자치도,33.2,126.3,Y,서귀포시 어딘가 4,매일 00:00~24:00");

        ImportedCultureFacility facility = facilities.get(0);
        assertThat(facility.useTime()).isEqualTo("매일 00:00~24:00");
        assertThat(facility.weeklyHoursSpec()).isEqualTo("1234567:0000-2400");
        assertThat(facility.open24()).isTrue();
    }
}
