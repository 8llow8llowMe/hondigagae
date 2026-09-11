package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceIntroTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import java.util.List;

/**
 * place_intro 대량 쓰기 포트 (coding-conventions §12-3 *BulkPort).
 *
 * <p>문화정보원 원천의 place_intro 쓰기는 {@code PlaceBulkPort} 안에 있다. 이 포트를 따로 둔 이유는
 * 두 가지다 — TourAPI 경로는 <b>대상 조회</b>가 필요하고(쿼터 때문에 증분으로 고른다), 원천이
 * 소유하는 컬럼 집합이 다르다(문화정보원은 {@code info_center}/{@code chk_*} 를 모른다).
 */
public interface PlaceIntroBulkPort {

    /**
     * detailIntro2 적재 대상 — 노출 중인(병합·delisted 아님) TourAPI 원천 장소.
     *
     * <p>"intro 행이 없는 곳 먼저 → 그다음 {@code synced_at} 오래된 순"으로 골라 {@code limit} 개만
     * 돌려준다. 쿼터(일 1,000건)가 전량을 한 번에 덮을 수 없어서다 — 주 1회 실행이 반복되며
     * 미적재분을 먼저 채우고, 다 채워진 뒤에는 오래된 것부터 갱신하는 순환이 된다.
     *
     * @param contentTypes 운영시간 필드가 있는 타입 목록. 비면 빈 목록을 돌려준다
     * @param limit        이번 실행에서 호출할 최대 장소 수
     */
    List<PlaceIntroTargetQueryResult> findTourApiTargets(List<PlaceContentType> contentTypes, int limit);

    /**
     * 한 장소의 상세 소개를 upsert 한다. place_intro 는 장소와 1:1 이라 행 id 로 place id 를
     * 그대로 쓴다 (문화정보원 경로와 같은 규칙) — 재실행이 멱등이다.
     */
    void upsert(long placeId, ImportedPlaceIntro intro);

    /**
     * 원천에서 내용을 받지 못한 장소(빈 응답·호출 실패)의 {@code synced_at} 만 만진다.
     * 행이 없으면 빈 행을 만든다.
     *
     * <p><b>이게 없으면 그 장소들이 대상 선정을 영원히 막는다.</b> 정렬 기준이 "intro 없는 곳 먼저"
     * 인데 내용을 못 받은 장소는 행이 생기지 않아, 매 실행 같은 곳들이 앞자리를 차지하며
     * 희소한 예산을 먹고 나머지 장소는 한 번도 차례가 오지 않는다. 여기서 뒤로 밀린 장소는
     * 순환이 한 바퀴 돈 뒤 자연스럽게 다시 시도된다.
     *
     * <p>내용 컬럼은 건드리지 않는다 — 원천이 이번에 말이 없다고 해서 이미 있는 값을 지울 이유가
     * 없다 (지오코딩 실패 업소의 {@code touchPetRestaurantsSyncedAt} 와 같은 규칙).
     */
    void touchSyncedAt(long placeId);
}
