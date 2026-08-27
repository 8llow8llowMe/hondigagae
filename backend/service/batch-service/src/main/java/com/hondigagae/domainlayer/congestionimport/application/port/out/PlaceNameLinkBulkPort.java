package com.hondigagae.domainlayer.congestionimport.application.port.out;

import com.hondigagae.domainlayer.congestionimport.application.port.out.query.PlaceNameCandidateQueryResult;
import com.hondigagae.domainlayer.congestionimport.domain.model.ResolvedPlaceNameLink;
import java.util.List;

/**
 * 명칭 매칭 결과 저장 계약.
 *
 * <p>place 목록을 읽는 것과 링크를 쓰는 것을 한 포트에 둔 것은, 둘이 <b>같은 한 가지 일</b>의
 * 앞뒤이기 때문이다 - 장소 이름을 읽어 원천 명칭과 맞춰 보고 그 결과를 남긴다.
 */
public interface PlaceNameLinkBulkPort {

    /** 매칭 대상 장소 목록. 제주 300여 곳이라 통째로 메모리에 올려도 된다. */
    List<PlaceNameCandidateQueryResult> findPlaceNames(String areaCode);

    int upsertAll(List<ResolvedPlaceNameLink> links);
}
