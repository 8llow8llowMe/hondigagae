package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import java.util.Optional;

/**
 * 원천 파일 스냅샷 저장·조회 (coding-conventions §12-3 인프라 특화 포트).
 *
 * <p>append-only 이력이다. 갱신하지 않고 실행마다 한 행을 남기며, 최신은 기록 시각 역순 첫 행이다.
 */
public interface ImportSourceSnapshotPort {

    /** (source, areaCode) 의 가장 최근 스냅샷. 한 번도 적재한 적이 없으면 비어 있다. */
    Optional<ImportSourceSnapshot> findLatest(PlaceSourceType source, String areaCode);

    /** 이번 실행의 스냅샷을 남긴다. */
    void record(ImportSourceSnapshot snapshot);
}
