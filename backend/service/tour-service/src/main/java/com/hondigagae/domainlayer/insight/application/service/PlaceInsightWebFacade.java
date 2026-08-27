package com.hondigagae.domainlayer.insight.application.service;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceSuitabilityResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.WalkSafetyResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.presenter.PlaceSuitabilityPresenter;
import com.hondigagae.domainlayer.insight.adapter.in.web.presenter.WalkSafetyPresenter;
import com.hondigagae.domainlayer.insight.application.info.PlaceSuitabilityInfo;
import com.hondigagae.domainlayer.insight.application.info.WalkSafetyInfo;
import com.hondigagae.domainlayer.insight.application.model.PlaceInsightQuery;
import com.hondigagae.domainlayer.insight.application.port.in.PlaceInsightWebUseCase;
import com.hondigagae.domainlayer.insight.application.service.processor.PlaceSuitabilityProcessor;
import com.hondigagae.domainlayer.insight.application.service.processor.WalkSafetyProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 장소 인사이트 오케스트레이터.
 *
 * <p><b>트랜잭션을 걸지 않는다.</b> 이 유스케이스는 기상청 실시간 호출을 포함하는데,
 * DB 커넥션을 잡은 채 원격 응답을 기다리게 하면 커넥션 풀이 외부 API 응답 시간에 묶인다
 * (architecture-guide §3 의 문서화된 예외). DB 접근은 Processor 안의 짧은 조회뿐이라
 * 기본 트랜잭션으로 충분하다.
 */
@Service
@RequiredArgsConstructor
public class PlaceInsightWebFacade implements PlaceInsightWebUseCase {

    private final PlaceSuitabilityProcessor placeSuitabilityProcessor;
    private final WalkSafetyProcessor walkSafetyProcessor;
    private final PlaceSuitabilityPresenter placeSuitabilityPresenter;
    private final WalkSafetyPresenter walkSafetyPresenter;

    @Override
    public PlaceSuitabilityResponse getSuitability(PlaceInsightQuery query) {
        PlaceSuitabilityInfo info = placeSuitabilityProcessor.evaluate(query);
        return placeSuitabilityPresenter.toResponse(info);
    }

    @Override
    public WalkSafetyResponse getWalkSafety(PlaceInsightQuery query) {
        WalkSafetyInfo info = walkSafetyProcessor.assess(query);
        return walkSafetyPresenter.toResponse(info);
    }
}
