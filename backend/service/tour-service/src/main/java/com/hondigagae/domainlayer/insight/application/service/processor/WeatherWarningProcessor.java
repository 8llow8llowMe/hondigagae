package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.port.out.WeatherWarningCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherWarningPort;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.KmaApiProperties;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 발효 중인 기상특보 조회.
 *
 * <h2>캐시가 예보와 다르다</h2>
 *
 * 예보 캐시는 <b>발표 주기</b>에 맞춘다(다음 발표 시각까지 신선). 특보는 그럴 수 없다 -
 * 태풍은 정해진 시각에 오지 않고, 발효와 해제가 예고 없이 일어난다. 그래서 짧은 고정 TTL
 * (기본 10분)을 쓴다.
 *
 * <p>짧은 TTL 이 쿼터를 태우지 않는 이유는 <b>키가 지역 하나</b>이기 때문이다. 격자 94개인
 * 예보와 달리 제주 전역이 지점 하나(184)로 덮여, 10분 TTL 이어도 하루 144건이다.
 *
 * <h2>실패는 "특보 없음"이 된다</h2>
 *
 * 이 처리의 가장 위험한 실패는 <b>특보가 떠 있는데 없다고 말하는 것</b>이다. 그런데 조회
 * 실패를 예외로 올리면 적합도와 산책 위험도가 통째로 멎는다 - 아직 활용신청도 하지 않은 API
 * 하나가 이미 동작하는 기능 둘을 끌어내리는 셈이다.
 *
 * <p>둘 중 덜 나쁜 쪽을 골랐다. 대신 <b>실패를 조용히 넘기지 않는다</b> - 어댑터가 WARN 으로
 * 남기고, 특보를 반영하지 못했다는 사실은 응답의 {@code weatherWarning} 이 null 인 것으로만
 * 드러난다는 한계를 문서에 적어 둔다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherWarningProcessor {

    private final WeatherWarningPort weatherWarningPort;
    private final WeatherWarningCachePort weatherWarningCachePort;
    private final KmaApiProperties kmaApiProperties;

    /** 제주에 발효 중인 특보 전체. 없으면 빈 목록이다. */
    public List<WeatherWarning> activeWarnings() {
        String stationId = kmaApiProperties.warningStationId();

        Optional<List<WeatherWarning>> cached = weatherWarningCachePort.find(stationId);
        if (cached.isPresent()) {
            return cached.get();
        }

        List<WeatherWarning> warnings = weatherWarningPort.findActiveWarnings(stationId);
        // 빈 목록도 캐시한다. 특보가 없는 것이 압도적으로 흔한 상태라, 그때마다 원천을 부르면
        // 캐시가 사실상 없는 것과 같아진다.
        weatherWarningCachePort.put(stationId, warnings, warningTtl());
        return warnings;
    }

    /**
     * 판정에 쓸 가장 무거운 특보.
     *
     * <p>여러 특보가 동시에 뜨는 일이 흔하다(태풍 + 호우 + 강풍). 판정은 하나로 해야 하므로
     * 가장 무거운 것을 고르되, 목록 자체는 호출부가 그대로 받을 수 있게 남긴다.
     */
    public Optional<WeatherWarning> heaviestWarning() {
        return WeatherWarning.heaviest(activeWarnings());
    }

    private Duration warningTtl() {
        return Duration.ofSeconds(kmaApiProperties.warningCacheSeconds());
    }
}
