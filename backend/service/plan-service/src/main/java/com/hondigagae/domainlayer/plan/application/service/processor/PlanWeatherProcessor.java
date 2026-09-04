package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.info.PlanDaySuitabilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PetSuitabilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 일정 날씨 브리핑 산출.
 *
 * <p><b>일자마다 대표 장소 한 곳만 조회한다.</b> 항목마다 부르면 3박 4일 일정에 열 번 넘는
 * 원격 호출이 생기고, 그만큼 타임아웃 위험이 커진다. 하루 안의 항목들은 대개 같은 격자에
 * 들어가 날씨가 거의 같으므로, 대표 한 곳이면 "그날 우산 필요한가"에 답이 된다.
 *
 * <p><b>여러 마리면 아이별로 따로 판정하고, 점수가 가장 낮은 아이를 그날의 기준으로 삼는다.</b>
 * 조건을 하나로 합쳐(더위 민감 OR 추위 민감, 크기는 최대) 한 번만 부르면 호출은 줄지만
 * 존재하지 않는 가상의 개 기준이 된다 — 가장 큰 아이가 더위에 가장 약한 아이라는 보장이 없고,
 * 견종(단두종) 축은 합칠 방법이 없다. 아이별로 보면 "몽실이 기준" 이라고 말할 수 있다.
 * 조건이 같은 아이들은 한 번만 묻는다 — 특성 조회에 실패해 전부 일반 조건이 됐을 때 마리
 * 수만큼 같은 질문을 반복하지 않기 위해서다. 호출 수는 일수 × 서로 다른 조건 수(최대 5)다.
 *
 * <p>항목 단위 판정이 필요해지는 순간은 <b>산책 위험도</b>다. 그것은 시각에 따라 갈리므로
 * 같은 방식으로 접을 수 없고, 별도 조회로 다뤄야 한다.
 *
 * <p>좌표 없는 항목(이동 등)은 대표에서 제외한다. {@code targetId} 가 있는 장소성 항목만
 * 대표가 될 수 있다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanWeatherProcessor {

    private static final String NO_PLACE_ITEM = "이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.";
    private static final String LOOKUP_FAILED = "날씨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";

    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final PlaceSuitabilityQueryPort placeSuitabilityQueryPort;

    /**
     * @param petIds 동행 반려견. 비어 있지 않아야 한다 — 옛 일정도 {@code Plan.resolvePetIds} 가 대표 한 마리로 채운다
     */
    public PlanWeatherInfo brief(long memberId, Plan plan, List<Long> petIds) {
        Map<Long, PetConditionQueryResult> conditions = loadConditions(memberId, petIds);
        Map<Integer, List<PlanItem>> itemsByDay = planItemRepositoryPort.findByPlanId(plan.id()).stream()
            .collect(Collectors.groupingBy(PlanItem::day));

        List<PlanDayWeatherInfo> days = new ArrayList<>();
        for (int day = 1; day <= plan.totalDays(); day++) {
            days.add(briefDay(plan, day, itemsByDay.getOrDefault(day, List.of()), conditions));
        }

        return PlanWeatherInfo.builder()
            .planId(plan.id())
            .planTitle(plan.title())
            .startDate(plan.startDate())
            .endDate(plan.endDate())
            .petIds(petIds)
            // 반려견 특성을 한 마리라도 실제로 받아왔는지. 못 받았으면 일반 조건으로 판정된 결과다.
            .petConditionApplied(conditions.values().stream().anyMatch(PlanWeatherProcessor::isKnown))
            .days(days)
            .build();
    }

    /**
     * 요청한 모든 반려견에 조건을 붙인다. 벌크 조회에서 빠진 아이(소유 아님·조회 실패)는
     * {@link PetConditionQueryResult#unknown()} 이다 — 특성이 없어도 그 아이 몫의 판정은 나간다.
     * 순서를 지켜 첫 번째(대표)가 동점일 때 기준이 된다.
     */
    private Map<Long, PetConditionQueryResult> loadConditions(long memberId, List<Long> petIds) {
        Map<Long, PetConditionQueryResult> found = petConditionQueryPort.findConditions(memberId, petIds);
        Map<Long, PetConditionQueryResult> conditions = new LinkedHashMap<>();
        for (Long petId : petIds) {
            conditions.put(petId, found.getOrDefault(petId, PetConditionQueryResult.unknown()));
        }
        return conditions;
    }

    private static boolean isKnown(PetConditionQueryResult pet) {
        return pet.sizeType() != null || pet.heatSensitive() || pet.coldSensitive()
            || pet.noiseSensitive() || pet.breed() != null;
    }

    private PlanDayWeatherInfo briefDay(
        Plan plan, int day, List<PlanItem> items, Map<Long, PetConditionQueryResult> conditions
    ) {
        LocalDate date = plan.startDate().plusDays(day - 1L);

        Optional<PlanItem> representative = pickRepresentative(items);
        if (representative.isEmpty()) {
            return PlanDayWeatherInfo.unavailable(day, date, NO_PLACE_ITEM);
        }

        PlanItem item = representative.get();
        Map<Long, PlaceSuitabilityQueryResult> resultsByPetId = judgeEachPet(item.targetId(), date, conditions);
        Optional<Long> basisPetId = pickBasisPet(resultsByPetId);
        if (basisPetId.isEmpty()) {
            log.info("Plan weather unavailable planId={} day={} placeId={}", plan.id(), day, item.targetId());
            return PlanDayWeatherInfo.builder()
                .day(day).date(date)
                .representativePlaceId(item.targetId())
                .representativePlaceTitle(item.title())
                .petSuitabilities(List.of())
                .unavailableReason(LOOKUP_FAILED)
                .build();
        }

        return PlanDayWeatherInfo.builder()
            .day(day)
            .date(date)
            .representativePlaceId(item.targetId())
            .representativePlaceTitle(item.title())
            .basisPetId(basisPetId.get())
            .suitability(toSuitabilityInfo(resultsByPetId.get(basisPetId.get())))
            .petSuitabilities(toPetSuitabilities(resultsByPetId))
            .build();
    }

    /**
     * 아이별 판정. <b>조건이 같은 아이는 한 번만 묻고</b> 결과를 나눠 준다. 조회에 실패한 조건은
     * 결과 맵에서 빠진다 — 그 아이만 빠지고 나머지 아이의 판정은 살아 있다.
     */
    private Map<Long, PlaceSuitabilityQueryResult> judgeEachPet(
        long placeId, LocalDate date, Map<Long, PetConditionQueryResult> conditions
    ) {
        Map<PetConditionQueryResult, Optional<PlaceSuitabilityQueryResult>> byCondition = new LinkedHashMap<>();
        Map<Long, PlaceSuitabilityQueryResult> results = new LinkedHashMap<>();
        conditions.forEach((petId, condition) -> {
            // 성격상 반복이 맞는 자리다 — 판정 단위가 (장소, 날짜, 반려견 조건) 이라 조건마다 한 번씩 묻는다 (§9-7).
            Optional<PlaceSuitabilityQueryResult> result = byCondition.computeIfAbsent(
                condition, key -> placeSuitabilityQueryPort.findSuitability(placeId, date, key));
            result.ifPresent(found -> results.put(petId, found));
        });
        return results;
    }

    /**
     * 그날의 기준 반려견 — 점수가 가장 낮은 아이. 한 마리라도 힘든 날이면 그날은 힘든 날이다.
     * 점수가 없는(판단 근거 없음) 결과만 있으면 첫 번째 아이를 기준으로 두어 날씨·이유는 보여 준다.
     */
    private Optional<Long> pickBasisPet(Map<Long, PlaceSuitabilityQueryResult> resultsByPetId) {
        if (resultsByPetId.isEmpty()) {
            return Optional.empty();
        }
        return resultsByPetId.entrySet().stream()
            .filter(entry -> entry.getValue().score() != null)
            .min(Comparator.comparingInt(entry -> entry.getValue().score()))
            .map(Map.Entry::getKey)
            .or(() -> resultsByPetId.keySet().stream().findFirst());
    }

    private List<PetSuitabilityInfo> toPetSuitabilities(Map<Long, PlaceSuitabilityQueryResult> resultsByPetId) {
        return resultsByPetId.entrySet().stream()
            .map(entry -> PetSuitabilityInfo.builder()
                .petId(entry.getKey())
                .score(entry.getValue().score())
                .levelCode(entry.getValue().levelCode())
                .levelName(entry.getValue().levelName())
                .levelDescription(entry.getValue().levelDescription())
                .build())
            .toList();
    }

    /**
     * out-port 계약(QueryResult)을 application 표현으로 접는다. Presenter 까지 QueryResult 가
     * 번지면 tour-service 응답 스키마 변화가 화면 조립 코드를 직접 흔든다 (architecture-guide §4).
     */
    private PlanDaySuitabilityInfo toSuitabilityInfo(PlaceSuitabilityQueryResult result) {
        return PlanDaySuitabilityInfo.builder()
            .placeId(result.placeId())
            .placeTitle(result.placeTitle())
            .targetDate(result.targetDate())
            .score(result.score())
            .levelCode(result.levelCode())
            .levelName(result.levelName())
            .levelDescription(result.levelDescription())
            .reasons(result.reasons() == null ? java.util.List.of() : result.reasons().stream()
                .map(reason -> PlanDaySuitabilityInfo.ReasonInfo.builder()
                    .code(reason.code()).name(reason.name())
                    .description(reason.description()).scoreDelta(reason.scoreDelta())
                    .build())
                .toList())
            .weather(result.weather() == null ? null : PlanDaySuitabilityInfo.DailyWeatherInfo.builder()
                .date(result.weather().date())
                .forecastSourceCode(result.weather().forecastSourceCode())
                .forecastSourceName(result.weather().forecastSourceName())
                .minTemperature(result.weather().minTemperature())
                .maxTemperature(result.weather().maxTemperature())
                .maxPrecipitationProbability(result.weather().maxPrecipitationProbability())
                .precipitationTypeName(result.weather().precipitationTypeName())
                .skyStateName(result.weather().skyStateName())
                .maxWindSpeed(result.weather().maxWindSpeed())
                .maxHumidity(result.weather().maxHumidity())
                .maxFeelsLikeTemperature(result.weather().maxFeelsLikeTemperature())
                .build())
            .indoorAlternatives(result.indoorAlternatives() == null ? java.util.List.of()
                : result.indoorAlternatives().stream()
                    .map(alternative -> PlanDaySuitabilityInfo.AlternativeInfo.builder()
                        .placeId(alternative.placeId()).title(alternative.title())
                        .lat(alternative.lat()).lng(alternative.lng())
                        .distanceMeters(alternative.distanceMeters())
                        .build())
                    .toList())
            .weatherApplied(result.weatherApplied())
            .congestionApplied(result.congestionApplied())
            .build();
    }

    /**
     * 그날의 대표 장소.
     *
     * <p>가장 이른 순서의 장소성 항목을 쓴다. 하루의 첫 목적지가 그날 동선의 기준점이고,
     * 사용자도 보통 그곳을 떠올린다.
     */
    private Optional<PlanItem> pickRepresentative(List<PlanItem> items) {
        return items.stream()
            .filter(item -> item.targetId() != null)
            .filter(item -> item.itemType() != PlanItemType.MOVE)
            .min(Comparator.comparingInt(PlanItem::sequence));
    }
}
