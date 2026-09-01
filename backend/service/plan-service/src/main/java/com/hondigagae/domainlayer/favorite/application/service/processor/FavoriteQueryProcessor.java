package com.hondigagae.domainlayer.favorite.application.service.processor;

import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import com.hondigagae.domainlayer.favorite.application.info.FavoritePlaceInfo;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoritePlaceLookupPort;
import com.hondigagae.domainlayer.favorite.application.port.out.FavoriteRepositoryPort;
import com.hondigagae.domainlayer.favorite.application.port.out.query.FavoritePlaceQueryResult;
import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class FavoriteQueryProcessor {

    private final FavoriteRepositoryPort favoriteRepositoryPort;
    private final FavoritePlaceLookupPort favoritePlaceLookupPort;

    /**
     * 내 즐겨찾기 목록 (최근 저장순). 장소 요약은 tour-service 에서 붙인다.
     *
     * <p>장식 조회 실패는 목록 조회 실패로 번지지 않는다 — placeId 만으로도 목록은
     * 성립하고, tour 장애가 "내 찜 목록이 안 보임"이 되면 안 된다 (관용 원칙).
     * 원천에서 사라진(delisted) 장소는 요약 없이 placeId 로만 남는다.
     */
    public List<FavoritePlaceInfo> getMyFavorites(long memberId) {
        List<Favorite> favorites = favoriteRepositoryPort.findAllByMemberId(memberId);
        if (favorites.isEmpty()) {
            return List.of();
        }
        Map<Long, FavoritePlaceQueryResult> summaries = loadSummaries(favorites);
        return favorites.stream()
            .map(favorite -> toInfo(favorite, summaries.get(favorite.placeId())))
            .toList();
    }

    public List<Long> getMyFavoritePlaceIds(long memberId) {
        return favoriteRepositoryPort.findAllByMemberId(memberId).stream()
            .map(Favorite::placeId)
            .toList();
    }

    private Map<Long, FavoritePlaceQueryResult> loadSummaries(List<Favorite> favorites) {
        List<Long> placeIds = favorites.stream().map(Favorite::placeId).toList();
        try {
            return favoritePlaceLookupPort.findSummaries(placeIds).stream()
                .collect(Collectors.toMap(FavoritePlaceQueryResult::placeId, Function.identity()));
        } catch (FavoriteException exception) {
            log.warn("Favorite place decoration failed, returning ids only. errorCode={}",
                exception.getErrorCode().getCode());
            return Map.of();
        }
    }

    private FavoritePlaceInfo toInfo(Favorite favorite, FavoritePlaceQueryResult summary) {
        if (summary == null) {
            return FavoritePlaceInfo.builder().placeId(favorite.placeId()).build();
        }
        return FavoritePlaceInfo.builder()
            .placeId(summary.placeId())
            .title(summary.title())
            .contentTypeName(summary.contentTypeName())
            .addr(summary.addr())
            .petAllowanceName(summary.petAllowanceName())
            .indoor(summary.indoor())
            .firstImage(summary.firstImage())
            .build();
    }
}
