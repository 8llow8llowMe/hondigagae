package com.hondigagae.domainlayer.insight.application.mapper;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.domain.enums.CongestionLevel;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityThresholds;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.global.properties.InsightProperties;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

/**
 * insight 컨텍스트의 Entity ↔ Domain 매핑 (coding-conventions §4).
 *
 * <p>Entity 를 참조하는 것은 {@code application/mapper} 에 허용된 문서화된 예외다
 * (architecture-guide §3).
 *
 * <p>{@code PlaceEntity} 는 place 컨텍스트의 것을 그대로 읽는다. 같은 서비스 안에서 테이블
 * 하나를 두 벌로 매핑하면 컬럼이 늘 때 한쪽만 고치는 사고가 난다.
 *
 * <p>메서드 이름을 대상별로 나눈 이유는 오버로드로 두면 메서드 참조
 * ({@code insightMapper::toDomainFromEntity})가 어느 쪽인지 정하지 못하기 때문이다.
 */
@Mapper(componentModel = "spring")
public interface InsightMapper {

    // 엔티티 -> 도메인
    @Mapping(target = "placeId", source = "id")
    PlaceCondition toPlaceConditionFromEntity(PlaceEntity entity);

    // 엔티티 리스트 -> 도메인 리스트

    // 엔티티 -> 도메인
    @Mapping(target = "date", source = "baseYmd", qualifiedByName = "toForecastDate")
    @Mapping(target = "concentrationRate", source = "cnctrRate")
    @Mapping(target = "level", source = "cnctrRate", qualifiedByName = "toCongestionLevel")
    CongestionSnapshot toCongestionSnapshotFromEntity(CongestionForecastEntity entity);

    /**
     * 프로퍼티 -> 도메인 임계값.
     *
     * <p>도메인이 Spring 프로퍼티 타입을 직접 알지 않게 한 겹 둔다. 필드명이 그대로 대응하므로
     * 손으로 옮겨 적을 이유가 없다 - 임계값이 하나 늘 때마다 옮겨 적는 코드를 고치는 것이
     * 빠뜨리기 쉬운 자리다.
     */
    SuitabilityThresholds toThresholds(InsightProperties properties);

    /** 원천이 {@code yyyyMMdd} 문자열로 준다. */
    @Named("toForecastDate")
    default LocalDate toForecastDate(String baseYmd) {
        return baseYmd == null ? null : LocalDate.parse(baseYmd, DateTimeFormatter.BASIC_ISO_DATE);
    }

    /** 등급은 저장된 값이 아니라 집중률에서 파생한다. 구간 판정의 단일 기준은 enum 이다. */
    @Named("toCongestionLevel")
    default CongestionLevel toCongestionLevel(Double concentrationRate) {
        return CongestionLevel.from(concentrationRate);
    }
}
