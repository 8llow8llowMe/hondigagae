package com.hondigagae.domainlayer.favorite.application.mapper;

import com.hondigagae.domainlayer.favorite.adapter.out.persistence.entity.FavoriteEntity;
import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import java.util.List;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface FavoriteMapper {

    // 엔티티 -> 도메인
    Favorite toDomainFromEntity(FavoriteEntity entity);

    // 도메인 -> 엔티티
    FavoriteEntity toEntityFromDomain(Favorite favorite);

    // 엔티티 리스트 -> 도메인 리스트
    List<Favorite> toDomainListFromEntityList(List<FavoriteEntity> entities);
}
