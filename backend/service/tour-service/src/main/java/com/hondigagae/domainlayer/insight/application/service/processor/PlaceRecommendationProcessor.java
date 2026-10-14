package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.AlternativePlaceInfo;
import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.info.RecommendedPlaceInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationCacheKey;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationQuery;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceProfileQueryPort;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceRecommendationCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedPlaceRecommendationQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.insight.domain.model.RecommendationCandidate;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityHeadline;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.InsightProperties;
import com.hondigagae.shared.travel.insight.SuitabilityLevel;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 장소 추천 — "오늘(그 날) 반려견과 가기 좋은 곳" (#1368).
 *
 * <p>후보를 한 번에 모으고, 각 후보를 <b>적합도 한 곳 판정과 같은 규칙</b>({@link PlaceSuitabilityProcessor#score})으로
 * 점수 매긴 뒤 순위를 정한다. 추천 카드의 점수와 그 장소 상세의 적합도가 같은 조건에서 달라지면 안 되기 때문이다.
 *
 * <p>원격 호출을 줄이는 장치가 이 클래스의 요점이다.
 * <ul>
 *   <li><b>날씨는 (격자, 중기예보 구역) 키마다 한 번</b> — 후보 수십 곳이 몇 개 격자에 모인다. 키마다 실패도 기억해
 *       같은 실패를 되풀이하지 않는다</li>
 *   <li><b>혼잡도는 후보 전부를 한 쿼리로</b></li>
 *   <li><b>실내 대체지는 최종 선정된 곳에만</b> — 전 후보에 돌리면 쓰지도 않을 반경 질의가 후보 수만큼 나간다</li>
 *   <li><b>결과 캐시</b> — 같은 날짜 · 같은 반려견 조건 · 같은 개수는 짧게 재사용한다</li>
 * </ul>
 *
 * <p><b>트랜잭션을 걸지 않는다.</b> DB 조회(후보 · 혼잡도)와 기상청 호출이 섞여 있어, 트랜잭션을 걸면 커넥션을 잡은 채
 * 기상청 응답을 기다리게 된다 (architecture-guide §3 의 문서화된 예외 — {@link PlaceSuitabilityProcessor} 와 같은 이유).
 * 각 조회는 독립된 읽기라 스냅샷 일관성이 필요하지 않다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceRecommendationProcessor {

    // 동반 구분 순위. ALLOWED 가 조건 없이 들어가는 곳이라 같은 점수면 앞에 둔다.
    private static final Map<PetAllowanceType, Integer> ALLOWANCE_RANK =
        Map.of(PetAllowanceType.ALLOWED, 0, PetAllowanceType.PARTIALLY_ALLOWED, 1);

    /**
     * 순위 규칙. 실행마다 같은 순서가 나오도록 마지막에 장소 아이디로 못박는다.
     * 점수 높은 순 → 동반 가능(ALLOWED)이 부분 허용보다 앞 → 덜 붐비는 순(모름은 맨 뒤 — 모름은 한산함이 아니다) → 아이디 오름차순.
     */
    private static final Comparator<ScoredCandidate> RANKING = Comparator
        .comparing((ScoredCandidate scored) -> scored.score().score(), Comparator.reverseOrder())
        .thenComparing(scored -> ALLOWANCE_RANK.getOrDefault(scored.candidate().place().petAllowanceType(), Integer.MAX_VALUE))
        .thenComparing(ScoredCandidate::congestionRate, Comparator.nullsLast(Comparator.naturalOrder()))
        .thenComparingLong(scored -> scored.candidate().placeId());

    private final PlaceProfileQueryPort placeProfileQueryPort;
    private final CongestionForecastPort congestionForecastPort;
    private final PlaceRecommendationCachePort placeRecommendationCachePort;
    private final WeatherForecastProcessor weatherForecastProcessor;
    private final WeatherWarningProcessor weatherWarningProcessor;
    private final PlaceSuitabilityProcessor placeSuitabilityProcessor;
    private final InsightMapper insightMapper;
    private final InsightProperties insightProperties;

    public PlaceRecommendationInfo recommend(PlaceRecommendationQuery query) {
        LocalDate targetDate = query.resolvedDate();
        PetCondition pet = query.petCondition();
        int limit = query.limit();
        // "오늘인가" 는 한 번만 판정한다 — 특보를 붙일지와 결론 문구의 "오늘" 이 같은 값을 봐야 한다(적합도와 같은 규칙).
        boolean today = targetDate.equals(LocalDate.now());
        // 특보는 지금 발효 중인 것이라 오늘에만 붙인다. 지역 공통이라 한 번만 조회한다. 캐시 조회보다 먼저 읽어 키에 담는다 —
        // 특보 캐시 한 번 읽기라 싸고, 그래야 특보가 바뀐 뒤 옛 특보로 계산한 결과를 돌려주지 않는다.
        WeatherWarning warning = today ? weatherWarningProcessor.heaviestWarning().orElse(null) : null;
        PlaceRecommendationCacheKey cacheKey = PlaceRecommendationCacheKey.builder()
            .targetDate(targetDate).today(today).warning(warning).petCondition(pet).limit(limit).build();

        // 예열(refreshCache)은 캐시를 읽지 않는다. 직전에 넣은 결과가 아직 살아 있으면 적중으로 끝나 날씨 격자를 하나도
        // 새로 받지 않기 때문이다. 쓰기 규칙(아래)은 사용자 요청과 같다 (#1388).
        if (!query.refreshCache()) {
            Optional<CachedPlaceRecommendationQueryResult> cached = placeRecommendationCachePort.find(cacheKey);
            if (cached.isPresent()) {
                return insightMapper.toRecommendationInfo(cached.get());
            }
        }

        Computation computation = compute(targetDate, today, warning, pet, limit);
        if (computation.weatherDegraded()) {
            // 날씨를 못 받은 격자가 있으면 그 장소들이 빠진 결과다. 캐시하면 원천이 돌아온 뒤에도 TTL 동안
            // 빠진 결과를 계속 준다 — 다음 요청이 다시 계산하게 둔다.
            log.info("Place recommendation not cached, weather degraded date={} limit={}", targetDate, limit);
        } else if (computation.scoredCount() == 0) {
            // 점수를 낸 곳이 하나도 없으면 캐시하지 않는다. 단기예보만 실패하면 dailyForecastsAt 이 실패를 삼키고
            // 중기예보로 계속해 격자 실패로 잡히지 않지만, 오늘은 중기예보가 덮지 않아 모든 장소가 점수 없음이 된다.
            // 그 빈 목록을 TTL 동안 주지 않게 한다. 정말 추천할 곳이 없는 날의 비용은 재계산 한 번뿐이다.
            // 점수는 냈는데 전부 '주의 필요' 라 빈 것은 그날의 답이라 캐시한다(#1434) — 특보 날 홈마다 다시 계산하지 않게.
            log.info("Place recommendation not cached, no scored place date={} limit={}", targetDate, limit);
        } else {
            placeRecommendationCachePort.put(cacheKey,
                insightMapper.toRecommendationQueryResult(computation.info()),
                Duration.ofSeconds(insightProperties.recommendation().cacheTtlSeconds()));
        }
        return computation.info();
    }

    private Computation compute(LocalDate targetDate, boolean today, WeatherWarning warning, PetCondition pet, int limit) {
        InsightProperties.Recommendation settings = insightProperties.recommendation();

        List<RecommendationCandidate> candidates = placeProfileQueryPort
            .findRecommendationCandidates(settings.areaCode(), settings.contentTypeIds()).stream()
            .filter(candidate -> candidate.place().hasCoordinate())
            .toList();
        if (candidates.isEmpty()) {
            log.info("Place recommendation has no candidates areaCode={} contentTypeIds={}", settings.areaCode(), settings.contentTypeIds());
            return new Computation(emptyInfo(targetDate, warning), false, 0);
        }

        Map<Long, CongestionSnapshot> congestions = congestionForecastPort.findByPlacesAndDate(
            candidates.stream().map(RecommendationCandidate::placeId).toList(), targetDate);
        WeatherMemo weatherMemo = new WeatherMemo();

        List<ScoredCandidate> scoredCandidates = candidates.stream()
            .map(candidate -> score(candidate, pet, targetDate, warning, congestions, weatherMemo))
            // 점수를 못 낸 곳(예보 범위 밖 · 날씨 없음)은 "가기 좋은 곳" 이라고 말할 근거가 없다.
            .filter(entry -> entry.score().score() != null)
            .toList();
        // '주의 필요'(LOW, 60점 미만)도 "가기 좋은 곳" 이 아니다 (#1434). 홈 "오늘 갈 만한 곳" 에 55점 제주항일기념관이 나왔다.
        // 정렬이 이미 점수 내림차순이라 내리기만으로는 바뀌지 않는다 — 60점 이상이 limit 보다 적은 날에만 나오므로 뺀다.
        // 가르는 등급은 admissionLevel 이다 — 주의보 날은 특보 감점을 뺀 등급이라 목록이 비지 않고, 경보 날은 0점이라 빈다.
        List<ScoredCandidate> ranked = scoredCandidates.stream()
            .filter(entry -> entry.admissionLevel() != SuitabilityLevel.LOW)
            .sorted(RANKING)
            .toList();
        List<ScoredCandidate> selected = selectDiverse(ranked, limit);

        List<RecommendedPlaceInfo> places = selected.stream()
            .map(scored -> toInfo(scored, pet, warning, today))
            .toList();

        log.info("Place recommendation computed date={} candidates={} scored={} lowExcluded={} selected={} weatherKeys={} "
                + "weatherFailedKeys={}",
            targetDate, candidates.size(), scoredCandidates.size(), scoredCandidates.size() - ranked.size(), places.size(), weatherMemo.size(),
            weatherMemo.failedCount());
        return new Computation(
            PlaceRecommendationInfo.builder().targetDate(targetDate).weatherWarning(warning).places(places).build(),
            weatherMemo.failedCount() > 0, scoredCandidates.size());
    }

    private ScoredCandidate score(
        RecommendationCandidate candidate, PetCondition pet, LocalDate targetDate, WeatherWarning warning,
        Map<Long, CongestionSnapshot> congestions, WeatherMemo weatherMemo
    ) {
        PlaceCondition place = candidate.place();
        Optional<List<DailyWeather>> dailies = weatherMemo.dailiesFor(place);
        DailyWeather daily = dailies.flatMap(list -> DailyWeather.findByDate(list, targetDate)).orElse(null);
        // 적합도 한 곳 판정의 lookupWeather 와 같은 규칙 — 목록을 못 받았으면 장애(UNAVAILABLE), 받았는데 그 날짜만 없으면 범위 밖.
        ForecastCoverage coverage = dailies
            .map(list -> DailyWeather.coverageOn(list, targetDate))
            .orElse(ForecastCoverage.UNAVAILABLE);
        CongestionSnapshot congestion = congestions.getOrDefault(candidate.placeId(), CongestionSnapshot.unknown(targetDate));

        SuitabilityScore score = placeSuitabilityProcessor.score(place, pet, daily, coverage, congestion, warning);
        return new ScoredCandidate(candidate, score, daily, congestion,
            admissionLevel(score, place, pet, daily, coverage, congestion, warning));
    }

    /**
     * '주의 필요' 로 뺄지 가르는 등급 (#1434).
     *
     * <p><b>주의보는 추천을 막지 않는다</b> — 추천 억제 판정은 {@link WeatherWarning#suppressesRecommendation}(경보만) 한 곳이다
     * (weather-insight-integration.md §6-4). 주의보는 종류와 상관없이 45점을 깎아 모든 후보가 55점 이하가 되므로, 표시 점수의
     * 등급으로 가르면 제주에 잦은 풍랑 · 건조 주의보만으로 목록이 빈다. 그래서 주의보 날에는 <b>특보 감점을 뺀 점수의 등급</b>으로
     * 가른다 — 장소 자체가 주의 필요인 곳만 빠진다. 카드의 점수 · 결론은 그대로 특보를 반영한 값이다.
     * 경보 날과 특보 없는 날은 표시 점수의 등급 그대로다(경보는 0점이라 빈 목록).
     */
    private SuitabilityLevel admissionLevel(
        SuitabilityScore score, PlaceCondition place, PetCondition pet, DailyWeather daily, ForecastCoverage coverage,
        CongestionSnapshot congestion, WeatherWarning warning
    ) {
        if (warning == null || WeatherWarning.suppressesRecommendation(warning)) {
            return score.level();
        }
        return placeSuitabilityProcessor.score(place, pet, daily, coverage, congestion, null).level();
    }

    /**
     * 순위대로 고르되 같은 유형은 {@code ceil(limit / 2)} 곳까지만 먼저 담는다 — 관광지만 셋이 오는 식의 쏠림을 막는다.
     * 자리가 남으면 미뤄 둔 것을 순위대로 채운다(후보가 한 유형뿐이어도 limit 을 채운다).
     *
     * <p>고른 뒤에는 다시 순위대로 세운다. 채우기로 들어온 곳이 먼저 담긴 곳보다 점수가 높을 수 있는데, 화면은 위에서부터
     * "더 가기 좋은 곳" 으로 읽는다. 시군구 분산은 하지 않는다 — 제주 시군구는 둘뿐이라 분산의 뜻이 없다.
     */
    static List<ScoredCandidate> selectDiverse(List<ScoredCandidate> ranked, int limit) {
        int perTypeCap = (limit + 1) / 2;
        List<ScoredCandidate> selected = new ArrayList<>();
        List<ScoredCandidate> deferred = new ArrayList<>();
        Map<String, Integer> perType = new HashMap<>();

        for (ScoredCandidate scored : ranked) {
            if (selected.size() >= limit) {
                break;
            }
            String type = scored.candidate().contentTypeId();
            if (perType.getOrDefault(type, 0) < perTypeCap) {
                selected.add(scored);
                perType.merge(type, 1, Integer::sum);
            } else {
                deferred.add(scored);
            }
        }
        for (ScoredCandidate scored : deferred) {
            if (selected.size() >= limit) {
                break;
            }
            selected.add(scored);
        }
        return selected.stream().sorted(RANKING).toList();
    }

    private RecommendedPlaceInfo toInfo(ScoredCandidate scored, PetCondition pet, WeatherWarning warning, boolean today) {
        RecommendationCandidate candidate = scored.candidate();
        PlaceCondition place = candidate.place();
        // 최종 선정된 곳(limit 이하)에만 부른다. 반경 질의라 원천 단위가 장소마다이고, 묶어서 한 번에 낼 수 없다.
        List<AlternativePlaceInfo> alternatives = placeSuitabilityProcessor.findIndoorAlternativesIfRainy(place, scored.daily());

        return RecommendedPlaceInfo.builder()
            .placeId(place.placeId())
            .contentTypeId(candidate.contentTypeId())
            .title(place.title())
            .addr1(candidate.addr1())
            .sigunguCode(place.sigunguCode())
            .lat(place.lat())
            .lng(place.lng())
            .firstImage(candidate.firstImage())
            .firstImage2(candidate.firstImage2())
            .petAllowanceType(place.petAllowanceType())
            .maxPetWeightKg(candidate.maxPetWeightKg())
            .indoor(place.indoor())
            .score(scored.score())
            .headline(SuitabilityHeadline.of(scored.score(), warning != null, today))
            .weather(scored.daily())
            .congestion(scored.congestion())
            .indoorAlternatives(alternatives)
            .petConditionApplied(pet.isSpecified())
            .build();
    }

    private static PlaceRecommendationInfo emptyInfo(LocalDate targetDate, WeatherWarning warning) {
        return PlaceRecommendationInfo.builder().targetDate(targetDate).weatherWarning(warning).places(List.of()).build();
    }

    /**
     * 한 요청 안의 날짜별 예보 메모. 키는 {@link WeatherForecastProcessor#dailyForecastKey} 다.
     *
     * <p>실패(빈 Optional)도 기억한다. 한 격자가 실패했다고 같은 격자의 후보마다 다시 부르면 실패한 원천에 요청만 더
     * 쌓인다. 한 키의 실패는 그 키의 장소만 점수 없음으로 만들고 요청 전체를 실패시키지 않는다. 설정 오류
     * (서비스 키 없음)는 삼키지 않는다 — 적합도 한 곳 판정과 같다.
     */
    private final class WeatherMemo {

        private final Map<String, Optional<List<DailyWeather>>> byKey = new HashMap<>();

        Optional<List<DailyWeather>> dailiesFor(PlaceCondition place) {
            String key = weatherForecastProcessor.dailyForecastKey(place.lat(), place.lng(), place.sigunguCode());
            return byKey.computeIfAbsent(key, ignored -> fetch(place, key));
        }

        private Optional<List<DailyWeather>> fetch(PlaceCondition place, String key) {
            try {
                return Optional.of(weatherForecastProcessor.dailyForecastsAt(place.lat(), place.lng(), place.sigunguCode()));
            } catch (InsightException exception) {
                if (exception.getErrorCode() != InsightErrorCode.WEATHER_UNAVAILABLE) {
                    throw exception;
                }
                log.info("Recommendation weather key unavailable key={} errorCode={}", key, exception.getErrorCode().getCode());
                return Optional.empty();
            }
        }

        int size() {
            return byKey.size();
        }

        long failedCount() {
            return byKey.values().stream().filter(Optional::isEmpty).count();
        }
    }

    /**
     * 점수를 매긴 후보. 판정에 쓴 그날 날씨와 혼잡도를 응답까지 그대로 들고 간다.
     *
     * @param admissionLevel '주의 필요' 로 뺄지 가르는 등급 — 주의보 날에는 특보 감점을 뺀 등급이다({@code admissionLevel()})
     */
    record ScoredCandidate(
        RecommendationCandidate candidate,
        SuitabilityScore score,
        DailyWeather daily,
        CongestionSnapshot congestion,
        SuitabilityLevel admissionLevel
    ) {

        Double congestionRate() {
            return congestion != null && congestion.isKnown() ? congestion.concentrationRate() : null;
        }
    }

    /** @param scoredCount 점수를 낸 후보 수 — '주의 필요' 로 빠진 곳도 센다. 0 이면 원천 문제일 수 있어 캐시하지 않는다 */
    private record Computation(PlaceRecommendationInfo info, boolean weatherDegraded, int scoredCount) {

    }
}
