package com.hondigagae.domainlayer.favorite.adapter.in.web.presenter;

import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.item.FavoritePlaceItem;
import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoritePlacesResponse;
import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoriteStatusResponse;
import com.hondigagae.domainlayer.favorite.application.info.FavoritePlaceInfo;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class FavoritePresenter {

    public FavoritePlacesResponse toFavoritePlacesResponse(List<FavoritePlaceInfo> infos) {
        List<FavoritePlaceItem> places = infos.stream()
            .map(this::toItem)
            .toList();
        return FavoritePlacesResponse.builder()
            .places(places)
            .totalCount(places.size())
            .build();
    }

    /** 장소 아이디의 문자열 변환은 응답 경계(Presenter)에서만 한다 — Facade 에 두면 규칙이 두 곳으로 갈린다. */
    public FavoriteStatusResponse toStatusResponse(long placeId, boolean favorited) {
        return FavoriteStatusResponse.builder()
            .placeId(String.valueOf(placeId))
            .favorited(favorited)
            .build();
    }

    private FavoritePlaceItem toItem(FavoritePlaceInfo info) {
        return FavoritePlaceItem.builder()
            .placeId(String.valueOf(info.placeId()))
            .title(info.title())
            .contentTypeName(info.contentTypeName())
            .addr(info.addr())
            .petAllowanceName(info.petAllowanceName())
            .indoor(info.indoor())
            .firstImage(info.firstImage())
            .build();
    }
}
