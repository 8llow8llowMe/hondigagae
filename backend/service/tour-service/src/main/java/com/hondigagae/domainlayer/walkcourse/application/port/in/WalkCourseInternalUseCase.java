package com.hondigagae.domainlayer.walkcourse.application.port.in;

import com.hondigagae.domainlayer.walkcourse.adapter.in.internal.dto.WalkCourseCandidateInternalResponse;
import java.util.List;

public interface WalkCourseInternalUseCase {

    /** 아이디로 코스 요약을 준다 (plan-service 일정 항목용). 없는 아이디는 응답에서 빠진다. */
    List<WalkCourseCandidateInternalResponse> findWalkCourseCandidates(List<Long> walkCourseIds);
}
