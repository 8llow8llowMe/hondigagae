package com.hondigagae.domainlayer.favorite.application.port.out;

import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import java.util.List;
import java.util.Optional;

public interface FavoriteRepositoryPort {

    Favorite save(Favorite favorite);

    Optional<Favorite> findByMemberIdAndPlaceId(long memberId, long placeId);

    /** 존재 여부만 볼 때 쓴다 — 엔티티를 통째로 실어 오지 않는다. */
    boolean existsByMemberIdAndPlaceId(long memberId, long placeId);

    /** 최근 저장순. */
    List<Favorite> findAllByMemberId(long memberId);

    long countByMemberId(long memberId);

    void deleteById(long favoriteId);
}
