package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.time.Instant;

/**
 * 장소 적재 결과를 관측 지표로 내보내는 포트 (coding-conventions §12-3 인프라 특화 포트).
 *
 * <p>배치가 조용히 멈추면 에러율도 지연도 정상인 채 데이터만 낡는다. 로그는 실행한 시점의
 * 기록이고, "마지막으로 언제 성공했나"는 지표로만 답할 수 있다 (observability-guide.md).
 */
public interface PlaceImportMetricsPort {

    /** 이번 실행에서 처리한 행 수를 (source, result) 단위로 기록한다. 같은 키는 덮어쓴다. */
    void recordRows(PlaceSourceType source, PlaceImportResultType result, long rows);

    /** 소스별 마지막 적재 성공 시각을 기록한다. 과거 시각으로는 되돌아가지 않는다. */
    void recordLastSuccess(PlaceSourceType source, Instant completedAt);
}
