package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceMergeCandidateQueryResult;
import java.util.List;

/**
 * 원천이 다른 같은 장소를 하나로 묶는 계약.
 */
public interface PlaceMergeCommandPort {

    /** 지역 안의 병합 판정 대상(아직 병합되지 않은 행)을 원천별로 읽는다. */
    List<PlaceMergeCandidateQueryResult> findMergeCandidates(String areaCode);

    /** 문화정보원 행을 관광 API 행으로 흡수시킨다. key = 흡수될 id, value = 살아남을 id */
    int markMerged(List<long[]> mergePairs);
}
