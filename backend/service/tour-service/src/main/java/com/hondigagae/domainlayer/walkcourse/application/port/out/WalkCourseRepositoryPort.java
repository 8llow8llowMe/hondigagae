package com.hondigagae.domainlayer.walkcourse.application.port.out;

import com.hondigagae.domainlayer.walkcourse.application.port.out.query.WalkCourseQueryResult;
import java.util.List;
import java.util.Optional;

public interface WalkCourseRepositoryPort {

    /** 전체 코스. 29개 안팎의 고정 소량이라 조건 없이 전부 가져와 위에서 거른다. */
    List<WalkCourseQueryResult> findAll();

    Optional<WalkCourseQueryResult> findById(long walkCourseId);
}
