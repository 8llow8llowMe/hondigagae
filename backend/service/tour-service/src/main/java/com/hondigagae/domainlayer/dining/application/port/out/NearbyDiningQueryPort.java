package com.hondigagae.domainlayer.dining.application.port.out;

import com.hondigagae.domainlayer.dining.application.model.NearbyDiningQuery;
import com.hondigagae.domainlayer.dining.application.port.out.query.NearbyDiningQueryResult;
import java.util.List;

/**
 * 주변 식음료 조회 계약.
 *
 * <p>포트 이름에 제공처(카카오)를 넣지 않는다. 제공처가 바뀌어도 이 계약은 그대로다.
 *
 * <p><b>결과를 저장하지 않는다.</b> 구현체가 쓰는 카카오 로컬 API 는 응답의 DB 저장은 물론
 * 세션 단위 임시 저장·캐싱도 허용하지 않는다. 호출할 때마다 새로 받아 화면에 그대로 흘려보낸다
 * (docs/external-api-guide.md §2-1).
 */
public interface NearbyDiningQueryPort {

    List<NearbyDiningQueryResult> searchNearby(NearbyDiningQuery query);
}
