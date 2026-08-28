package com.hondigagae.domainlayer.favorite.application.service;

import com.hondigagae.domainlayer.favorite.application.port.in.FavoriteInternalUseCase;
import com.hondigagae.domainlayer.favorite.application.service.processor.FavoriteQueryProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FavoriteInternalFacade implements FavoriteInternalUseCase {

    private final FavoriteQueryProcessor favoriteQueryProcessor;

    @Override
    @Transactional(readOnly = true)
    public List<Long> getFavoritePlaceIds(long memberId) {
        return favoriteQueryProcessor.getMyFavoritePlaceIds(memberId);
    }
}
