package com.hondigagae.domainlayer.favorite.application.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.favorite.adapter.out.persistence.entity.FavoriteEntity;
import com.hondigagae.domainlayer.favorite.domain.model.Favorite;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class FavoriteMapperTest {

    private final FavoriteMapper mapper = new FavoriteMapperImpl();

    @Test
    void toDomainFromEntity_mapsCreatedAtToSavedAt() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 8, 30, 14, 30, 5);
        FavoriteEntity entity = FavoriteEntity.builder().id(1L).memberId(2L).placeId(3L).build();
        ReflectionTestUtils.setField(entity, "createdAt", createdAt);

        Favorite favorite = mapper.toDomainFromEntity(entity);

        assertThat(favorite.id()).isEqualTo(1L);
        assertThat(favorite.memberId()).isEqualTo(2L);
        assertThat(favorite.placeId()).isEqualTo(3L);
        assertThat(favorite.savedAt()).isEqualTo(createdAt);
    }
}
