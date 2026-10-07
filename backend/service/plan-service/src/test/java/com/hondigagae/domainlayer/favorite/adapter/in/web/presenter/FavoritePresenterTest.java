package com.hondigagae.domainlayer.favorite.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.favorite.application.info.FavoritePlaceInfo;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class FavoritePresenterTest {

    private final FavoritePresenter presenter = new FavoritePresenter();

    @Test
    void toFavoritePlacesResponse_carriesSavedAt() {
        LocalDateTime savedAt = LocalDateTime.of(2026, 8, 30, 14, 30, 5);

        var response = presenter.toFavoritePlacesResponse(List.of(
            FavoritePlaceInfo.builder().placeId(100L).savedAt(savedAt).build()));

        assertThat(response.places()).hasSize(1);
        assertThat(response.places().get(0).placeId()).isEqualTo("100");
        assertThat(response.places().get(0).savedAt()).isEqualTo(savedAt);
    }
}
