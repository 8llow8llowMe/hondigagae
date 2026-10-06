package com.hondigagae.domainlayer.place.adapter.out.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.redis.properties.RedisProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

class RedisPlaceSearchCacheKeyVersionTest {

    @Test
    @DisplayName("목록과 주변 검색 캐시는 토큰 AND 의미의 v2 네임스페이스를 사용한다")
    void usesVersionTwoNamespaceForBothSearches() {
        RedisProperties properties = mock(RedisProperties.class);
        when(properties.normalizedKeyPrefix()).thenReturn("test");
        RedisPlaceSearchCacheAdapter adapter = new RedisPlaceSearchCacheAdapter(
            mock(StringRedisTemplate.class), properties, new ObjectMapper(), 300);

        String listKey = ReflectionTestUtils.invokeMethod(adapter, "listKey",
            PlaceSearchCriteria.builder().keyword("성산 고성리").size(20).build());
        String nearbyKey = ReflectionTestUtils.invokeMethod(adapter, "nearbyKey",
            NearbyPlaceCriteria.builder().lat(33.45).lng(126.94).radius(5000)
                .keyword("성산 고성리").size(15).build());

        assertThat(listKey).startsWith("test:tour:place:list:v2:");
        assertThat(nearbyKey).startsWith("test:tour:place:nearby:v2:");
    }
}
