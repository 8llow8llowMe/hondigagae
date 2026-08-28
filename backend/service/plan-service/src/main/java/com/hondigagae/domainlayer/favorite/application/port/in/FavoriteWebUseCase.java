package com.hondigagae.domainlayer.favorite.application.port.in;

import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoritePlacesResponse;

public interface FavoriteWebUseCase {

    FavoritePlacesResponse getMyFavorites(long memberId);

    void addFavorite(long memberId, long placeId);

    void removeFavorite(long memberId, long placeId);
}
