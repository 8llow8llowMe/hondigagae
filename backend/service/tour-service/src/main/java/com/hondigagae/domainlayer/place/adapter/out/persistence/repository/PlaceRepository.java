package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.adapter.out.persistence.repository.custom.PlaceCustomRepository;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceCoordinateQueryResult;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * 동적 조건 검색은 {@link PlaceCustomRepository}(QueryDSL) 쪽이다.
 * 여기는 조건이 고정된 파생·단순 쿼리만 남긴다.
 */
public interface PlaceRepository extends JpaRepository<PlaceEntity, Long>, PlaceCustomRepository {

    /**
     * 병합으로 사라진 행은 상세 조회에서도 노출하지 않는다.
     *
     * <p>delisted 는 반대로 상세에서 계속 노출한다 — 기존 일정(plan_item)이 참조하는
     * 장소가 원천에서 빠졌다고 일정 화면까지 깨지면 안 된다. 응답의 delisted 플래그로
     * "더 이상 확인되지 않는 장소"임을 드러낸다.
     */
    Optional<PlaceEntity> findByIdAndMergedIntoIdIsNull(long placeId);

    /**
     * 주어진 아이디 중 실제로 노출 가능한 것만 돌려준다. 일정 항목 검증용이다.
     *
     * <p>delisted 를 제외하는 것이 정책이다 — 새 일정 항목이 원천에서 사라진 장소를
     * 참조하게 두지 않는다. 이미 담긴 항목의 상세 조회는 위 메서드가 계속 받아 준다.
     */
    @Query("""
        select p.id from PlaceEntity p
        where p.id in :placeIds
          and p.mergedIntoId is null
          and p.delistedAt is null
        """)
    List<Long> findVisibleIds(Collection<Long> placeIds);

    /** 아이디로 노출 가능한 장소 엔티티를 준다. ai-service 의 필수 포함 후보 조회용. */
    @Query("""
        select p from PlaceEntity p
        where p.id in :placeIds
          and p.mergedIntoId is null
          and p.delistedAt is null
        """)
    List<PlaceEntity> findVisiblePlaces(Collection<Long> placeIds);

    /**
     * 거리순 목록의 커서 좌표 (#1202). 조건이 고정된 단건 projection 이라 정적 JPQL 로 둔다.
     *
     * <p><b>노출 여부를 보지 않는다.</b> 직전 페이지의 마지막 장소가 그사이 병합·delisted 되어도 좌표 행은 남아 있어
     * 그 좌표로 거리 키를 되살리면 다음 페이지가 이어진다. 좌표가 없거나 장소가 없으면 빈 값이다.
     */
    @Query("""
        select new com.hondigagae.domainlayer.place.application.port.out.query.PlaceCoordinateQueryResult(p.id, p.lat, p.lng)
        from PlaceEntity p
        where p.id = :placeId
          and p.lat is not null
          and p.lng is not null
        """)
    Optional<PlaceCoordinateQueryResult> findCoordinateById(long placeId);
}
