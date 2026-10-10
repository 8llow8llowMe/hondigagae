package com.hondigagae.domainlayer.emergency.application.info;

import java.util.List;

/**
 * 주변 시설 검색 결과 - 잘라 낸 목록과 <b>자르기 전</b> 총계.
 *
 * <p>둘을 함께 드는 이유는 {@code totalCount} 가 목록에서 셀 수 없는 값이기 때문이다.
 * 프로세서가 {@code size} 로 자른 목록만 넘기고 프리젠터가 {@code items.size()} 를 채우면
 * 두 값이 <b>언제나</b> 같아진다 - 이름은 총계인데 실제로는 돌려준 개수라, 클라이언트가
 * {@code facilities.length < totalCount} 로 잘림을 판정하면 그 조건이 늘 거짓이 되어
 * 잘린 목록에서 센 개수가 전체인 양 화면에 나간다(이슈 #285).
 *
 * <p>총계를 정직하게 셀 수 있는 근거는 포트에 있다 - {@code findWithinBox} 는 사각 범위
 * 전량을 돌려주고 DB 에서 자르지 않는다. 그 전제가 깨지면(공간 인덱스 + DB LIMIT 으로
 * 옮기면) 총계는 별도 count 질의로 구해야 한다.
 */
public record NearbyFacilitiesInfo(List<NearbyFacilityInfo> facilities, int totalCount) {

}
