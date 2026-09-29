package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.info.PlanDaySuitabilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PetSuitabilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetConditionRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.shared.travel.plan.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.enums.PlanDayWeatherUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPetCondition;
import java.time.Clock;
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
 * <p><b>그날 장소 전체를 판정하고, 가장 힘든 곳이 그날을 정한다</b> (#1045). 예전에는 순서가 가장
 * 앞선 장소 한 곳만 물었다 — 날씨만 보면 하루 안의 장소는 대개 같은 격자라 충분했지만, 적합도
 * 근거의 대부분은 <b>장소의 사정</b>(크기 제한 · 동반 요금 · 혼잡)이다. 첫 장소의 근거가 "N일차" 아래
 * 그날 전체의 판정으로 읽혔고, 둘째 장소가 대형견 입장 불가여도 드러나지 않았다.
 * 기준 반려견과 같은 원칙이다 — 한 곳이라도 힘든 날이면 그날은 힘든 날이다.
 *
 * <p>호출 수는 일수 × 그날 장소 수(같은 장소는 한 번, 최대 {@value #MAX_PLACES_PER_DAY}) × 서로 다른
 * 조건 수(최대 5)다. 날짜로 답이 정해지는 날(지난 날짜 · 예보 범위 밖)은 묻지 않으므로 실제로
 * 부르는 날은 오늘부터 11일 이내뿐이다.
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
 * <p>좌표 없는 항목(이동 등)은 판정에서 제외한다. {@code targetId} 가 있는 장소성 항목만
 * 판정 대상이 된다.
 *
 * <p><b>못 낸 이유를 넷으로 가른다</b> ({@link PlanDayWeatherUnavailableReason}). 지난 날짜에
 * "잠시 후 다시 시도해 주세요" 라고 하면 지켜지지 않을 안내가 되고, 실제 예보 장애와도
 * 구분되지 않는다 (#492). 날짜만으로 답이 정해지는 둘(지난 날짜 · 예보 범위 밖)은 원격 호출
 * <b>전에</b> 가른다 — 물어도 결과가 정해져 있는 날에 호출을 내보내지 않는다.
 *
 * <p>"오늘" 은 {@link Clock} 에서 얻는다. 시스템 시각을 직접 읽으면 이 판정이 테스트에서
 * 고정되지 않고, 서비스 기준 시간대(KST)가 배포 환경변수에 흔들린다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanWeatherProcessor {

    /** 하루 판정 대상 장소 수 상한. 하루 동선이 이보다 긴 일정은 드물고, 호출 수가 장소 수에 비례해 는다. */
    static final int MAX_PLACES_PER_DAY = 8;

    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final PlanPetConditionRepositoryPort planPetConditionRepositoryPort;
    private final PlaceSuitabilityQueryPort placeSuitabilityQueryPort;
    private final Clock clock;

    /**
     * @param petIds 동행 반려견. 비어 있지 않아야 한다 — 옛 일정도 {@code Plan.resolvePetIds} 가 대표 한 마리로 채운다
     */
    public PlanWeatherInfo brief(long memberId, Plan plan, List<Long> petIds) {
        Map<Long, PetConditionQueryResult> conditions = loadConditions(memberId, plan, petIds);
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
     *
     * <p><b>여행 브리핑이 하루치만 재사용한다 — 복사하지 않고 같은 판정 경로를 쓰기 위해
     * 공개했다.</b> 사본을 두면 "특성을 못 받으면 일반 조건" 같은 규칙이 두 곳으로 갈라진다.
     *
     * <p>이쪽은 <b>항상 원천(auth-service)을 읽는다</b>. 완료 시점 스냅샷을 찍는 경로가 이 값을
     * 쓰고, 조회는 상태를 보는 {@link #loadConditions(long, Plan, List)} 를 쓴다.
     */
    public Map<Long, PetConditionQueryResult> loadConditions(long memberId, List<Long> petIds) {
        return fill(petIds, petConditionQueryPort.findConditions(memberId, petIds));
    }

    /**
     * 일정 상태에 맞는 특성을 읽는다.
     *
     * <p><b>완료된 일정은 완료 시점 스냅샷을 쓴다</b> (#629). 다녀온 뒤 프로필을 고쳤다고
     * "그때 몽실이 기준" 이 달라지면 그 기록은 거짓이 된다. 진행 중(초안·확정)인 일정은 반대로
     * 매번 다시 읽는다 — 체중·민감도를 고치면 다음 판정에 곧바로 반영되어야 한다.
     *
     * <p>스냅샷이 없는 완료 일정은 이 기능 이전에 완료된 것이다. 그때는 예전처럼 원격을 읽는다 —
     * 없는 기록을 지어내지 않는다.
     */
    public Map<Long, PetConditionQueryResult> loadConditions(long memberId, Plan plan, List<Long> petIds) {
        if (plan.status() == PlanStatus.COMPLETED) {
            Map<Long, PetConditionQueryResult> snapshot = planPetConditionRepositoryPort.findByPlanId(plan.id())
                .stream()
                .collect(Collectors.toMap(PlanPetCondition::petId, PlanPetCondition::toQueryResult,
                    (first, second) -> first, LinkedHashMap::new));
            if (!snapshot.isEmpty()) {
                return fill(petIds, snapshot);
            }
        }
        return loadConditions(memberId, petIds);
    }

    private static Map<Long, PetConditionQueryResult> fill(
        List<Long> petIds, Map<Long, PetConditionQueryResult> found
    ) {
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

    /**
     * 하루치 브리핑.
     *
     * <p><b>여행 브리핑이 하루치만 재사용한다 — 복사하지 않고 같은 판정 경로를 쓰기 위해
     * 공개했다.</b> 판정 장소 선정·아이별 판정·기준 반려견 선택이 전부 이 안에 있어, 사본을
     * 두면 일정 화면과 브리핑 화면이 같은 날을 다르게 말하게 된다.
     *
     * @param items 그날({@code day})의 항목만. 걸러내기는 호출부가 한다
     */
    public PlanDayWeatherInfo briefDay(
        Plan plan, int day, List<PlanItem> items, Map<Long, PetConditionQueryResult> conditions
    ) {
        LocalDate date = plan.startDate().plusDays(day - 1L);
        List<PlanItem> places = placesToJudge(items);
        Optional<PlanItem> first = places.stream().findFirst();

        // 날짜만으로 정해지는 사유가 먼저다 — 장소를 담아도 tour-service 가 멀쩡해도 달라지지 않는다.
        // 판정을 가를 장소가 없으니 순서가 가장 앞선 장소를 그대로 실어 보낸다.
        Optional<PlanDayWeatherUnavailableReason> byDate =
            PlanDayWeatherUnavailableReason.byDate(date, LocalDate.now(clock));
        if (byDate.isPresent()) {
            return first
                .map(place -> PlanDayWeatherInfo.unavailable(day, date, place, byDate.get()))
                .orElseGet(() -> PlanDayWeatherInfo.unavailable(day, date, byDate.get()));
        }

        if (first.isEmpty()) {
            return PlanDayWeatherInfo.unavailable(day, date, PlanDayWeatherUnavailableReason.NO_PLACE_ITEM);
        }

        // 장소마다 아이별로 판정한다. 조회에 실패한 장소는 빠지고 남은 장소로 판정한다 — 반려견 축과 같은 규칙이다.
        List<Judgement> judgements = new ArrayList<>();
        for (PlanItem place : places) {
            judgeEachPet(place.targetId(), date, conditions)
                .forEach((petId, result) -> judgements.add(new Judgement(place, petId, result)));
        }
        if (judgements.isEmpty()) {
            // 여기까지 왔으면 예보가 닿는 날짜다 — 남은 설명은 조회 실패뿐이고, 그것만 재시도가 의미 있다.
            log.warn("Plan weather lookup failed planId={} day={} places={}", plan.id(), day, places.size());
            return PlanDayWeatherInfo.unavailable(day, date, first.get(), PlanDayWeatherUnavailableReason.LOOKUP_FAILED);
        }

        Judgement decisive = pickDecisive(judgements);
        return PlanDayWeatherInfo.builder()
            .day(day)
            .date(date)
            .representativePlaceId(decisive.place().targetId())
            .representativePlaceTitle(decisive.place().title())
            .representativePlanItemId(decisive.place().id())
            .basisPetId(decisive.petId())
            .suitability(toSuitabilityInfo(decisive.result()))
            .petSuitabilities(toPetSuitabilities(conditions, judgements))
            .build();
    }

    /**
     * 그날 판정할 장소 — 장소성 항목을 순서대로, <b>같은 장소는 한 번만</b>, 최대 {@value #MAX_PLACES_PER_DAY}곳.
     *
     * <p>같은 장소를 두 번 담아도(점심·저녁) 판정은 같으므로 다시 묻지 않는다. 항목은 순서가 앞선 쪽이 남는다.
     * 장소성의 판정은 {@link #pickRepresentative} 와 같은 {@link #isJudgeablePlace} 를 쓴다.
     */
    private static List<PlanItem> placesToJudge(List<PlanItem> items) {
        Map<Long, PlanItem> byPlaceId = new LinkedHashMap<>();
        items.stream()
            .filter(PlanWeatherProcessor::isJudgeablePlace)
            .sorted(Comparator.comparingInt(PlanItem::sequence))
            .forEach(item -> byPlaceId.putIfAbsent(item.targetId(), item));
        return byPlaceId.values().stream().limit(MAX_PLACES_PER_DAY).toList();
    }

    /** (장소, 반려견) 한 조합의 판정. */
    private record Judgement(PlanItem place, long petId, PlaceSuitabilityQueryResult result) {
    }

    /**
     * 그날을 정하는 조합 — 점수가 가장 낮은 (장소, 반려견). 동점이면 순서가 앞선 장소 · 앞선 아이다.
     * 점수가 없는(판단 근거 없음) 결과만 있으면 첫 조합을 두어 날씨·이유는 보여 준다.
     */
    private static Judgement pickDecisive(List<Judgement> judgements) {
        return judgements.stream()
            .filter(judgement -> judgement.result().score() != null)
            .min(Comparator.comparingInt(judgement -> judgement.result().score()))
            .orElse(judgements.get(0));
    }

    /**
     * 아이별 요약 — 아이마다 <b>그날 가장 힘든 장소</b>의 판정이다. 기준 반려견의 요약은 그날 판정과 같다.
     * 어느 장소에서도 판정을 못 받은 아이는 빠진다 (예전 규칙 그대로).
     */
    private List<PetSuitabilityInfo> toPetSuitabilities(
        Map<Long, PetConditionQueryResult> conditions, List<Judgement> judgements
    ) {
        Map<Long, PlaceSuitabilityQueryResult> worstByPet = new LinkedHashMap<>();
        for (Long petId : conditions.keySet()) {
            List<Judgement> ofPet = judgements.stream().filter(judgement -> judgement.petId() == petId).toList();
            if (!ofPet.isEmpty()) {
                worstByPet.put(petId, pickDecisive(ofPet).result());
            }
        }
        return toPetSuitabilities(worstByPet);
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

    private List<PetSuitabilityInfo> toPetSuitabilities(Map<Long, PlaceSuitabilityQueryResult> resultsByPetId) {
        return resultsByPetId.entrySet().stream()
            .map(entry -> PetSuitabilityInfo.builder()
                .petId(entry.getKey())
                .score(entry.getValue().score())
                .levelCode(entry.getValue().levelCode())
                .levelName(entry.getValue().levelName())
                .levelDescription(entry.getValue().levelDescription())
                .levelScoreDescription(entry.getValue().levelScoreDescription())
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
            .levelScoreDescription(result.levelScoreDescription())
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
     * 그날의 <b>좌표 기준</b> 장소 — 가장 이른 순서의 장소성 항목.
     *
     * <p><b>일자 적합도의 대표가 아니다</b> (#1045). 적합도는 {@link #briefDay} 가 그날 장소 전체 중
     * 가장 힘든 곳으로 낸다. 이 값은 여행 브리핑의 골든타임 곡선 · 대표 좌표처럼 한 지점이 필요한
     * 자리에 쓴다 — 하루의 첫 목적지가 그날 동선의 기준점이다.
     *
     * <p>"장소성" 의 판정은 {@link PlanItemType#isPlaceTarget()} 이 갖는다. {@code MOVE} 만 빼면
     * {@code WALK} 가 통과하는데, 그 {@code targetId} 는 {@code walk_course.id} 라 장소 적합도를
     * 조회하면 남의 아이디로 없는 장소를 찾는다 (#89). 상세·긴급 시설 조회와 같은 집합을 써야 한다.
     *
     * <p>여행 브리핑이 골든타임 좌표를 구할 때 재사용한다. 상태를 쓰지 않으므로 static 이다.
     */
    public static Optional<PlanItem> pickRepresentative(List<PlanItem> items) {
        return items.stream()
            .filter(PlanWeatherProcessor::isJudgeablePlace)
            .min(Comparator.comparingInt(PlanItem::sequence));
    }

    private static boolean isJudgeablePlace(PlanItem item) {
        return item.targetId() != null && item.itemType().isPlaceTarget();
    }
}
