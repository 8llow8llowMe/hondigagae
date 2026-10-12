package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.QCongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.QPlaceNameLinkEntity;
import com.hondigagae.shared.travel.insight.NameLinkSourceType;
import com.hondigagae.shared.travel.insight.NameMatchType;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.Collection;
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
            // 같은 장소 · 같은 날짜에 링크가 여럿이면 예측 아이디가 작은 것이 먼저다 — 여러 장소 조회(아래)와 같은 건을 고른다 (#1368).
            .orderBy(forecast.baseYmd.asc(), forecast.id.asc())
            .fetch();
    }

    /**
     * 여러 장소의 하루치 예측 (#1368). 위 단건 질의와 같은 조인 · 같은 UNMATCHED 제외를 쓰고, 장소를 {@code in} 으로
     * 묶는다 — 추천이 후보 수십 곳의 혼잡도를 볼 때 장소마다 질의하지 않게 한다 (coding-conventions §9-7).
     *
     * <p>어느 예측이 어느 장소 것인지는 링크의 장소 아이디로 가른다. 정렬을 못박아 같은 장소에 링크가 여럿일 때도
     * 결과 순서가 실행마다 같다.
     */
    @Override
    public List<PlaceLinkedCongestionForecast> findLinkedByPlaceIdsAndDate(
        Collection<Long> placeIds, String baseYmd, NameLinkSourceType sourceType) {

        if (placeIds == null || placeIds.isEmpty()) {
            return List.of();
        }

        QCongestionForecastEntity forecast = QCongestionForecastEntity.congestionForecastEntity;
        QPlaceNameLinkEntity link = QPlaceNameLinkEntity.placeNameLinkEntity;

        return queryFactory
            .select(Projections.constructor(PlaceLinkedCongestionForecast.class, link.placeId, forecast))
            .from(forecast)
            .join(link).on(
                forecast.areaCd.eq(link.areaCd),
                forecast.signguCd.eq(link.signguCd),
                forecast.tatsNm.eq(link.tatsNm))
            .where(
                link.placeId.in(placeIds),
                link.sourceType.eq(sourceType),
                link.matchType.ne(NameMatchType.UNMATCHED),
                forecast.baseYmd.eq(baseYmd))
            .orderBy(link.placeId.asc(), forecast.id.asc())
            .fetch();
    }
}
