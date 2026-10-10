package com.hondigagae.domainlayer.favorite.application.port.in;

import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoritePlacesResponse;
import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoriteStatusResponse;

public interface FavoriteWebUseCase {

    FavoritePlacesResponse getMyFavorites(long memberId);

    /** 단건 즐겨찾기 여부 — 상세 화면이 목록 전체를 받지 않고 토글 상태를 그릴 수 있게 한다. */
    FavoriteStatusResponse getFavoriteStatus(long memberId, long placeId);

    void addFavorite(long memberId, long placeId);

    void removeFavorite(long memberId, long placeId);
}
