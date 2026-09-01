package com.hondigagae.domainlayer.congestionimport.application.service.processor;

import com.hondigagae.domainlayer.congestionimport.application.port.out.PlaceNameLinkBulkPort;
import com.hondigagae.domainlayer.congestionimport.application.port.out.query.PlaceNameCandidateQueryResult;
import com.hondigagae.domainlayer.congestionimport.domain.model.ImportedCongestionForecast;
import com.hondigagae.domainlayer.congestionimport.domain.model.ResolvedPlaceNameLink;
import com.hondigagae.shared.travel.insight.NameLinkSourceType;
import com.hondigagae.shared.travel.insight.NameMatchType;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceNameMatcher;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 원천 관광지 명칭을 장소 마스터에 잇는다.
 *
 * <p>집중률 API 는 {@code contentId} 가 아니라 <b>이름</b>으로 데이터를 준다. 이름은 원천마다
 * 표기가 달라(공백, 괄호 부연, 별칭) 그대로 비교하면 상당수가 유실되므로, 장소 병합 판정에
 * 쓰던 {@code PlaceNameMatcher} 를 그대로 재사용한다 - 같은 문제에 다른 정규화 규칙을 쓰면
 * "같은 곳"의 뜻이 두 곳에서 갈라진다.
 *
 * <p>좌표로 보정하지 않는 것은 <b>이 원천에 좌표가 없기 때문</b>이다. 장소 병합 판정에서는
 * 이름과 좌표를 함께 봤지만 여기서는 이름밖에 없고, 그래서 완전일치를 우선하고 부분일치는
 * 후보가 하나일 때만 받는다. 여럿이면 찍지 않고 UNMATCHED 로 남긴다 - 잘못 이은 혼잡도는
 * 없는 혼잡도보다 나쁘다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceNameLinkProcessor {


    private final PlaceNameLinkBulkPort placeNameLinkBulkPort;

    /**
     * @param areaCode 매칭 대상 장소를 좁히는 관광 지역코드 (제주=39)
     */
    public LinkResult linkAll(List<ImportedCongestionForecast> forecasts, String areaCode) {
        List<PlaceNameCandidateQueryResult> places = placeNameLinkBulkPort.findPlaceNames(areaCode);
        if (places.isEmpty()) {
            log.warn("No places to match against areaCode={}. Run placeImportJob first.", areaCode);
        }

        // 같은 관광지가 30일치로 반복되므로 명칭 단위로 접는다. 4,284행이 143곳이 된다.
        Map<NameKey, ImportedCongestionForecast> distinctNames = new LinkedHashMap<>();
        for (ImportedCongestionForecast forecast : forecasts) {
            distinctNames.putIfAbsent(
                new NameKey(forecast.areaCd(), forecast.signguCd(), forecast.tatsNm()), forecast);
        }

        List<ResolvedPlaceNameLink> links = new ArrayList<>();
        int matched = 0;
        for (Map.Entry<NameKey, ImportedCongestionForecast> entry : distinctNames.entrySet()) {
            NameKey key = entry.getKey();
            Optional<PlaceNameCandidateQueryResult> place = resolve(key.tatsNm(), places);
            boolean isMatched = place.isPresent();
            if (isMatched) {
                matched++;
            }
            links.add(ResolvedPlaceNameLink.builder()
                .sourceType(NameLinkSourceType.CONGESTION.name())
                .areaCd(key.areaCd())
                .signguCd(key.signguCd())
                .tatsNm(key.tatsNm())
                .placeId(place.map(PlaceNameCandidateQueryResult::placeId).orElse(null))
                .matchType(place.map(candidate -> matchTypeOf(key.tatsNm(), candidate)).orElse(NameMatchType.UNMATCHED.name()))
                .build());
        }

        placeNameLinkBulkPort.upsertAll(links);
        int unmatched = links.size() - matched;
        // 커버리지를 로그로 남긴다. 매칭률이 조용히 떨어지는 것이 이 방식의 가장 큰 위험이다.
        log.info("Place name link done source={} total={} matched={} unmatched={} places={}",
            NameLinkSourceType.CONGESTION, links.size(), matched, unmatched, places.size());
        return new LinkResult(matched, unmatched);
    }

    /**
     * 완전일치 우선, 없으면 부분일치가 <b>정확히 하나일 때만</b> 받는다.
     *
     * <p>부분일치 후보가 여럿이면 어느 쪽인지 알 수 없다. 찍어서 맞히면 이득이 작고 틀리면
     * 엉뚱한 장소에 혼잡도가 붙으므로, 그때는 매칭하지 않는다.
     */
    private Optional<PlaceNameCandidateQueryResult> resolve(
        String tatsNm, List<PlaceNameCandidateQueryResult> places
    ) {
        Optional<PlaceNameCandidateQueryResult> exact = places.stream()
            .filter(place -> PlaceNameMatcher.isExactMatch(tatsNm, place.title()))
            .findFirst();
        if (exact.isPresent()) {
            return exact;
        }

        List<PlaceNameCandidateQueryResult> partial = places.stream()
            .filter(place -> PlaceNameMatcher.isPartialMatch(tatsNm, place.title()))
            .toList();
        if (partial.size() == 1) {
            return Optional.of(partial.get(0));
        }
        if (partial.size() > 1) {
            log.debug("Ambiguous partial match skipped tatsNm={} candidates={}", tatsNm, partial.size());
        }
        return Optional.empty();
    }

    /**
     * 이 행이 어떤 방식으로 이어졌는지.
     *
     * <p>값은 tour-service 가 {@code NameMatchType} 으로 읽는 DB 계약이라 문자열을 직접 적지
     * 않는다 (§8-3). 배치가 쓰고 tour 가 읽으므로 enum 자체는 shared-travel 에 있다.
     */
    private String matchTypeOf(String tatsNm, PlaceNameCandidateQueryResult place) {
        return PlaceNameMatcher.isExactMatch(tatsNm, place.title()) ? NameMatchType.EXACT.name() : NameMatchType.NORMALIZED.name();
    }

    private record NameKey(String areaCd, String signguCd, String tatsNm) {

    }

    public record LinkResult(int matched, int unmatched) {

    }
}
