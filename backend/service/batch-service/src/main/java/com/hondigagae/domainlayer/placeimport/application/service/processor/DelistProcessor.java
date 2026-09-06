package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityDelistCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceDelistCommandPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.DelistGuard;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 원천에서 사라진 행 표시.
 *
 * <p>모든 적재가 upsert 뿐이면 데이터가 한 방향으로만 는다. 식약처는 등록 철회가 실제로
 * 일어나는 원천이라, 폐업한 식당이 "동반 가능 확인됨"으로 영원히 남는 것을 여기서 막는다.
 *
 * <p>판정 기준은 synced_at 이다. 이번 실행의 upsert 가 건드린 행은 synced_at 이 실행 시작
 * 시각(runStartedAt) 이후이고, 그보다 앞선 행은 이번 원천에 없었다는 뜻이다.
 * 급감 가드({@link DelistGuard})를 통과하지 못하면 표시하지 않고 경고만 남긴다 —
 * 낡은 데이터가 빈 데이터보다 낫다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DelistProcessor {

    private final PlaceDelistCommandPort placeDelistCommandPort;
    private final EmergencyFacilityDelistCommandPort emergencyFacilityDelistCommandPort;

    /** 범위는 (source, areaCode) — 적재 범위와 같아야 다른 지역 실행이 기존 지역을 내리지 않는다. */
    public int delistPlaces(PlaceSourceType source, String areaCode, LocalDateTime runStartedAt, long importedCount) {
        long active = placeDelistCommandPort.countActive(source.name(), areaCode);
        if (!DelistGuard.allows(importedCount, active)) {
            log.warn("place delist skipped by guard. source={} areaCode={} imported={} active={}",
                source, areaCode, importedCount, active);
            return 0;
        }
        int delisted = placeDelistCommandPort.delistStale(source.name(), areaCode, runStartedAt);
        if (delisted > 0) {
            log.info("place delisted. source={} areaCode={} delisted={} imported={} active={}",
                source, areaCode, delisted, importedCount, active);
        }
        return delisted;
    }

    public int delistEmergencyFacilities(LocalDateTime runStartedAt, long importedCount) {
        long active = emergencyFacilityDelistCommandPort.countActive();
        if (!DelistGuard.allows(importedCount, active)) {
            log.warn("emergency facility delist skipped by guard. imported={} active={}",
                importedCount, active);
            return 0;
        }
        int delisted = emergencyFacilityDelistCommandPort.delistStale(runStartedAt);
        if (delisted > 0) {
            log.info("emergency facility delisted. delisted={} imported={} active={}",
                delisted, importedCount, active);
        }
        return delisted;
    }
}
