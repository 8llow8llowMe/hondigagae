package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetInfoTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import java.util.Collection;
import java.util.List;

/**
 * place_pet_info 대량 쓰기 포트 (coding-conventions §12-3 *BulkPort, #877).
 *
 * <p>{@link PlaceIntroBulkPort} 와 같은 모양이다 — 쿼터 때문에 대상을 증분으로 고르고, 장소 하나씩
 * upsert 한다. 다른 점은 대상이 <b>원천이 동반 정보가 있다고 말한 contentId</b> 로 먼저 좁혀진다는 것이다.
 */
public interface PlacePetInfoBulkPort {

    /**
     * detailPetTour2 적재 대상 — {@code contentIds} 에 든 노출 중(병합·delisted 아님) TourAPI 원천 장소.
     *
     * <p>"place_pet_info 행이 없는 곳 먼저 → 그다음 {@code synced_at} 오래된 순 → id" 로 골라
     * {@code limit} 개만 돌려준다.
     *
     * @param contentIds 동기화 목록이 노출 중이라고 한 contentId. 비면 빈 목록을 돌려준다
     * @param limit      이번 실행에서 호출할 최대 장소 수
     */
    List<PlacePetInfoTargetQueryResult> findTourApiTargets(Collection<Long> contentIds, int limit);

    /** 한 장소의 동반 조건을 upsert 한다. 1:1 이라 행 id 로 place id 를 그대로 쓴다 — 재실행이 멱등이다. */
    void upsert(long placeId, ImportedPlacePetInfo petInfo);

    /**
     * 이미 행이 있는 장소의 {@code synced_at} 만 민다 (빈 응답·호출 실패). <b>행을 새로 만들지 않는다.</b>
     *
     * <p>{@code PlaceIntroBulkPort#touchSyncedAt} 과 다른 이유 — place_pet_info 는 행이 있는 것 자체가
     * "동반 조건이 있다" 는 뜻으로 읽힌다(장소 상세의 {@code petInfo} 가 null 이 아니게 된다).
     * 빈 행을 만들면 말해 주는 것이 없는 동반 정보가 생긴다.
     */
    void touchSyncedAt(long placeId);

    /**
     * 원천이 동반 정보를 <b>내렸다고 말한</b>({@code showflag=0}) contentId 의 행을 지운다.
     *
     * <p>목록에 없다는 이유로는 지우지 않는다 — 부재는 지역 키 오류(#726)나 부분 응답에서도 생긴다.
     * 명시적 내림만 근거로 삼으면 원천이 반쯤 답한 날에도 멀쩡한 행을 지우지 않는다.
     *
     * @return 지운 행 수
     */
    int deleteByContentIds(Collection<Long> contentIds);
}
