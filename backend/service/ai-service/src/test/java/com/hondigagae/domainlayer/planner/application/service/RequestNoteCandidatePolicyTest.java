package com.hondigagae.domainlayer.planner.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.RequestNoteConstraints;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 실내 · 카페 요청이 후보 풀에 반영되는지 (#1170). 초안 · 근거 쪽은 {@code RequestNoteDraftPolicyTest} (#1423).
 * 실측 문구는 "오전엔 바다 보며 산책하고 오후엔 실내 카페에서 쉬고 싶어요".
 */
class RequestNoteCandidatePolicyTest {

    private static final String NOTE = "오전엔 바다 보며 산책하고 오후엔 실내 카페에서 쉬고 싶어요";

    @Test
    @DisplayName("실내와 카페가 함께 적히면 둘 다 검색 조건이 된다")
    void readsIndoorCafeFromTheNote() {
        RequestNoteConstraints constraints = RequestNoteConstraints.from(NOTE);

        assertThat(constraints.cafe()).isTrue();
        assertThat(constraints.indoor()).isTrue();
        assertThat(constraints.indoorFilter()).isTrue();
        assertThat(constraints.categoryFilter()).isEqualTo("카페");
        assertThat(RequestNoteConstraints.from("바다 보며 산책").asksAnything()).isFalse();
        assertThat(RequestNoteConstraints.from(null).asksAnything()).isFalse();
    }

    @Test
    @DisplayName("숙소는 실내여도 찾아갈 실내 장소가 아니다")
    void lodgingDoesNotSatisfyAnIndoorVisit() {
        PlaceCandidate lodging = place(2L, "숙박", true, "호텔");

        assertThat(RequestNoteConstraints.isIndoorVisit(lodging)).isFalse();
        assertThat(RequestNoteConstraints.from(NOTE).matches(lodging)).isFalse();
    }

    @Test
    @DisplayName("맞는 장소를 앞에 두고 상한을 넘지 않으며 같은 장소는 한 번만 남긴다")
    void reserveKeepsMatchesFirstWithinTheLimit() {
        PlaceCandidate cafe = place(1L, "음식점", true, "카페");
        PlaceCandidate beach = place(2L, "관광지", false, "해변");
        PlaceCandidate oreum = place(3L, "관광지", false, "오름");

        List<PlaceCandidate> reserved = RequestNoteCandidatePolicy.reserve(
            List.of(cafe), List.of(beach, cafe, oreum), 2);

        assertThat(reserved).extracting(PlaceCandidate::placeId).containsExactly(1L, 2L);
    }

    private static PlaceCandidate place(long id, String contentType, boolean indoor, String category) {
        return PlaceCandidate.builder()
            .placeId(id)
            .title("장소" + id)
            .contentTypeName(contentType)
            .indoor(indoor)
            .sourceCategory(category)
            .lat(33.5)
            .lng(126.5)
            .build();
    }
}
