package com.hondigagae.domainlayer.walkcourseimport.application.port.out;

import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.util.List;

public interface OlleCourseCatalogPort {

    /** 올레코스현황 CSV 전량. 좌표·이미지는 아직 비어 있다 - 매칭은 프로세서가 한다. */
    List<ImportedWalkCourse> loadCourses();
}
