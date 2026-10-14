package com.hondigagae.domainlayer.placeimport.application.port.in;

import com.hondigagae.domainlayer.placeimport.application.model.PlaceOverrideOutcome;

public interface PlaceOverrideUseCase {

    /**
     * 보정 파일({@code place-overrides.yml})의 항목을 place 행에 덮는다 (#1434). 제목이 같은 행의 적힌 칸만 바꾼다.
     *
     * <p><b>매 실행 다시 덮는다.</b> 보정 칸을 다시 쓰는 스텝(재계산 · 문화정보원 · 식약처 적재) 뒤에 돌아 그 결과 위에 얹는다. 입력이 같고 그사이
     * 아무도 칸을 바꾸지 않았으면 두 번째 실행은 0행을 갱신한다.
     */
    PlaceOverrideOutcome applyOverrides();
}
