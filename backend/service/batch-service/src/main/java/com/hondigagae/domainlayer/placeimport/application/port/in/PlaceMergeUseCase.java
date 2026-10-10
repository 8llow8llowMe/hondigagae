package com.hondigagae.domainlayer.placeimport.application.port.in;

public interface PlaceMergeUseCase {

    /**
     * 원천이 다른 같은 장소를 하나로 묶는다(흡수되는 행에 {@code merged_into_id} 를 채운다).
     *
     * <p><b>모든 적재가 끝난 뒤 한 번 돈다.</b> 예전에는 각 적재 파사드가 자기 적재 뒤에 병합을
     * 불러서, 잡이 늘수록 아직 다른 원천이 들어오지 않은 중간 상태를 기준으로 판정했다.
     * 그래서 <b>적재 잡을 단독 실행했으면 이 잡을 이어 돌려야 병합된다</b>(#363).
     *
     * @param areaCode 관광 지역코드 (제주=39). 병합 범위는 적재 범위와 같아야 한다
     * @return 병합 표시한 행 수
     */
    int mergeDuplicates(String areaCode);
}
