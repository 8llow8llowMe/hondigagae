package com.hondigagae.domainlayer.placeimport.application.port.out;

import java.time.LocalDateTime;

/**
 * 원천에서 사라진 장소 표시 계약.
 *
 * <p>DELETE 가 아니라 delisted_at 표시다. 사용자의 일정(plan_item)이 장소를 참조하고
 * 있어 지우면 남의 여행 계획이 깨지고, 원천의 일시적 오류로 대량 소실됐을 때 되돌릴 수
 * 있어야 하며, 다시 등록되는 경우 upsert 가 delisted_at 을 NULL 로 되살린다.
 */
public interface PlaceDelistCommandPort {

    /** 해당 원천의 활성(비 delisted) 행 수. 급감 가드의 분모다. */
    long countActive(String source);

    /**
     * 이번 실행이 건드리지 않은 행을 delist 한다.
     *
     * @param source       원천 (TOUR_API / CULTURE_PORTAL / MFDS)
     * @param runStartedAt 이번 실행 시작 시각. synced_at 이 이보다 앞서면 이번 원천에 없던 행이다
     * @return delist 된 행 수
     */
    int delistStale(String source, LocalDateTime runStartedAt);
}
