package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceMergeCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceMergeCandidateQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceIdentityPolicy;
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
 * <p>이름·거리 기준값은 {@link PlaceIdentityPolicy} 가 정본이다 — 이름 완전일치는 1km,
 * 부분일치는 300m 이내만 병합하고, 이름이 겹치지 않으면 좌표가 가까워도 병합하지 않는다.
 *
 * <p>관광 API 행을 살린다. 이미지·개요·동반 정보 9필드를 갖고 있어 정보량이 많다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceMergeProcessor {

    private final PlaceMergeCommandPort placeMergeCommandPort;

    public int mergeDuplicates(String areaCode) {
        List<PlaceMergeCandidateQueryResult> candidates = placeMergeCommandPort.findMergeCandidates(areaCode);

        List<PlaceMergeCandidateQueryResult> survivors = candidates.stream()
            .filter(candidate -> PlaceSourceType.TOUR_API.name().equals(candidate.source()))
            .toList();
        List<PlaceMergeCandidateQueryResult> absorbables = candidates.stream()
            .filter(candidate -> PlaceSourceType.CULTURE_PORTAL.name().equals(candidate.source()))
            .toList();

        if (survivors.isEmpty() || absorbables.isEmpty()) {
            // 한쪽이 비면 판정할 것이 없다. 대개 적재 순서 문제다(placeImportJob 을 먼저 돌리지 않았거나
            // 문화정보원 적재가 아직이다) — 0건 성공으로 조용히 끝나지 않게 경고로 남긴다.
            log.warn("place merge has nothing to compare areaCode={} survivors={} absorbables={} — 적재 잡 순서를 확인하라",
                areaCode, survivors.size(), absorbables.size());
            return 0;
        }

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

        return PlaceIdentityPolicy.isSamePlaceForMerge(a.title(), b.title(), distance);
    }
}
