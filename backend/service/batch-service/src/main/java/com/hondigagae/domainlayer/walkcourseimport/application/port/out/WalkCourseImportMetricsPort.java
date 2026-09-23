package com.hondigagae.domainlayer.walkcourseimport.application.port.out;

import com.hondigagae.domainlayer.walkcourseimport.domain.enums.WalkCourseImportResultType;

/**
 * 걷기 코스 적재 결과를 관측 지표로 내보내는 포트 (coding-conventions §12-3 인프라 특화 포트).
 *
 * <p>우회 적재도 행이 들어오므로 로그 한 줄 말고는 포털이 끊긴 것을 알 길이 없다.
 * "마지막 실행이 우회였나" 는 지표로만 답할 수 있다 (observability-guide.md).
 */
public interface WalkCourseImportMetricsPort {

    /** 이번 실행에서 처리한 행 수를 result 단위로 기록한다. 같은 키는 덮어쓴다. */
    void recordRows(WalkCourseImportResultType result, long rows);
}
