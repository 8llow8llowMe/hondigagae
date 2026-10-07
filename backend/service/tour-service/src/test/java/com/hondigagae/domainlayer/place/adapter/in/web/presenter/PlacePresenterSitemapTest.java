package com.hondigagae.domainlayer.place.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceSitemapItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceSitemapResponse;
import com.hondigagae.domainlayer.place.application.info.PlaceSitemapEntryInfo;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 사이트맵 응답 변환 검증 (#1135).
 *
 * <p>소비처가 크롤러용 {@code sitemap.xml} 이라 응답이 틀려도 화면에 드러나지 않는다 — 아이디가
 * 숫자로 나가 반올림되면 URL 이 다른 장소를 가리키고, 수정일이 엉뚱한 값이면 lastmod 가 거짓이 된다.
 */
class PlacePresenterSitemapTest {

    private static final long SNOWFLAKE_ID = 212481712381923328L;

    private final PlacePresenter presenter = new PlacePresenter();

    @Test
    @DisplayName("placeId 는 문자열이다 — 안전 정수 범위를 넘는 아이디가 반올림되지 않는다")
    void placeIdSerializedAsString() {
        PlaceSitemapResponse response = presenter.toSitemapResponse(List.of(entry(SNOWFLAKE_ID, PetAllowanceType.ALLOWED, null)));

        assertThat(response.places()).extracting(PlaceSitemapItem::placeId).containsExactly("212481712381923328");
    }

    @Test
    @DisplayName("petAllowanceType 은 raw 문자열이 아니라 {code, name, description} metadata 다")
    void petAllowanceTypeIsMetadata() {
        PlaceSitemapResponse response = presenter.toSitemapResponse(List.of(entry(SNOWFLAKE_ID, PetAllowanceType.PARTIALLY_ALLOWED, null)));

        PlaceSitemapItem item = response.places().get(0);
        assertThat(item.petAllowanceType().code()).isEqualTo("PARTIALLY_ALLOWED");
        assertThat(item.petAllowanceType().name()).isEqualTo(PetAllowanceType.PARTIALLY_ALLOWED.getDisplayName());
        assertThat(item.petAllowanceType().description()).isEqualTo(PetAllowanceType.PARTIALLY_ALLOWED.getDescription());
    }

    @Test
    @DisplayName("modifiedAt 은 받은 값 그대로, 없으면 null 이다 — 다른 시각으로 메우지 않는다")
    void modifiedAtPassesThroughIncludingNull() {
        LocalDateTime modifiedAt = LocalDateTime.of(2026, 8, 27, 14, 30, 5);

        PlaceSitemapResponse response = presenter.toSitemapResponse(List.of(
            entry(1L, PetAllowanceType.ALLOWED, modifiedAt),
            entry(2L, PetAllowanceType.ALLOWED, null)));

        assertThat(response.places()).extracting(PlaceSitemapItem::modifiedAt).containsExactly(modifiedAt, null);
    }

    @Test
    @DisplayName("totalCount 는 places 개수다 — 자르지 않는 전량 조회라 개수가 곧 총계다")
    void totalCountIsPlacesSize() {
        PlaceSitemapResponse response = presenter.toSitemapResponse(List.of(
            entry(1L, PetAllowanceType.ALLOWED, null),
            entry(2L, PetAllowanceType.UNKNOWN, null),
            entry(3L, PetAllowanceType.NOT_ALLOWED, null)));

        assertThat(response.totalCount()).isEqualTo(3);
        // 받은 순서(placeId 오름차순)를 다시 섞지 않는다
        assertThat(response.places()).extracting(PlaceSitemapItem::placeId).containsExactly("1", "2", "3");
    }

    @Test
    @DisplayName("장소가 없으면 빈 목록과 0 이다 — null 이 아니다")
    void emptyIsEmptyNotNull() {
        PlaceSitemapResponse response = presenter.toSitemapResponse(List.of());

        assertThat(response.places()).isEmpty();
        assertThat(response.totalCount()).isZero();
    }

    private static PlaceSitemapEntryInfo entry(long placeId, PetAllowanceType petAllowanceType, LocalDateTime modifiedAt) {
        return PlaceSitemapEntryInfo.builder()
            .placeId(placeId)
            .petAllowanceType(petAllowanceType)
            .modifiedAt(modifiedAt)
            .build();
    }
}
