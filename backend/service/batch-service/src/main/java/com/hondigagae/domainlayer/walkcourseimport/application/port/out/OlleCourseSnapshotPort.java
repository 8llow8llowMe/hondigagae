package com.hondigagae.domainlayer.walkcourseimport.application.port.out;

import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseSnapshot;
import java.util.Optional;

/**
 * 올레 CSV 원천 스냅샷 저장·조회.
 *
 * <p>append-only 이력이다. 갱신하지 않고 실행마다 한 행을 남기며, 최신은 기록 시각 역순 첫 행이다.
 * 테이블은 문화정보원과 공유하지만 {@code source=OLLE_COURSE} 로 가른다.
 */
public interface OlleCourseSnapshotPort {

    /** 가장 최근 스냅샷. 한 번도 적재한 적이 없으면 비어 있다. */
    Optional<OlleCourseSnapshot> findLatest();

    /** 이번 실행의 스냅샷을 남긴다. */
    void record(OlleCourseSnapshot snapshot);
}
