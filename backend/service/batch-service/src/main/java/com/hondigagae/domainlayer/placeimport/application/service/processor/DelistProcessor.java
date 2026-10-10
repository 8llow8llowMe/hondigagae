package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.model.PlaceImportOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityDelistCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceDelistCommandPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.DelistGuard;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
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

    /**
     * 범위는 (source, areaCode) — 한 번의 실행이 그 원천 전체를 덮는 경우다(문화정보원·식약처).
     * 적재 범위와 같아야 다른 지역 실행이 기존 지역을 내리지 않는다.
     */
    public int delistPlaces(PlaceSourceType source, String areaCode, LocalDateTime runStartedAt, long importedCount) {
        return delistWithin(source, areaCode, null, runStartedAt, importedCount);
    }

    /**
     * 범위는 (source, areaCode, <b>이번에 1건 이상 들어온 contentType</b>) — 적재가 타입 단위로
     * 도는 원천(TourAPI)용이다 (#726).
     *
     * <p><b>왜 타입을 범위에 넣는가.</b> delist 가 타입을 보지 않으면, 한 타입이 통째로 0건으로
     * 들어온 실행 하나가 그 타입의 기존 행 전부를 내린다. 지역에 대해 이미 맞다고 판정한 논리를
     * 타입에도 그대로 적용한 것이다 — 적재 범위와 delist 범위를 맞춘다.
     *
     * <p><b>"하나라도 0건이면 전체를 건너뛴다"는 답이 아니다.</b> 여행코스(25)는 지역 키와 무관하게
     * 항상 0건이다(원천에 제주 여행코스가 없다. {@code areaCode=39}·{@code lDongRegnCd=50} 둘 다
     * totalCount=0). 전체를 건너뛰면 delist 가 영영 돌지 않아, 원천에서 사라진 장소가 영구히
     * 남는 또 다른 조용한 실패가 된다.
     *
     * <p>0건인 타입이 DB 에는 활성 행을 갖고 있으면 그것이 진짜 이상 신호다 — 로그만 남기고 잡을
     * 죽이지는 않는다. "원천이 그 타입을 지웠다"와 "원천이 그 타입에서 깨졌다"를 구분할 수 없어
     * 자동으로 내릴 수 없기 때문이다.
     */
    public int delistPlacesByContentType(PlaceSourceType source, String areaCode, LocalDateTime runStartedAt,
        PlaceImportOutcome outcome) {
        warnEmptyContentTypesWithActiveRows(source, areaCode, outcome);

        List<String> importedContentTypeIds = toContentTypeIds(outcome.importedContentTypes());
        if (importedContentTypeIds.isEmpty()) {
            // 전 타입 0건은 "원천이 비었다"보다 "원천을 못 읽었다"일 가능성이 크다.
            // 빈 범위를 SQL 로 내려보내지 않고 여기서 끝낸다.
            log.warn("place delist skipped. reason=no_content_type_imported source={} areaCode={}", source, areaCode);
            return 0;
        }
        return delistWithin(source, areaCode, importedContentTypeIds, runStartedAt, outcome.totalUpserted());
    }

    /**
     * 분모(활성 건수)와 분자(delist 대상)의 범위를 <b>같은 {@code contentTypeIds} 로</b> 맞춘다.
     * 어긋나면 급감 가드의 비율 비교가 의미를 잃는다 — 전 타입을 분모로 세고 일부 타입만 내리면
     * 비율이 늘 낮게 나와 가드가 정상 실행까지 막는다.
     */
    private int delistWithin(PlaceSourceType source, String areaCode, Collection<String> contentTypeIds,
        LocalDateTime runStartedAt, long importedCount) {
        long active = placeDelistCommandPort.countActive(source.name(), areaCode, contentTypeIds);
        if (!DelistGuard.allows(importedCount, active)) {
            log.warn("place delist skipped by guard. source={} areaCode={} contentTypeIds={} imported={} active={}",
                source, areaCode, contentTypeIds, importedCount, active);
            return 0;
        }
        int delisted = placeDelistCommandPort.delistStale(source.name(), areaCode, contentTypeIds, runStartedAt);
        if (delisted > 0) {
            log.info("place delisted. source={} areaCode={} contentTypeIds={} delisted={} imported={} active={}",
                source, areaCode, contentTypeIds, delisted, importedCount, active);
        }
        return delisted;
    }

    private void warnEmptyContentTypesWithActiveRows(PlaceSourceType source, String areaCode, PlaceImportOutcome outcome) {
        List<PlaceContentType> emptyContentTypes = outcome.emptyContentTypes();
        if (emptyContentTypes.isEmpty()) {
            return;
        }
        // 타입마다 세지 않는다 — 한 번의 GROUP BY 로 받아 메모리에서 짝짓는다 (§9-7).
        Map<String, Long> activeByContentType = placeDelistCommandPort.countActiveByContentType(
            source.name(), areaCode, toContentTypeIds(emptyContentTypes));
        for (PlaceContentType contentType : emptyContentTypes) {
            long active = activeByContentType.getOrDefault(contentType.getCode(), 0L);
            if (active > 0) {
                log.warn("place import returned 0 rows for contentType={} but {} active rows exist. source={} areaCode={}",
                    contentType, active, source, areaCode);
            } else {
                // 여행코스(25)가 늘 여기다. 원천에 제주 여행코스가 없어 DB 에도 활성 행이 없다.
                log.info("place import returned 0 rows for contentType={}. no active rows. source={} areaCode={}",
                    contentType, source, areaCode);
            }
        }
    }

    private List<String> toContentTypeIds(List<PlaceContentType> contentTypes) {
        return contentTypes.stream()
            .map(PlaceContentType::getCode)
            .toList();
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
