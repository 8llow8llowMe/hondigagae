package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.domain.enums.EmergencyFacilityTypeCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * #569 dev 실측(제주 214곳 중 2쌍 중복)을 고정한다.
 *
 * <p>좌표는 실제 CSV 값이다. 거리 가드가 도는지 보려면 좌표가 진짜여야 한다.
 */
class EmergencyFacilityDeduplicatorTest {

    /** 제주시 도령로 129. 같은 시설이 이름의 공백 하나로 갈렸다. */
    private static final BigDecimal DORYEONG_LAT = new BigDecimal("33.4935");
    private static final BigDecimal DORYEONG_LNG = new BigDecimal("126.4885");

    private static ImportedEmergencyFacility facility(
        String name, String addr, String tel, BigDecimal lat, BigDecimal lng, LocalDateTime modifiedAt) {
        return facility(name, addr, tel, lat, lng, modifiedAt, null);
    }

    private static ImportedEmergencyFacility facility(
        String name, String addr, String tel, BigDecimal lat, BigDecimal lng, LocalDateTime modifiedAt,
        String operatingHours) {
        return ImportedEmergencyFacility.builder()
            .sourceKey(PlaceIdFactory.sourceKeyOf(name, addr))
            .facilityType(EmergencyFacilityTypeCode.ANIMAL_HOSPITAL)
            .name(name)
            .addr(addr)
            .lat(lat)
            .lng(lng)
            .tel(tel)
            .operatingHours(operatingHours)
            .sourceModifiedAt(modifiedAt)
            .build();
    }

    private static List<String> namesOf(EmergencyFacilityDeduplicator.Result result) {
        return result.facilities().stream().map(ImportedEmergencyFacility::name).toList();
    }

    @Test
    @DisplayName("이름의 공백만 다른 같은 시설을 하나로 접는다")
    void foldsFacilitiesThatDifferOnlyByWhitespace() {
        ImportedEmergencyFacility spaced = facility("24시똑똑똑 동물메디컬센터", "제주특별자치도 제주시 도령로 129",
            "064-749-7585", DORYEONG_LAT, DORYEONG_LNG, LocalDateTime.of(2025, 3, 24, 0, 0));
        ImportedEmergencyFacility tight = facility("24시똑똑똑동물메디컬센터", "제주특별자치도 제주시 도령로 129",
            "064-749-7585", DORYEONG_LAT, DORYEONG_LNG, LocalDateTime.of(2025, 3, 24, 0, 0));

        // sourceKey 가 갈린 것이 이 버그의 출발점이다 — 전제를 먼저 고정한다
        assertThat(spaced.sourceKey()).isNotEqualTo(tight.sourceKey());

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(List.of(spaced, tight));

        assertThat(result.facilities()).hasSize(1);
        assertThat(result.mergedNotes()).hasSize(1);
    }

    @Test
    @DisplayName("전화가 같아도 3.5km 떨어진 노형꿈동물병원 쌍은 접지 않는다")
    void keepsBothNohyeongKkumRows() {
        /*
         * 주소·법정동·좌표·휴무일·주차·설명이 전부 달라 이전(移轉)인지 2호점인지 원천만으로는
         * 판정할 수 없다. 무리해서 접지 않는다 — 이 테스트가 그 판단을 고정한다.
         */
        ImportedEmergencyFacility wolgwang = facility("노형 꿈 동물병원", "제주특별자치도 제주시 월광로 32",
            "064-744-1128", new BigDecimal("33.48413773"), new BigDecimal("126.464903"), null);
        ImportedEmergencyFacility uryeong = facility("노형꿈동물병원", "제주특별자치도 제주시 우령서로 89",
            "064-744-1128", new BigDecimal("33.48425231"), new BigDecimal("126.427143"), null);

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(
            List.of(wolgwang, uryeong));

        assertThat(result.facilities()).hasSize(2);
        assertThat(result.mergedNotes()).isEmpty();
    }

    @Test
    @DisplayName("같은 건물의 다른 약국은 거리가 0 이어도 접지 않는다")
    void keepsDifferentPharmaciesInOneBuilding() {
        // 수덕로 41 에 세 곳이 같은 전화번호를 쓴다. 전화 단독 키를 쓰면 한 곳으로 접힌다.
        BigDecimal lat = new BigDecimal("33.4879");
        BigDecimal lng = new BigDecimal("126.4823");
        List<ImportedEmergencyFacility> rows = List.of(
            facility("두리약국", "제주특별자치도 제주시 수덕로 41", "064-744-9952", lat, lng, null),
            facility("밝은사랑약국", "제주특별자치도 제주시 수덕로 41", "064-744-9952", lat, lng, null),
            facility("큰곰동물약국", "제주특별자치도 제주시 수덕로 41", "064-744-9952", lat, lng, null));

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(rows);

        assertThat(result.facilities()).hasSize(3);
    }

    @Test
    @DisplayName("sourceKey 가 같은 행은 나중 것이 이긴다 — DB upsert 와 같은 결과여야 한다")
    void laterRowWinsForSameSourceKey() {
        ImportedEmergencyFacility earlier = facility("한림동물병원", "제주특별자치도 제주시 한림읍 한림로 12",
            "064-796-8253", new BigDecimal("33.4141"), new BigDecimal("126.2671"), null);
        ImportedEmergencyFacility later = facility("한림동물병원", "제주특별자치도 제주시 한림읍 한림로 12",
            "064-796-9999", new BigDecimal("33.4141"), new BigDecimal("126.2671"), null);

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(List.of(earlier, later));

        assertThat(result.facilities()).hasSize(1);
        assertThat(result.facilities().get(0).tel()).isEqualTo("064-796-9999");
        // sourceKey 접기는 중복 "발견" 이 아니라 지금까지 DB 가 하던 일이라 기록하지 않는다
        assertThat(result.mergedNotes()).isEmpty();
    }

    @Test
    @DisplayName("생존 행은 최종작성일이 최신인 쪽이다 — 실행할 때마다 같아야 한다")
    void keepsNewestRowDeterministically() {
        ImportedEmergencyFacility older = facility("24시똑똑똑 동물메디컬센터", "제주특별자치도 제주시 도령로 129",
            "064-749-7585", DORYEONG_LAT, DORYEONG_LNG, LocalDateTime.of(2024, 1, 1, 0, 0));
        ImportedEmergencyFacility newer = facility("24시똑똑똑동물메디컬센터", "제주특별자치도 제주시 도령로 129",
            "064-749-7585", DORYEONG_LAT, DORYEONG_LNG, LocalDateTime.of(2025, 3, 24, 0, 0));

        assertThat(namesOf(EmergencyFacilityDeduplicator.fold(List.of(older, newer))))
            .containsExactly("24시똑똑똑동물메디컬센터");
        // 입력 순서를 뒤집어도 같은 행이 남는다
        assertThat(namesOf(EmergencyFacilityDeduplicator.fold(List.of(newer, older))))
            .containsExactly("24시똑똑똑동물메디컬센터");
    }

    /*
     * 좌표 없는 행은 `CultureFacilityCsvAdapter` 가 읽는 단계에서 이미 거른다(skippedNoCoordinate).
     * 여기까지 올 수 없지만 방어로 남기고, 다음 사람이 "왜 이 경로가 안 잡히지" 를 다시 파지 않도록
     * 적어 둔다. 전화 null 은 실재한다 — 동물병원 224/225 만 전화를 준다.
     */
    @Test
    @DisplayName("접을 수 없는 행은 그대로 통과시킨다 — 전화·좌표가 없으면 가드를 걸 수 없다")
    void passesThroughRowsThatCannotBeFolded() {
        ImportedEmergencyFacility noTel = facility("전화없는동물병원", "제주특별자치도 제주시 어딘가로 1",
            null, DORYEONG_LAT, DORYEONG_LNG, null);
        ImportedEmergencyFacility noCoordinate = facility("좌표없는동물병원", "제주특별자치도 제주시 어딘가로 2",
            "064-000-0000", null, null, null);

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(
            List.of(noTel, noCoordinate));

        assertThat(result.facilities()).hasSize(2);
    }

    /*
     * 전국 실측에서 접기 후보 10개 묶음 중 **5개가 운영시간이 서로 달랐다** —
     * `24시 지구촌 동물메디컬 센터`(매일 00:00~24:00) vs `24시지구촌동물메디컬센터`(매일 09:00~23:00).
     * 임의로 하나를 고르면 24시간 병원이 아닌 곳이 되거나 그 반대가 된다.
     */
    @Test
    @DisplayName("운영시간이 엇갈리면 접지 않는다 — 급할 때 찾는 화면에서 틀린 시간이 최악이다")
    void keepsBothWhenOperatingHoursConflict() {
        ImportedEmergencyFacility open24 = facility("24시 지구촌 동물메디컬 센터", "제주특별자치도 제주시 가령로 1",
            "064-700-0001", DORYEONG_LAT, DORYEONG_LNG, null, "매일 00:00~24:00");
        ImportedEmergencyFacility daytime = facility("24시지구촌동물메디컬센터", "제주특별자치도 제주시 가령로 1-1",
            "064-700-0001", DORYEONG_LAT, DORYEONG_LNG, null, "매일 09:00~23:00");

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(List.of(open24, daytime));

        assertThat(result.facilities()).hasSize(2);
        assertThat(result.mergedNotes()).isEmpty();
        assertThat(result.conflictNotes()).hasSize(1);
    }

    @Test
    @DisplayName("한쪽만 운영시간을 가지면 엇갈림이 아니다 — 가진 쪽이 살아남는다")
    void keepsTheRowThatKnowsOperatingHours() {
        ImportedEmergencyFacility known = facility("24시똑똑똑 동물메디컬센터", "제주특별자치도 제주시 도령로 129",
            "064-749-7585", DORYEONG_LAT, DORYEONG_LNG, LocalDateTime.of(2024, 1, 1, 0, 0), "매일 00:00~24:00");
        ImportedEmergencyFacility unknown = facility("24시똑똑똑동물메디컬센터", "제주특별자치도 제주시 도령로 129",
            "064-749-7585", DORYEONG_LAT, DORYEONG_LNG, LocalDateTime.of(2025, 3, 24, 0, 0), null);

        // 시간을 모르는 쪽이 더 최신인데도, 아는 쪽이 이겨야 한다 — 접기가 정보를 줄이면 안 된다
        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(List.of(known, unknown));

        assertThat(result.facilities()).hasSize(1);
        assertThat(result.facilities().get(0).operatingHours()).isEqualTo("매일 00:00~24:00");
    }

    /*
     * `allWithinRadius` 가 묶음을 통째로 남기는 분기. 일부만 접으면 "어느 것이 어느 것과 같은가" 를
     * 입력 순서가 정하게 되고 멱등성이 깨진다 — 그 결정을 여기서 잠근다.
     */
    @Test
    @DisplayName("한 쌍이라도 멀면 묶음을 통째로 남긴다 — 가까운 쌍만 골라 접지 않는다")
    void keepsWholeBucketWhenAnyPairIsFarApart() {
        List<ImportedEmergencyFacility> rows = List.of(
            facility("행복동물병원", "제주특별자치도 제주시 가까운로 1", "064-700-1234",
                new BigDecimal("33.4990"), new BigDecimal("126.5310"), null),
            facility("행복 동물병원", "제주특별자치도 제주시 가까운로 2", "064-700-1234",
                new BigDecimal("33.4991"), new BigDecimal("126.5311"), null),
            facility("행복동물병원", "제주특별자치도 서귀포시 먼로 3", "064-700-1234",
                new BigDecimal("33.2541"), new BigDecimal("126.5600"), null));

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(rows);

        assertThat(result.facilities()).hasSize(3);
        assertThat(result.mergedNotes()).isEmpty();
    }

    @Test
    @DisplayName("멀쩡한 목록은 건드리지 않는다")
    void leavesDistinctFacilitiesAlone() {
        List<ImportedEmergencyFacility> rows = List.of(
            facility("태흥동물병원", "제주특별자치도 제주시 연북로 681", "064-722-3440",
                new BigDecimal("33.4881"), new BigDecimal("126.5312"), null),
            facility("나음동물병원", "제주특별자치도 제주시 연북로 18", "064-722-3440",
                new BigDecimal("33.4712"), new BigDecimal("126.4941"), null));

        EmergencyFacilityDeduplicator.Result result = EmergencyFacilityDeduplicator.fold(rows);

        assertThat(result.facilities()).hasSize(2);
        assertThat(result.mergedNotes()).isEmpty();
    }
}
