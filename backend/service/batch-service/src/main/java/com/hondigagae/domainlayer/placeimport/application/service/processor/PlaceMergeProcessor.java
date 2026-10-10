package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceMergeCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceMergeCandidateQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.MergeNameMatch;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceIdentityPolicy;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceNameMatcher;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
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
 * 부분일치는 300m, 공통 부분 일치는 100m 이내만 병합하고, 이름이 겹치지 않으면 좌표가 가까워도 병합하지 않는다.
 * 코스 · 숙박이 엇갈리는 쌍은 이름과 무관하게 막는다(#1282).
 *
 * <p>관광 API 행을 살린다. 이미지·개요·동반 정보 9필드를 갖고 있어 정보량이 많다.
 *
 * <p><b>survivor = TOUR_API, 흡수 = CULTURE_PORTAL 조합을 바꾸면 동반 가능 여부 재계산(#886)의 대상도 바꿔야 한다.</b>
 * {@code JdbcPlacePetAllowanceAdapter} 는 흡수 행을 근거로 TourAPI survivor 만 다시 계산한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceMergeProcessor {

    private static final Comparator<Match> MOST_LIKELY_FIRST =
        Comparator.comparing(Match::nameMatch).thenComparingDouble(Match::distance);

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
            // 조건을 만족하는 관광 API 행이 둘 이상일 수 있다 — 조회 순서의 첫 행이 아니라 가장 그럴듯한 쪽에 붙인다.
            // 병합은 되돌리는 경로가 없어(#763) 엉뚱한 survivor 에 붙으면 그대로 굳는다. dev 에서 김만덕기념관이
            // 1m 거리의 같은 이름 행을 두고 올레 코스 행(부분일치)에 붙어 있었다(#1282).
            survivors.stream()
                .map(survivor -> matchOf(absorbable, survivor))
                .flatMap(Optional::stream)
                .min(MOST_LIKELY_FIRST)
                .ifPresent(match -> pairs.add(new long[]{absorbable.id(), match.survivor().id()}));
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

    private Optional<Match> matchOf(PlaceMergeCandidateQueryResult absorbable, PlaceMergeCandidateQueryResult survivor) {
        if (absorbable.lat() == null || absorbable.lng() == null || survivor.lat() == null || survivor.lng() == null) {
            return Optional.empty();
        }
        if (!PlaceIdentityPolicy.isMergeableKind(absorbable.contentTypeId(), survivor.contentTypeId(), survivor.title())) {
            return Optional.empty();
        }
        double distance = PlaceNameMatcher.distanceMeters(
            absorbable.lat().doubleValue(), absorbable.lng().doubleValue(),
            survivor.lat().doubleValue(), survivor.lng().doubleValue());

        return PlaceIdentityPolicy.mergeNameMatch(absorbable.title(), survivor.title(), distance)
            .map(nameMatch -> new Match(survivor, nameMatch, distance));
    }

    /** 병합 조건을 만족한 survivor 하나. 이름 판정이 강한 쪽({@link MergeNameMatch} 선언 순서)이, 같으면 가까운 쪽이 앞선다. */
    private record Match(PlaceMergeCandidateQueryResult survivor, MergeNameMatch nameMatch, double distance) {
    }
}
