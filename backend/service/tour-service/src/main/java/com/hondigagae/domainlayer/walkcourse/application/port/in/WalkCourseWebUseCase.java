package com.hondigagae.domainlayer.walkcourse.application.port.in;

import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseDetailResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseListResponse;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;

public interface WalkCourseWebUseCase {

    WalkCourseListResponse search(WalkCourseSearchQuery query);

    WalkCourseDetailResponse getDetail(long walkCourseId);
}
