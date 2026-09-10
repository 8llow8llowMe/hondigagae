package com.hondigagae.domainlayer.walkcourseimport.application.port.in;

public interface WalkCourseImportUseCase {

    /**
     * 제주올레 코스를 CSV + TourAPI 매칭으로 적재한다.
     *
     * @return 적재(upsert)한 코스 수
     */
    int importOlleCourses();
}
