package com.hondigagae.domainlayer.walkcourse.application.service;

import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseDetailResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.response.WalkCourseListResponse;
import com.hondigagae.domainlayer.walkcourse.adapter.in.web.presenter.WalkCoursePresenter;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;
import com.hondigagae.domainlayer.walkcourse.application.port.in.WalkCourseWebUseCase;
import com.hondigagae.domainlayer.walkcourse.application.service.processor.WalkCourseQueryProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalkCourseWebFacade implements WalkCourseWebUseCase {

    private final WalkCourseQueryProcessor walkCourseQueryProcessor;
    private final WalkCoursePresenter walkCoursePresenter;

    @Override
    @Transactional(readOnly = true)
    public WalkCourseListResponse search(WalkCourseSearchQuery query) {
        return walkCoursePresenter.toListResponse(walkCourseQueryProcessor.search(query), query);
    }

    @Override
    @Transactional(readOnly = true)
    public WalkCourseDetailResponse getDetail(long walkCourseId) {
        return walkCoursePresenter.toDetailResponse(walkCourseQueryProcessor.getDetail(walkCourseId));
    }
}
