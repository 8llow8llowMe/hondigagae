package com.hondigagae.domainlayer.insight.application.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 엔티티 → 판정 입력 매핑 (#1461).
 *
 * <p>MapStruct 는 이름으로 옮기고, 대상 칸을 못 채워도 <b>경고만 내고 빌드는 통과한다</b>(이 저장소는 unmappedTargetPolicy 를
 * 올리지 않았다). 엔티티 쪽 이름이 바뀌면 실내 대안의 장소 유형이 조용히 null 이 되어 프론트가 음식점을 일반 장소로 담는다 —
 * 컴파일이 못 잡는 자리라 여기서 찍는다.
 */
class InsightMapperPlaceConditionTest {

    private final InsightMapper insightMapper = new InsightMapperImpl();

    @Test
    @DisplayName("장소 유형 코드와 원본 분류가 엔티티의 같은 이름 칸에서 건너온다")
    void carriesContentTypeIdAndSourceCategory() {
        PlaceEntity entity = PlaceEntity.builder()
            .id(212481712381923328L)
            .contentTypeId("39")
            .sourceCategory("카페")
            .title("오설록 티뮤지엄")
            .lat(new BigDecimal("33.3058"))
            .lng(new BigDecimal("126.2895"))
            .indoor(true)
            .build();

        PlaceCondition condition = insightMapper.toPlaceConditionFromEntity(entity);

        assertThat(condition.placeId()).isEqualTo(212481712381923328L);
        assertThat(condition.contentTypeId()).isEqualTo("39");
        assertThat(condition.sourceCategory()).isEqualTo("카페");
    }
}
