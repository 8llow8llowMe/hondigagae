package com.hondigagae.domainlayer.placeimport.application.port.out;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Map;

/**
 * 원천에서 사라진 장소 표시 계약.
 *
 * <p>DELETE 가 아니라 delisted_at 표시다. 사용자의 일정(plan_item)이 장소를 참조하고
 * 있어 지우면 남의 여행 계획이 깨지고, 원천의 일시적 오류로 대량 소실됐을 때 되돌릴 수
 * 있어야 하며, 다시 등록되는 경우 upsert 가 delisted_at 을 NULL 로 되살린다.
 *
 * <p><b>범위는 적재 범위와 같아야 한다.</b> 지역에 대해서는 원래 그렇게 돼 있었고(다른 지역
 * 실행이 기존 지역을 통째로 내리지 않게), #726 에서 콘텐츠 타입까지 같은 규칙을 적용했다 —
 * TourAPI 적재는 타입 단위로 도는데 delist 가 타입을 보지 않으면, 한 타입이 0건으로 들어온
 * 실행 하나가 그 타입의 행 전부를 내린다. 타입 단위로 나뉘지 않는 원천(문화정보원·식약처)은
 * {@code contentTypeIds} 에 {@code null} 을 주어 타입 범위를 걸지 않는다.
 */
public interface PlaceDelistCommandPort {

    /**
     * 해당 원천·지역(·콘텐츠 타입)의 활성(비 delisted) 행 수. 급감 가드의 분모다.
     *
     * <p><b>분자와 같은 범위로 세야 한다.</b> 이번 실행이 적재한 타입만 delist 할 거라면 활성
     * 건수도 그 타입만 세야 비율 비교가 성립한다.
     *
     * @param contentTypeIds 범위로 쓸 contentTypeId 목록. {@code null} 이면 타입으로 자르지 않는다.
     *                       빈 컬렉션은 허용하지 않는다 — 호출부가 앞에서 걸러야 한다
     */
    long countActive(String source, String areaCode, Collection<String> contentTypeIds);

    /**
     * 타입별 활성 행 수. 0건으로 들어온 타입이 DB 에는 행을 갖고 있는지 한 번에 확인하는 용도다.
     *
     * <p>타입마다 단건으로 세지 않는다 — 대상이 최대 7개뿐이어도 루프 안 포트 호출은 만들지
     * 않는다 ({@code coding-conventions.md} §9-7). 활성 행이 0인 타입은 결과에 키 자체가 없다.
     */
    Map<String, Long> countActiveByContentType(String source, String areaCode, Collection<String> contentTypeIds);

    /**
     * 이번 실행이 건드리지 않은 행을 delist 한다. <b>범위는 적재 범위와 같아야 한다</b> —
     * 적재는 지역·타입 단위인데 delist 가 source 전체면, 다른 범위의 실행이 기존 행을 통째로 내린다.
     *
     * @param source         원천 (TOUR_API / CULTURE_PORTAL / MFDS)
     * @param areaCode       이번 실행이 적재한 관광 지역코드
     * @param contentTypeIds 이번 실행이 실제로 적재한 contentTypeId 목록. {@code null} 이면 타입으로
     *                       자르지 않는다. 빈 컬렉션은 허용하지 않는다
     * @param runStartedAt   이번 실행 시작 시각. synced_at 이 이보다 앞서면 이번 원천에 없던 행이다
     * @return delist 된 행 수
     */
    int delistStale(String source, String areaCode, Collection<String> contentTypeIds, LocalDateTime runStartedAt);
}
