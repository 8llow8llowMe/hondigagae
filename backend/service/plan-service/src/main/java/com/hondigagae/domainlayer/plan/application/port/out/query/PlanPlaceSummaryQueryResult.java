package com.hondigagae.domainlayer.plan.application.port.out.query;

import lombok.Builder;

/**
 * 일정 항목이 가리키는 장소의 요약. tour-service 내부 후보 API 한 번으로 받아 온다.
 *
 * <p><b>여기서 좌표 없는 장소를 걸러내지 않는다.</b> 소비처가 둘인데 요구가 다르다 —
 * 상세 응답은 좌표가 없어도 주소·실내 여부를 써야 하고, 응급 브리핑은 좌표가 검색 중심점이라
 * 없으면 건너뛴다. 걸러내기는 각자 {@link #hasPoint()} 로 판단한다.
 *
 * <p>목록에 아예 없는 아이디는 노출 불가(병합·delisted) 장소다. 그 항목은 <b>요약이 null 인 채로
 * 응답에 남는다</b> — 사용자가 담아 둔 자료라 사라지면 안 된다.
 */
@Builder
public record PlanPlaceSummaryQueryResult(
    long placeId,
    String title,
    String addr,
    Boolean indoor,
    String firstImage,
    Double lat,
    Double lng
) {

    /** 검색 중심점으로 쓸 수 있는가. 원천에 좌표가 없는 장소가 실제로 있다 */
    public boolean hasPoint() {
        return lat != null && lng != null;
    }
}
