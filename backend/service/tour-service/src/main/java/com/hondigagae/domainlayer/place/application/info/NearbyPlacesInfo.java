package com.hondigagae.domainlayer.place.application.info;

import java.util.List;

/**
 * 주변 장소 검색 결과 - 잘라 낸 목록과 <b>자르기 전</b> 총계.
 *
 * <p>{@code totalCount} 를 목록에서 다시 세면 {@code size} 와 늘 같은 값이 나온다. 이름은
 * 총계인데 실제로는 돌려준 개수인 것이라, 받은 쪽은 반경 안에 몇 곳이 더 있는지 알 수 없다
 * (긴급 시설에서 같은 함정을 밟았다 - 이슈 #285).
 *
 * <p>총계를 셀 수 있는 근거는 포트에 있다 - {@code findNearby} 는 사각 범위 전량을 돌려주고
 * DB 에서 자르지 않는다. 그 전제가 깨지면 총계는 별도 count 질의로 구해야 한다.
 */
public record NearbyPlacesInfo(List<NearbyPlaceInfo> places, int totalCount) {

}
