package com.hondigagae.domainlayer.place.adapter.out.persistence.repository.custom;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.QPlaceEntity;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceKeyword;
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

    /**
     * 커서 목록. <b>id 오름차순이고, 그것이 곧 원천 우선순위다.</b>
     *
     * <p>{@code PlaceIdFactory}(batch-service)가 TourAPI 행에는 {@code contentId}(제주 실측
     * 12만~344만)를, 문화정보원·식약처 행에는 {@code SHA-256} 해시를 2<sup>62</sup> 이상으로
     * 접어 준다. 두 대역이 겹치지 않으므로 <b>오름차순 = TourAPI 먼저</b>다.
     *
     * <p>내림차순이던 것을 뒤집은 이유는 첫 페이지의 내용이다 (#321). 사진·개요·동반 조건을
     * 가진 쪽은 TourAPI 행인데(dev 실측 985건 중 917건에 사진), 내림차순은 이미지가 아예 없는
     * 문화정보원·식약처 행부터 내려보내 관광지·문화시설·숙박·음식점의 첫 화면이 전부 회색
     * 일러스트였다. 정렬을 뒤집는 것만으로 사라지는 문제라 화면에 폴백을 더 얹지 않는다.
     *
     * <p>같은 원천 안에서는 적재 순서(TourAPI 는 contentId 순)이며 시간순이 아니다 — 이 목록에
     * "최신순" 의 뜻은 없다. 최신순이 필요해지면 커서를 정렬 키와 함께 다시 설계해야 한다.
     */
    @Override
    public Slice<PlaceEntity> searchByCriteria(PlaceSearchCriteria criteria) {
        BooleanBuilder where = visible()
            .and(commonFilters(criteria.contentType(), criteria.petAllowanceType(), criteria.indoor(),
                criteria.allowedPetSize(), criteria.petSizeType(), criteria.petWeightKg(),
                criteria.sourceCategory(), criteria.keyword()));
        if (criteria.areaCode() != null) {
            where.and(place.areaCode.eq(criteria.areaCode()));
        }
        if (criteria.sigunguCode() != null) {
            where.and(place.sigunguCode.eq(criteria.sigunguCode()));
        }
        if (criteria.lastPlaceId() != null) {
            // 오름차순이라 커서는 "그 뒤" 다. 정렬과 방향이 어긋나면 같은 페이지를 무한히 돌려준다.
            where.and(place.id.gt(criteria.lastPlaceId()));
        }

        // hasNext 판정을 위해 한 건 더 가져온다. 커서 방식이라 total count 가 필요 없다.
        List<PlaceEntity> rows = queryFactory
            .selectFrom(place)
            .where(where)
            .orderBy(place.id.asc())
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
                criteria.sourceCategory(), criteria.keyword()))
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
        String sourceCategory, String keyword) {

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
        PlaceKeyword.normalize(keyword).ifPresent(normalized -> {
            String escaped = PlaceKeyword.escapeLike(normalized);
            where.and(new BooleanBuilder()
                .or(place.title.likeIgnoreCase("%" + escaped + "%", '\\'))
                .or(place.addr1.likeIgnoreCase("%" + escaped + "%", '\\')));
        });
        return where;
    }
}
