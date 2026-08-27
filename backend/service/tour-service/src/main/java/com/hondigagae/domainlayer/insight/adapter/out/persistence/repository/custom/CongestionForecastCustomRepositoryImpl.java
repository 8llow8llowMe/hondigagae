package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.QCongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.QPlaceNameLinkEntity;
import com.hondigagae.domainlayer.insight.domain.enums.NameLinkSourceType;
import com.hondigagae.domainlayer.insight.domain.enums.NameMatchType;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class CongestionForecastCustomRepositoryImpl implements CongestionForecastCustomRepository {

    private final JPAQueryFactory queryFactory;

    /**
     * 링크 테이블을 거쳐 장소의 집중률 예측을 가져온다.
     *
     * <p>JPA 연관관계를 쓰지 않는 규칙(coding-conventions §9-1)이라 엔티티 조인을
     * {@code on} 절로 직접 잇는다. 예전 JPQL 은 두 엔티티를 나열하고 where 로 묶는
     * 세타 조인이었는데, 조인 의도가 문장에 드러나지 않아 QueryDSL 로 옮겼다.
     *
     * <p>{@code matchType <> UNMATCHED} 가 중요하다. 매칭 실패 링크가 남아 있어도
     * 그 행을 타고 엉뚱한 장소의 혼잡도가 붙어서는 안 된다.
     */
    @Override
    public List<CongestionForecastEntity> findLinkedByPlaceIdAndDateRange(
        long placeId, String fromYmd, String toYmd, NameLinkSourceType sourceType) {

        QCongestionForecastEntity forecast = QCongestionForecastEntity.congestionForecastEntity;
        QPlaceNameLinkEntity link = QPlaceNameLinkEntity.placeNameLinkEntity;

        return queryFactory
            .selectFrom(forecast)
            .join(link).on(
                forecast.areaCd.eq(link.areaCd),
                forecast.signguCd.eq(link.signguCd),
                forecast.tatsNm.eq(link.tatsNm))
            .where(
                link.placeId.eq(placeId),
                link.sourceType.eq(sourceType),
                link.matchType.ne(NameMatchType.UNMATCHED),
                forecast.baseYmd.between(fromYmd, toYmd))
            .orderBy(forecast.baseYmd.asc())
            .fetch();
    }
}
