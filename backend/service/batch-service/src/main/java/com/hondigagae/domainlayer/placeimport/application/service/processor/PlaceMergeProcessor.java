package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceMergeCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceMergeCandidateQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceNameMatcher;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 원천이 다른 같은 장소를 하나로 묶는다.
 *
 * <p>판정 규칙은 제주 실측(관광 API 29곳 × 문화정보원 171곳)으로 정했다.
 * 자세한 근거는 {@code docs/place-data-integration.md} §4.
 *
 * <ul>
 *   <li>이름 완전일치 + 1km 이내 → 병합 (실측 7건)</li>
 *   <li>이름 부분일치 + 300m 이내 → 병합 (실측 7건 중 좌표가 가까운 것)</li>
 *   <li>좌표만 근접 → <b>병합하지 않는다.</b> 93m 거리에 서로 다른 시설이 있었다</li>
 * </ul>
 *
 * <p>관광 API 행을 살린다. 이미지·개요·동반 정보 9필드를 갖고 있어 정보량이 많다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceMergeProcessor {

    /** 이름이 완전히 같을 때 허용하는 거리. 원천마다 기준점이 달라(오름 정상 vs 입구) 넉넉히 잡는다. */
    private static final double EXACT_NAME_RADIUS_M = 1_000d;
    /** 이름이 부분적으로만 같을 때 허용하는 거리. 좁게 잡아 오탐을 막는다. */
    private static final double PARTIAL_NAME_RADIUS_M = 300d;

    private final PlaceMergeCommandPort placeMergeCommandPort;

    public int mergeDuplicates(String areaCode) {
        List<PlaceMergeCandidateQueryResult> candidates = placeMergeCommandPort.findMergeCandidates(areaCode);

        List<PlaceMergeCandidateQueryResult> survivors = candidates.stream()
            .filter(candidate -> PlaceSourceType.TOUR_API.name().equals(candidate.source()))
            .toList();
        List<PlaceMergeCandidateQueryResult> absorbables = candidates.stream()
            .filter(candidate -> PlaceSourceType.CULTURE_PORTAL.name().equals(candidate.source()))
            .toList();

        List<long[]> pairs = new ArrayList<>();
        for (PlaceMergeCandidateQueryResult absorbable : absorbables) {
            survivors.stream()
                .filter(survivor -> isSamePlace(absorbable, survivor))
                .findFirst()
                .ifPresent(survivor -> pairs.add(new long[]{absorbable.id(), survivor.id()}));
        }

        if (pairs.isEmpty()) {
            log.info("place merge found no duplicate areaCode={} survivors={} absorbables={}",
                areaCode, survivors.size(), absorbables.size());
            return 0;
        }

        int merged = placeMergeCommandPort.markMerged(pairs);
        log.info("place merge done areaCode={} merged={} survivors={} absorbables={}",
            areaCode, merged, survivors.size(), absorbables.size());
        return merged;
    }

    private boolean isSamePlace(PlaceMergeCandidateQueryResult a, PlaceMergeCandidateQueryResult b) {
        if (a.lat() == null || a.lng() == null || b.lat() == null || b.lng() == null) {
            return false;
        }
        double distance = PlaceNameMatcher.distanceMeters(
            a.lat().doubleValue(), a.lng().doubleValue(), b.lat().doubleValue(), b.lng().doubleValue());

        if (PlaceNameMatcher.isExactMatch(a.title(), b.title())) {
            return distance <= EXACT_NAME_RADIUS_M;
        }
        if (PlaceNameMatcher.isPartialMatch(a.title(), b.title())) {
            return distance <= PARTIAL_NAME_RADIUS_M;
        }
        return false;
    }
}
