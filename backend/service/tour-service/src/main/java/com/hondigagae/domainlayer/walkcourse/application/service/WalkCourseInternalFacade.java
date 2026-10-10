package com.hondigagae.domainlayer.walkcourse.application.service;

import com.hondigagae.domainlayer.walkcourse.adapter.in.internal.dto.WalkCourseCandidateInternalResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.internal.presenter.WalkCourseInternalPresenter;
import com.hondigagae.domainlayer.walkcourse.application.port.in.WalkCourseInternalUseCase;
import com.hondigagae.domainlayer.walkcourse.application.service.processor.WalkCourseQueryProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalkCourseInternalFacade implements WalkCourseInternalUseCase {

    private final WalkCourseQueryProcessor walkCourseQueryProcessor;
    private final WalkCourseInternalPresenter walkCourseInternalPresenter;

    @Override
    @Transactional(readOnly = true)
    public List<WalkCourseCandidateInternalResponse> findWalkCourseCandidates(List<Long> walkCourseIds) {
        return walkCourseInternalPresenter.toCandidateResponses(
            walkCourseQueryProcessor.getCandidates(walkCourseIds));
    }
}
