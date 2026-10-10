package com.hondigagae.domainlayer.placeimport.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 적재 결과 지표(place_import_rows)의 result 라벨.
 *
 * <p>inserted/updated 를 나누지 않고 UPSERTED 하나로 둔다 — 적재가 JdbcTemplate batchUpdate
 * upsert 라 삽입과 갱신을 구분해 세지 않고, 경보 기준(observability-guide.md)도
 * geocode_failed / delisted / fallback 에만 걸려 있다.
 */
@Getter
@RequiredArgsConstructor
public enum PlaceImportResultType {

    UPSERTED("upserted"),
    DELISTED("delisted"),
    GEOCODE_FAILED("geocode_failed"),

    /**
     * 행 수가 아니라 <b>이번 실행이 우회 원천을 썼는지</b>를 담는 1/0 플래그다 (#379).
     *
     * <p>우회 적재도 데이터가 들어오므로 {@code last_success} 를 갱신한다 — 그래서 포털 자동
     * 다운로드가 몇 주째 끊겨 로컬 우회 파일만 다시 넣고 있어도 유일한 신선도 경보가 침묵한다.
     * 이 게이지가 그 침묵을 깨는 자리다. 단위가 다른 값이지만 같은 지표에 두는 편이 소스 라벨로
     * 함께 보이고, 경보도 {@code result="fallback" == 1} 한 줄로 끝난다.
     */
    FALLBACK("fallback");

    /** Prometheus 라벨 값. 지표 규약이라 enum 이름 변경과 분리해 둔다. */
    private final String tagValue;
}
