package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 제주 실측 사례를 고정한다. 판정값을 조정할 때 여기가 먼저 깨지게 만들어,
 * 반경 하나를 바꾸면 어떤 실측 사례가 뒤집히는지 즉시 드러낸다.
 */
class PlaceIdentityPolicyTest {

    @Test
    @DisplayName("이름 완전일치는 1,000m 까지 병합하고 그 밖은 병합하지 않는다")
    void mergesExactNameWithinOneKilometer() {
        // 원천마다 기준점이 다르다(오름 정상 vs 입구). 그래서 완전일치 반경을 넉넉히 잡았다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매공원", "노리매공원", 999d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매공원", "노리매공원", 1_001d)).isFalse();
    }

    @Test
    @DisplayName("이름 부분일치는 300m 까지만 병합한다")
    void mergesPartialNameOnlyWithinThreeHundredMeters() {
        // 노리매 ⊂ 노리매공원 — 한쪽이 다른 쪽을 품는 관계다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매", "노리매공원", 99d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매", "노리매공원", 301d)).isFalse();
    }

    @Test
    @DisplayName("서우봉 vs 서우봉둘레길은 부분일치지만 900m 면 병합하지 않는다")
    void doesNotMergePartialNameBeyondThreeHundredMeters() {
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("서우봉", "서우봉둘레길", 900d)).isFalse();
    }

    @Test
    @DisplayName("이름이 겹치지 않으면 93m 라도 병합하지 않는다 — 녹차미로공원 vs 쉼한모금")
    void neverMergesDifferentNamesHoweverClose() {
        // 좌표만 가까운 건은 실제로 별개 시설이었다. 이름이 좌표보다 믿을 만하다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("녹차미로공원", "쉼한모금", 93d)).isFalse();
    }

    @Test
    @DisplayName("도치돌목장 vs 도치돌 알파카목장(99m)은 현재 판정으로는 병합되지 않는다")
    void documentsDochidolPairNotMatchingToday() {
        // 실측에서는 같은 곳으로 확인된 쌍이다. 그런데 PlaceNameMatcher.isPartialMatch 는
        // "한쪽이 다른 쪽을 통째로 품는" 관계만 보므로 도치돌목장 ⊄ 도치돌알파카목장 이라 걸리지 않는다.
        // 이름 판정 규칙을 바꾸는 것은 동작 변경이라 이번 리팩토링(#363) 범위 밖이다 —
        // 지금 동작을 그대로 고정해 두고, 규칙을 손볼 때 이 테스트가 먼저 뒤집히게 한다.
        assertThat(PlaceNameMatcher.isPartialMatch("도치돌목장", "도치돌 알파카목장")).isFalse();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("도치돌목장", "도치돌 알파카목장", 99d)).isFalse();
    }

    @Test
    @DisplayName("이미지 백필은 완전일치 500m 이내만 채운다")
    void backfillsOnlyExactNameWithinFiveHundredMeters() {
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매공원", "노리매공원", 499d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매공원", "노리매공원", 501d)).isFalse();
    }

    @Test
    @DisplayName("이미지 백필은 부분일치면 거리와 무관하게 채우지 않는다")
    void neverBackfillsPartialName() {
        // 틀린 사진이 붙는 것이 사진이 없는 것보다 나쁘다. 병합보다 엄격한 이유다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매", "노리매공원", 1d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("서우봉", "서우봉둘레길", 10d)).isFalse();
    }

    @Test
    @DisplayName("반경은 경계를 포함한다 — 정확히 1,000m·300m·500m 인 쌍도 같은 곳이다")
    void radiiAreInclusive() {
        // <= 가 < 로 바뀌면 여기서 먼저 뒤집힌다. 실측 쌍이 경계값에 걸리는 일이 실제로 있다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("서우봉", "서우봉", 1_000d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매", "노리매공원", 300d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매공원", "노리매공원", 500d)).isTrue();
    }

    @Test
    @DisplayName("긴급 시설은 이름·전화·1,000m 를 모두 만족해야 접는다")
    void foldsEmergencyFacilityOnlyWhenNameTelAndDistanceAgree() {
        // #569 dev 실측 — 이름의 공백 한 칸만 다르고 주소·전화·좌표가 같았다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "24시똑똑똑 동물메디컬센터", "064-749-7585", "24시똑똑똑동물메디컬센터", "064-749-7585", 0d)).isTrue();
        // 표기가 달라도 숫자가 같으면 같은 번호로 본다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "큰곰동물약국", "0647449952", "큰곰동물약국", "064-744-9952", 0d)).isTrue();
    }

    @Test
    @DisplayName("전화가 같아도 이름이 다르면 접지 않는다 — 제주 실측 오병합 반례")
    void neverFoldsDifferentNamesSharingOneTel() {
        /*
         * 제주 214곳 중 전화를 공유하는 번호가 5개인데 셋은 이름이 전혀 다른 별개 시설이다.
         * 전화 단독 키를 쓰면 이 셋이 한 곳으로 접힌다.
         */
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "태흥동물병원", "064-722-3440", "나음동물병원", "064-722-3440", 100d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "사랑동물병원", "064-745-9975", "봄이든 동물병원", "064-745-9975", 100d)).isFalse();
        // 같은 건물(수덕로 41)에 있는 약국 3곳이라 거리가 0 이어도 접으면 안 된다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "두리약국", "064-744-9952", "밝은사랑약국", "064-744-9952", 0d)).isFalse();
    }

    @Test
    @DisplayName("이름·전화가 같아도 1,000m 를 넘으면 접지 않는다 — 같은 상호의 다른 지점")
    void neverFoldsFarBranchesSharingNameAndTel() {
        // 전국 실측: 노형꿈동물병원 3,502m, 백화점약국 10.6km, 경남수의동물병원 48km, 22세기 약국 143km.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "노형 꿈 동물병원", "064-744-1128", "노형꿈동물병원", "064-744-1128", 3_502d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "22세기 약국", "053-741-1075", "22세기 약국", "053-741-1075", 143_772d)).isFalse();
        // 경계는 포함한다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "노형꿈동물병원", "064-744-1128", "노형꿈동물병원", "064-744-1128", 1_000d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "노형꿈동물병원", "064-744-1128", "노형꿈동물병원", "064-744-1128", 1_001d)).isFalse();
    }

    @Test
    @DisplayName("전화가 없으면 접지 않는다 — 거리 가드를 걸 근거가 약해진다")
    void neverFoldsWithoutTel() {
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility("한림동물병원", null, "한림동물병원", null, 0d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility("한림동물병원", "", "한림동물병원", "", 0d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "한림동물병원", "064-796-8253", "한림동물병원", null, 0d)).isFalse();
    }

    @Test
    @DisplayName("반경 값은 실측으로 정한 그대로다")
    void keepsMeasuredRadii() {
        assertThat(PlaceIdentityPolicy.MERGE_EXACT_NAME_RADIUS_M).isEqualTo(1_000d);
        assertThat(PlaceIdentityPolicy.MERGE_PARTIAL_NAME_RADIUS_M).isEqualTo(300d);
        assertThat(PlaceIdentityPolicy.IMAGE_BACKFILL_RADIUS_M).isEqualTo(500d);
        assertThat(PlaceIdentityPolicy.EMERGENCY_DUPLICATE_RADIUS_M).isEqualTo(1_000d);
    }
}
