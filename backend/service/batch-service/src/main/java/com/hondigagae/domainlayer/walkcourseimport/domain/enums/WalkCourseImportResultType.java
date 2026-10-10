package com.hondigagae.domainlayer.walkcourseimport.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 걷기 코스 적재 결과 지표(walk_course_import_rows)의 result 라벨.
 *
 * <p>{@code PlaceImportResultType} 과 같은 모양이지만 따로 둔다 — {@code place_import_rows} 는
 * 장소 마스터 기준이고(observability-guide.md), 걷기 코스는 장소가 아니다.
 */
@Getter
@RequiredArgsConstructor
public enum WalkCourseImportResultType {

    UPSERTED("upserted"),

    /**
     * 행 수가 아니라 <b>이번 실행이 우회 원천을 썼는지</b>를 담는 1/0 플래그다 (#876).
     *
     * <p>포털 페이지 구조가 바뀌어 매 실행 우회 CSV 로 돌아도 데이터는 들어오므로 아무 경보도
     * 울지 않았다. 이 게이지가 그 침묵을 깨는 자리다 ({@code PlaceImportResultType.FALLBACK} 과 같은 이유).
     */
    FALLBACK("fallback");

    /** Prometheus 라벨 값. 지표 규약이라 enum 이름 변경과 분리해 둔다. */
    private final String tagValue;
}
