package com.hondigagae.domainlayer.place.adapter.out.persistence.repository.custom;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.QPlaceEntity;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceKeyword;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceCoordinateQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSitemapEntryQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.Projections;
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
     *
     * <p>기준 좌표가 없는 목록만 여기로 온다. 거리순(#1202)은 {@link #findCoordinatesByCriteria} 로 후보를 받아
     * Processor 가 정렬한다 — ai-service 후보 조회처럼 좌표 없이 부르는 쪽의 SQL·순서는 그대로다.
     */
    @Override
    public Slice<PlaceEntity> searchByCriteria(PlaceSearchCriteria criteria) {
        BooleanBuilder where = listFilters(criteria);
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

    /**
     * 거리순 목록의 후보 (#1202). <b>목록과 같은 필터({@link #listFilters})</b>에 좌표가 둘 다 있는 행만 더해
     * 아이디·좌표 세 컬럼을 전량 준다. 새 쿼리지만 노출 규칙을 그대로 거친다 — 빠뜨리면 병합·delisted 장소가
     * 거리순에서만 살아난다.
     *
     * <p>정렬하지 않고 {@code lastPlaceId} 로 자르지도 않는다. 거리순 커서는 id 가 아니라 (거리, id) 키로 넘으므로
     * 그 비교는 거리를 아는 호출한 쪽(Processor)이 한다. 좌표가 없는 장소는 거리를 잴 수 없어 빠진다 — 주변
     * 검색과 같은 판단이다.
     *
     * <p>엔티티 전체(개요 TEXT 등)를 읽지 않으려고 projection 으로 가져온다. 제주 2,300여 곳이라 페이지마다 전량을
     * 메모리에서 정렬해도 싸다. 전국으로 넓히면 공간 인덱스·DB 정렬로 옮길 자리가 여기다.
     */
    @Override
    public List<PlaceCoordinateQueryResult> findCoordinatesByCriteria(PlaceSearchCriteria criteria) {
        BooleanBuilder where = listFilters(criteria)
            .and(place.lat.isNotNull())
            .and(place.lng.isNotNull());

        return queryFactory
            .select(Projections.constructor(PlaceCoordinateQueryResult.class, place.id, place.lat, place.lng))
            .from(place)
            .where(where)
            .fetch();
    }

    /**
     * 목록(id 순·거리순)이 함께 거는 필터 — 노출 규칙, 공통 필터, 지역. 커서와 정렬은 넣지 않는다(정렬 키마다 다르다).
     * 두 목록이 이 한곳을 거치므로 필터가 갈라지지 않는다.
     */
    private BooleanBuilder listFilters(PlaceSearchCriteria criteria) {
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
        return where;
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
        // 목록(listFilters)과 같은 판단이다 — null 이면 조건을 걸지 않아 생략한 요청은 예전과 같다 (#1316)
        if (criteria.sigunguCode() != null) {
            where.and(place.sigunguCode.eq(criteria.sigunguCode()));
        }

        return queryFactory.selectFrom(place).where(where).fetch();
    }

    /**
     * 사이트맵용 전량. <b>노출 규칙은 목록·주변과 같은 {@link #visible()} 이다</b> — 병합된 장소는 상세가
     * 404 이고, delisted 장소는 더는 확인되지 않는 곳이라 크롤러에 알릴 URL 이 아니다.
     *
     * <p>동반 구분으로는 거르지 않는다. 어느 판정을 색인할지는 호출한 쪽(사이트맵 생성)이 정한다.
     *
     * <p>페이지 없이 전량이라 엔티티 전체(개요 TEXT 등)를 읽지 않고 세 컬럼만 projection 으로 가져온다.
     * 제주 2,300여 곳 규모라 한 번에 준다. 사이트맵 파일 하나의 상한(5만 URL)에 다가가면 페이지를 다시 설계한다.
     */
    @Override
    public List<PlaceSitemapEntryQueryResult> findSitemapEntries() {
        return queryFactory
            .select(Projections.constructor(PlaceSitemapEntryQueryResult.class,
                place.id, place.petAllowanceType, place.sourceModifiedAt))
            .from(place)
            .where(visible())
            .orderBy(place.id.asc())
            .fetch();
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
        PlaceKeyword.tokens(keyword).forEach(token -> {
            String escaped = PlaceKeyword.escapeLike(token);
            where.and(new BooleanBuilder()
                .or(place.title.likeIgnoreCase("%" + escaped + "%", '\\'))
                .or(place.addr1.likeIgnoreCase("%" + escaped + "%", '\\')));
        });
        return where;
    }
}
