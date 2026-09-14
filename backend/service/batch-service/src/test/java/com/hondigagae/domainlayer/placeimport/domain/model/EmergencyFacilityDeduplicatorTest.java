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
        return ImportedEmergencyFacility.builder()
            .sourceKey(PlaceIdFactory.sourceKeyOf(name, addr))
            .facilityType(EmergencyFacilityTypeCode.ANIMAL_HOSPITAL)
            .name(name)
            .addr(addr)
            .lat(lat)
            .lng(lng)
            .tel(tel)
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
