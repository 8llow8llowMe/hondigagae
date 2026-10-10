package com.hondigagae.domainlayer.walkcourseimport.application.port.out;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCoordinateQueryResult;
import java.util.Map;

public interface OlleCourseCoordinatePort {

    /**
     * TourAPI 올레 항목의 코스키 → 좌표 맵. 올레 항목은 33건 안팎이라 <b>한 번의 호출</b>로
     * 전부 받아 메모리에서 매칭한다 - 코스마다 검색하면 쿼터(개발계정 일 1,000건)를 29배로 쓴다.
     */
    Map<String, OlleCourseCoordinateQueryResult> fetchCoordinatesByCourseKey();
}
