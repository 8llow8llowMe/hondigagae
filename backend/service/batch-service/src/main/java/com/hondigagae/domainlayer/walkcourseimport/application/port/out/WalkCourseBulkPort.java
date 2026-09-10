package com.hondigagae.domainlayer.walkcourseimport.application.port.out;

import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.util.List;

public interface WalkCourseBulkPort {

    /** walk_course upsert. 자연키(course_key)로 꽂혀 재실행이 멱등하다. */
    int upsertAll(List<ImportedWalkCourse> courses);
}
