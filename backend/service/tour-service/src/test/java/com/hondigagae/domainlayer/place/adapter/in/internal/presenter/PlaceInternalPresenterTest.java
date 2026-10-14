package com.hondigagae.domainlayer.place.adapter.in.internal.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.in.internal.dto.PlaceCandidateInternalResponse;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 내부 후보 응답의 장소 유형 (#1461).
 *
 * <p>표시명({@code contentTypeName})만으로는 소비 서비스가 유형을 <b>판정</b>할 수 없다 — 표시명은 문구라 바뀔 수 있다.
 * plan-service 가 일정 항목 장소 요약에 공개 장소 API 와 같은 {@code contentType} metadata({code, name, description})를 싣도록
 * enum 이름과 설명을 함께 준다.
 */
class PlaceInternalPresenterTest {

    private final PlaceInternalPresenter presenter = new PlaceInternalPresenter();

    @Test
    @DisplayName("장소 유형 코드는 enum 이름이고, 표시명 · 설명 · 원본 분류와 함께 나간다")
    void carriesContentTypeCode() {
        PlaceCandidateInternalResponse response = presenter.toCandidateResponses(List.of(PlaceSummaryInfo.builder()
            .placeId(1L).title("오설록 티뮤지엄").contentType(ContentType.RESTAURANT).sourceCategory("카페")
            .build())).getFirst();

        assertThat(response.contentTypeCode()).isEqualTo("RESTAURANT");
        assertThat(response.contentTypeName()).isEqualTo("음식점");
        // 공개 장소 API(PlaceItem.contentType.description)와 같은 값이다 — 같은 enum 의 설명을 그대로 준다.
        assertThat(response.contentTypeDescription()).isEqualTo(ContentType.RESTAURANT.toMetadata().description());
        assertThat(response.contentTypeDescription()).isEqualTo("음식점, 카페");
        assertThat(response.sourceCategory()).isEqualTo("카페");
    }

    @Test
    @DisplayName("유형이 없으면 코드도 표시명도 설명도 null 이다 — 지어내지 않는다")
    void missingContentTypeStaysNull() {
        PlaceCandidateInternalResponse response = presenter.toCandidateResponses(List.of(PlaceSummaryInfo.builder()
            .placeId(1L).title("유형 없는 장소")
            .build())).getFirst();

        assertThat(response.contentTypeCode()).isNull();
        assertThat(response.contentTypeName()).isNull();
        assertThat(response.contentTypeDescription()).isNull();
        assertThat(response.sourceCategory()).isNull();
    }
}
