package com.hondigagae.domainlayer.insight.application.service;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.RegionalWeatherResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.presenter.RegionalWeatherPresenter;
import com.hondigagae.domainlayer.insight.application.port.in.InsightWebUseCase;
import com.hondigagae.domainlayer.insight.application.service.processor.RegionalWeatherProcessor;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 장소에 매이지 않은 인사이트 오케스트레이터.
 *
 * <p><b>트랜잭션을 걸지 않는다.</b> 기상청 실시간 호출을 포함하므로 DB 커넥션을 잡은 채
 * 원격 응답을 기다리게 하면 커넥션 풀이 외부 API 응답 시간에 묶인다
 * ({@code PlaceInsightWebFacade} 와 같은 이유, architecture-guide §3 의 문서화된 예외).
 * 게다가 이 경로는 DB 를 아예 읽지 않는다.
 */
@Service
@RequiredArgsConstructor
public class InsightWebFacade implements InsightWebUseCase {

    private final RegionalWeatherProcessor regionalWeatherProcessor;
    private final RegionalWeatherPresenter regionalWeatherPresenter;

    @Override
    public RegionalWeatherResponse getRegionalWeather(LocalDate date, PetCondition pet) {
        return regionalWeatherPresenter.toResponse(
            regionalWeatherProcessor.compare(date == null ? LocalDate.now() : date, pet));
    }
}
