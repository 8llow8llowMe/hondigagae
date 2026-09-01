package com.hondigagae.domainlayer.favorite.application.service;

import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoritePlacesResponse;
import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoriteStatusResponse;
import com.hondigagae.domainlayer.favorite.adapter.in.web.presenter.FavoritePresenter;
import com.hondigagae.domainlayer.favorite.application.port.in.FavoriteWebUseCase;
import com.hondigagae.domainlayer.favorite.application.service.processor.FavoriteCommandProcessor;
import com.hondigagae.domainlayer.favorite.application.service.processor.FavoriteQueryProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FavoriteWebFacade implements FavoriteWebUseCase {

    private final FavoriteQueryProcessor favoriteQueryProcessor;
    private final FavoriteCommandProcessor favoriteCommandProcessor;
    private final FavoritePresenter favoritePresenter;

    /**
     * 목록 조회에 {@code @Transactional} 을 붙이지 않는다 — 장식용 원격 조회(tour-service)가
     * 섞여 있어 트랜잭션 안에서 수행하면 DB 커넥션을 잡은 채 원격 응답을 기다리게 된다.
     * 저장소 접근은 각 포트 호출 단위로 충분하다.
     */
    @Override
    public FavoritePlacesResponse getMyFavorites(long memberId) {
        return favoritePresenter.toFavoritePlacesResponse(favoriteQueryProcessor.getMyFavorites(memberId));
    }

    @Override
    @Transactional(readOnly = true)
    public FavoriteStatusResponse getFavoriteStatus(long memberId, long placeId) {
        return FavoriteStatusResponse.builder()
            .placeId(String.valueOf(placeId))
            .favorited(favoriteQueryProcessor.isFavorited(memberId, placeId))
            .build();
    }

    /** 저장도 같은 이유로 파사드 트랜잭션을 두지 않는다 — 존재 검증이 원격 조회다. */
    @Override
    public void addFavorite(long memberId, long placeId) {
        favoriteCommandProcessor.add(memberId, placeId);
    }

    @Override
    @Transactional
    public void removeFavorite(long memberId, long placeId) {
        favoriteCommandProcessor.remove(memberId, placeId);
    }
}
