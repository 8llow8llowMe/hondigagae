package com.hondigagae.domainlayer.placeimport.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 적재 결과 지표(place_import_rows)의 result 라벨.
 *
 * <p>inserted/updated 를 나누지 않고 UPSERTED 하나로 둔다 — 적재가 JdbcTemplate batchUpdate
 * upsert 라 삽입과 갱신을 구분해 세지 않고, 경보 기준(observability-guide.md)도
 * geocode_failed / delisted 에만 걸려 있다.
 */
@Getter
@RequiredArgsConstructor
public enum PlaceImportResultType {

    UPSERTED("upserted"),
    DELISTED("delisted"),
    GEOCODE_FAILED("geocode_failed");

    /** Prometheus 라벨 값. 지표 규약이라 enum 이름 변경과 분리해 둔다. */
    private final String tagValue;
}
