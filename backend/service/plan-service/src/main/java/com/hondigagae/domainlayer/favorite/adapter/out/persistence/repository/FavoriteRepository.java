package com.hondigagae.domainlayer.favorite.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.favorite.adapter.out.persistence.entity.FavoriteEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteRepository extends JpaRepository<FavoriteEntity, Long> {

    /** Snowflake 아이디가 시간순이라 id 내림차순 = 최근 저장순이다. */
    List<FavoriteEntity> findAllByMemberIdOrderByIdDesc(long memberId);

    Optional<FavoriteEntity> findByMemberIdAndPlaceId(long memberId, long placeId);

    boolean existsByMemberIdAndPlaceId(long memberId, long placeId);

    long countByMemberId(long memberId);
}
