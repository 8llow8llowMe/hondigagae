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
    @DisplayName("반경 값은 실측으로 정한 그대로다")
    void keepsMeasuredRadii() {
        assertThat(PlaceIdentityPolicy.MERGE_EXACT_NAME_RADIUS_M).isEqualTo(1_000d);
        assertThat(PlaceIdentityPolicy.MERGE_PARTIAL_NAME_RADIUS_M).isEqualTo(300d);
        assertThat(PlaceIdentityPolicy.IMAGE_BACKFILL_RADIUS_M).isEqualTo(500d);
    }
}
