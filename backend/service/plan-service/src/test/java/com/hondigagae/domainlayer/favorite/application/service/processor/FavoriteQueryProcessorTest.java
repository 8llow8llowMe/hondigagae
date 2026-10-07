package com.hondigagae.domainlayer.favorite.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.favorite.application.exception.FavoriteErrorCode;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import com.hondigagae.domainlayer.favorite.application.info.FavoritePlaceInfo;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoritePlaceLookupPort;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoriteRepositoryPort;
import com.hondigagae.domainlayer.favorite.application.port.out.query.FavoritePlaceQueryResult;
import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FavoriteQueryProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long PLACE_ID = 100L;
    private static final LocalDateTime SAVED_AT = LocalDateTime.of(2026, 8, 30, 14, 30, 5);

    private FavoriteRepositoryPort favoriteRepositoryPort;
    private FavoritePlaceLookupPort favoritePlaceLookupPort;
    private FavoriteQueryProcessor processor;

    @BeforeEach
    void setUp() {
        favoriteRepositoryPort = mock(FavoriteRepositoryPort.class);
        favoritePlaceLookupPort = mock(FavoritePlaceLookupPort.class);
        processor = new FavoriteQueryProcessor(favoriteRepositoryPort, favoritePlaceLookupPort);
        when(favoriteRepositoryPort.findAllByMemberId(MEMBER_ID)).thenReturn(List.of(
            Favorite.builder().id(10L).memberId(MEMBER_ID).placeId(PLACE_ID).savedAt(SAVED_AT).build()));
    }

    @Test
    void getMyFavorites_withSummary_carriesSavedAt() {
        when(favoritePlaceLookupPort.findSummaries(List.of(PLACE_ID))).thenReturn(List.of(
            FavoritePlaceQueryResult.builder().placeId(PLACE_ID).title("협재해수욕장").build()));

        List<FavoritePlaceInfo> infos = processor.getMyFavorites(MEMBER_ID);

        assertThat(infos).hasSize(1);
        assertThat(infos.get(0).title()).isEqualTo("협재해수욕장");
        assertThat(infos.get(0).savedAt()).isEqualTo(SAVED_AT);
    }

    @Test
    void getMyFavorites_summaryMissing_stillCarriesSavedAt() {
        when(favoritePlaceLookupPort.findSummaries(List.of(PLACE_ID))).thenReturn(List.of());

        List<FavoritePlaceInfo> infos = processor.getMyFavorites(MEMBER_ID);

        assertThat(infos.get(0).title()).isNull();
        assertThat(infos.get(0).savedAt()).isEqualTo(SAVED_AT);
    }

    @Test
    void getMyFavorites_lookupFails_stillCarriesSavedAt() {
        when(favoritePlaceLookupPort.findSummaries(List.of(PLACE_ID)))
            .thenThrow(new FavoriteException(FavoriteErrorCode.INTERNAL_SERVICE_UNAVAILABLE));

        List<FavoritePlaceInfo> infos = processor.getMyFavorites(MEMBER_ID);

        assertThat(infos.get(0).placeId()).isEqualTo(PLACE_ID);
        assertThat(infos.get(0).title()).isNull();
        assertThat(infos.get(0).savedAt()).isEqualTo(SAVED_AT);
    }
}
