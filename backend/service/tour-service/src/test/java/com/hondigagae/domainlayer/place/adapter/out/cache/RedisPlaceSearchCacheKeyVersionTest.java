package com.hondigagae.domainlayer.place.adapter.out.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.redis.properties.RedisProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

class RedisPlaceSearchCacheKeyVersionTest {

    private RedisPlaceSearchCacheAdapter adapter;

    @BeforeEach
    void setUp() {
        RedisProperties properties = mock(RedisProperties.class);
        when(properties.normalizedKeyPrefix()).thenReturn("test");
        adapter = new RedisPlaceSearchCacheAdapter(mock(StringRedisTemplate.class), properties, new ObjectMapper(), 300);
    }

    @Test
    @DisplayName("목록은 기준 좌표가 키에 들어간 v3, 주변은 토큰 AND 의미의 v2 네임스페이스를 쓴다 (#1202)")
    void usesVersionThreeForListAndVersionTwoForNearby() {
        String listKey = listKey(PlaceSearchCriteria.builder().keyword("성산 고성리").size(20).build());
        String nearbyKey = ReflectionTestUtils.invokeMethod(adapter, "nearbyKey",
            NearbyPlaceCriteria.builder().lat(33.45).lng(126.94).radius(5000)
                .keyword("성산 고성리").size(15).build());

        assertThat(listKey).startsWith("test:tour:place:list:v3:");
        assertThat(nearbyKey).startsWith("test:tour:place:nearby:v2:");
    }

    @Test
    @DisplayName("기준 좌표가 다르면 목록 캐시 키도 다르다 — 거리순과 id 순이 한 키를 나눠 쓰지 않는다")
    void originChangesListKey() {
        PlaceSearchCriteria.PlaceSearchCriteriaBuilder base = PlaceSearchCriteria.builder().keyword("중문").size(20);

        String idOrder = listKey(base.build());
        String fromJungmun = listKey(base.lat(33.2541).lng(126.4129).build());
        String fromSeongsan = listKey(base.lat(33.4590).lng(126.9425).build());
        String latOnlyDiffers = listKey(base.lat(33.4590).lng(126.4129).build());

        assertThat(idOrder).isNotEqualTo(fromJungmun);
        assertThat(fromJungmun).isNotEqualTo(fromSeongsan);
        assertThat(latOnlyDiffers).isNotEqualTo(fromJungmun).isNotEqualTo(fromSeongsan);
        assertThat(listKey(base.lat(33.2541).lng(126.4129).build())).isEqualTo(fromJungmun);
    }

    private String listKey(PlaceSearchCriteria criteria) {
        return ReflectionTestUtils.invokeMethod(adapter, "listKey", criteria);
    }
}
