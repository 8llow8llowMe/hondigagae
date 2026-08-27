package com.hondigagae.domainlayer.place.adapter.out.persistence.repository.custom;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.QPlaceEntity;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.SliceImpl;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class PlaceCustomRepositoryImpl implements PlaceCustomRepository {

    private static final QPlaceEntity place = QPlaceEntity.placeEntity;

    private final JPAQueryFactory queryFactory;

    @Override
    public Slice<PlaceEntity> searchByCriteria(PlaceSearchCriteria criteria) {
        BooleanBuilder where = visible()
            .and(commonFilters(criteria.contentType(), criteria.petAllowanceType(), criteria.indoor(),
                criteria.allowedPetSize(), criteria.petSizeType(), criteria.petWeightKg(),
                criteria.sourceCategory()));
        if (criteria.areaCode() != null) {
            where.and(place.areaCode.eq(criteria.areaCode()));
        }
        if (criteria.sigunguCode() != null) {
            where.and(place.sigunguCode.eq(criteria.sigunguCode()));
        }
        if (criteria.lastPlaceId() != null) {
            where.and(place.id.lt(criteria.lastPlaceId()));
        }

        // hasNext 판정을 위해 한 건 더 가져온다. 커서 방식이라 total count 가 필요 없다.
        List<PlaceEntity> rows = queryFactory
            .selectFrom(place)
            .where(where)
            .orderBy(place.id.desc())
            .limit(criteria.size() + 1L)
            .fetch();

        boolean hasNext = rows.size() > criteria.size();
        List<PlaceEntity> content = hasNext ? rows.subList(0, criteria.size()) : rows;
        return new SliceImpl<>(content, PageRequest.of(0, criteria.size()), hasNext);
    }

    @Override
    public List<PlaceEntity> searchNearby(NearbyPlaceCriteria criteria) {
        double latDelta = GeoDistance.latDelta(criteria.radius());
        double lngDelta = GeoDistance.lngDelta(criteria.radius(), criteria.lat());

        BooleanBuilder where = visible()
            .and(commonFilters(criteria.contentType(), criteria.petAllowanceType(), criteria.indoor(),
                criteria.allowedPetSize(), criteria.petSizeType(), criteria.petWeightKg(),
                criteria.sourceCategory()))
            // 좌표가 없는 장소는 between 조건에서 자연히 빠진다 — 반경 검색의 대상이 아니다
            .and(place.lat.between(
                BigDecimal.valueOf(criteria.lat() - latDelta), BigDecimal.valueOf(criteria.lat() + latDelta)))
            .and(place.lng.between(
                BigDecimal.valueOf(criteria.lng() - lngDelta), BigDecimal.valueOf(criteria.lng() + lngDelta)));

        return queryFactory.selectFrom(place).where(where).fetch();
    }

    /** 노출 가능한 행 — 병합으로 흡수됐거나 원천에서 사라진 장소는 어느 검색에도 나오지 않는다. */
    private BooleanBuilder visible() {
        return new BooleanBuilder()
            .and(place.mergedIntoId.isNull())
            .and(place.delistedAt.isNull());
    }

    /** 목록·주변 검색이 공유하는 필터. null 인 조건은 where 에 아예 들어가지 않는다. */
    private BooleanBuilder commonFilters(ContentType contentType, PetAllowanceType petAllowanceType,
        Boolean indoor, AllowedPetSize allowedPetSize, PetSizeType petSizeType, Integer petWeightKg,
        String sourceCategory) {

        BooleanBuilder where = new BooleanBuilder();
        if (contentType != null) {
            where.and(place.contentTypeId.eq(contentType.getCode()));
        }
        if (petAllowanceType != null) {
            where.and(place.petAllowanceType.eq(petAllowanceType));
        }
        if (indoor != null) {
            // indoor 가 null 인 장소는 어느 쪽으로도 잡히지 않는다 — "정보 없음"과 "실외"는 다르다
            where.and(place.indoor.eq(indoor));
        }
        if (allowedPetSize != null) {
            where.and(place.allowedPetSize.eq(allowedPetSize));
        }
        if (petSizeType != null) {
            // 받아 주지 않는 것으로 확인된 곳만 뺀다. UNKNOWN 은 allowing 집합에 남는다.
            where.and(place.allowedPetSize.in(AllowedPetSize.allowing(petSizeType)));
        }
        if (petWeightKg != null) {
            // 상한이 명시된 곳만 정확히 거른다. 상한 정보가 없으면 enum 판정에 맡긴다.
            where.and(place.maxPetWeightKg.isNull().or(place.maxPetWeightKg.goe(petWeightKg)));
        }
        if (sourceCategory != null) {
            where.and(place.sourceCategory.eq(sourceCategory));
        }
        return where;
    }
}
