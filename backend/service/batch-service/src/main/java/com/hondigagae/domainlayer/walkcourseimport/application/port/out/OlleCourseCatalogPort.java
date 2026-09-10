package com.hondigagae.domainlayer.walkcourseimport.application.port.out;

import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.nio.file.Path;
import java.util.List;

public interface OlleCourseCatalogPort {

    /**
     * 지정한 올레코스현황 CSV 전량. 좌표·이미지는 아직 비어 있다 - 매칭은 프로세서가 한다.
     *
     * <p>읽을 파일은 인자로 받는다. 포털에서 받은 임시 파일일 수도 로컬 우회 파일일 수도
     * 있다 - 어느 쪽인지는 {@code OlleCourseSourceProcessor} 가 정한다.
     */
    List<ImportedWalkCourse> loadCourses(Path csvFile);
}
