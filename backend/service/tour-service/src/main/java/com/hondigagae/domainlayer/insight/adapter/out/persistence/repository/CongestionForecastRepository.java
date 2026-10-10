package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom.CongestionForecastCustomRepository;
import org.springframework.data.jpa.repository.JpaRepository;

/** 링크 조인 조회는 {@link CongestionForecastCustomRepository}(QueryDSL) 쪽이다. */
public interface CongestionForecastRepository
    extends JpaRepository<CongestionForecastEntity, Long>, CongestionForecastCustomRepository {

}
