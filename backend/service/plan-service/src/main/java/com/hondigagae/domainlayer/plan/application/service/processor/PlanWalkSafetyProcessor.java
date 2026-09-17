package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.info.PlanWalkSafetyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWalkSafetyInfo.PlanItemWalkSafetyInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceWalkSafetyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceWalkSafetyQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemWalkSafetyUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.IntFunction;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 일정 항목 단위 산책 위험도.
 *
 * <p>일자 날씨 브리핑은 하루에 대표 장소 한 곳만 판정한다. 산책 위험도는 <b>시각에 따라
 * 갈리므로</b> 같은 방식으로 접을 수 없다 — 같은 해수욕장도 오후 2시와 저녁 7시가 다르다.
 * 그래서 {@code startTime} 이 있는 장소 항목만 따로 판정한다.
 *
 * <p><b>판정 규칙을 복사하지 않는다.</b> 노면온도 추정·체감온도 산식·등급 임계는 tour-service
 * 가 갖고, 여기서는 기존 장소 위험도 API 를 <b>항목의 시각으로</b> 부를 뿐이다. 규칙을 옮기면
 * 장소 화면과 일정 화면이 같은 시각 같은 곳을 다르게 말하게 된다.
 *
 * <p><b>기준 반려견은 그날 날씨 판정의 {@code basisPetId} 와 같다.</b> 여기서 따로 고르면 한
 * 화면이 "몽실이 기준" 이라고 말하는 옆에서 다른 화면이 보리 기준을 말한다. 그날 적합도
 * 조회가 실패한 경우에만 대표(첫 번째) 반려견으로 대신한다 — 그날 기준이 없다는 것이 항목
 * 판정까지 포기할 이유는 아니다. (여기까지 온 항목은 장소를 가진 항목이라 "그날 장소가 없어
 * 기준을 못 냈다" 는 경우는 도달하지 않는다.)
 *
 * <p><b>그 기준은 {@link PlanWeatherProcessor#briefDay} 를 하루치씩 불러 얻는다 — 브리핑 전체
 * ({@code brief}) 를 부르지 않는다.</b> 그러면 특성 조회와 항목 조회가 여기와 똑같이 한 번 더
 * 일어나고, 시각이 하나도 없어 위험도 호출이 0건인 일정에서도 {@code 일수 × 조건 수} 만큼 적합도
 * 원격 호출이 나간다. {@code briefDay} 는 바로 이 재사용을 위해 공개돼 있다.
 *
 * <p><b>같은 (장소, 시각, 기준 반려견) 은 한 번만 묻는다.</b> 같은 장소에 시각이 같은 항목이
 * 둘이면 답도 같으므로 두 번 부를 이유가 없다. 날이 다르면 접지 않는다 — 날짜가 판정의 입력이다.
 *
 * <p>못 낸 이유를 가르는 순서가 있다 ({@link PlanItemWalkSafetyUnavailableReason}).
 * <b>지난 날짜가 먼저다</b> — 무엇을 고쳐도 풀리지 않는 사유라, "시각을 넣어 보세요" 를 먼저
 * 말하면 지켜지지 않을 안내가 된다. 그다음이 사용자가 일정에서 고칠 수 있는 둘(장소 아님 ·
 * 시각 없음)이고, 기다리면 풀리는 예보 범위 밖이 마지막이다.
 */
@Component
@RequiredArgsConstructor
public class PlanWalkSafetyProcessor {

    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PlaceWalkSafetyQueryPort placeWalkSafetyQueryPort;
    private final PlanWeatherProcessor planWeatherProcessor;
    private final Clock clock;

    /**
     * @param petIds 동행 반려견. 비어 있지 않아야 한다 — 옛 일정도 {@code Plan.resolvePetIds} 가
     *               대표 한 마리로 채운다
     */
    public PlanWalkSafetyInfo assess(long memberId, Plan plan, List<Long> petIds) {
        LocalDate today = LocalDate.now(clock);
        // 특성과 항목은 여기서 한 번만 읽고 아래로 넘긴다 — 같은 조회를 브리핑 경로가 다시 하지 않게 한다.
        Map<Long, PetConditionQueryResult> conditions = planWeatherProcessor.loadConditions(memberId, plan, petIds);

        List<PlanItem> items = new ArrayList<>(planItemRepositoryPort.findByPlanId(plan.id()));
        items.sort(Comparator.comparingInt(PlanItem::day).thenComparingInt(PlanItem::sequence));
        Map<Integer, List<PlanItem>> itemsByDay = items.stream().collect(Collectors.groupingBy(PlanItem::day));

        Map<WalkSafetyLookupKey, Optional<PlaceWalkSafetyQueryResult>> answered = new HashMap<>();
        List<PlanItemWalkSafetyInfo> assessed = new ArrayList<>();
        Map<Integer, Long> basisPetByDay = new HashMap<>();
        // 그날 기준 반려견은 실제로 판정할 항목이 나왔을 때 그때 구한다. 미리 전부 구하면 시각도
        // 장소도 없는 날까지 적합도 원격 호출이 나가는데, 그 날의 기준은 아무 데도 쓰이지 않는다.
        IntFunction<Long> basisPetOf = day -> basisPetByDay.computeIfAbsent(day,
            key -> basisPetOn(plan, key, itemsByDay.getOrDefault(key, List.of()), conditions, petIds));

        for (PlanItem item : items) {
            assessed.add(assessItem(item, plan, today, conditions, basisPetOf, answered));
        }

        return PlanWalkSafetyInfo.builder()
            .planId(plan.id())
            .planTitle(plan.title())
            .petIds(petIds)
            .items(assessed)
            .build();
    }

    private PlanItemWalkSafetyInfo assessItem(
        PlanItem item, Plan plan, LocalDate today,
        Map<Long, PetConditionQueryResult> conditions, IntFunction<Long> basisPetOf,
        Map<WalkSafetyLookupKey, Optional<PlaceWalkSafetyQueryResult>> answered
    ) {
        LocalDate date = plan.startDate().plusDays(item.day() - 1L);
        // 시각별 예보 지평으로 가른다. 일자 날씨의 11일과 다르다 — HOURLY_FORECAST_HORIZON_DAYS 참고.
        Optional<PlanItemWalkSafetyUnavailableReason> byDate =
            PlanItemWalkSafetyUnavailableReason.byDate(date, today);

        if (byDate.orElse(null) == PlanItemWalkSafetyUnavailableReason.PAST_DATE) {
            return PlanItemWalkSafetyInfo.unavailable(
                item, date, placeIdOf(item), PlanItemWalkSafetyUnavailableReason.PAST_DATE);
        }
        if (!item.itemType().isPlaceTarget() || item.targetId() == null) {
            // 가리키는 곳을 장소로 내보낼 수 없는 유일한 자리다 — placeId 를 비우는 것도 여기뿐이다.
            return PlanItemWalkSafetyInfo.unavailable(
                item, date, PlanItemWalkSafetyUnavailableReason.NOT_PLACE_TARGET);
        }
        if (item.startTime() == null) {
            return PlanItemWalkSafetyInfo.unavailable(
                item, date, item.targetId(), PlanItemWalkSafetyUnavailableReason.NO_START_TIME);
        }
        if (byDate.isPresent()) {
            return PlanItemWalkSafetyInfo.unavailable(
                item, date, item.targetId(), PlanItemWalkSafetyUnavailableReason.BEYOND_FORECAST_RANGE);
        }

        long basisPetId = basisPetOf.apply(item.day());
        LocalDateTime targetDateTime = date.atTime(item.startTime());
        PetConditionQueryResult condition = conditions.getOrDefault(basisPetId, PetConditionQueryResult.unknown());

        Optional<PlaceWalkSafetyQueryResult> safety = answered.computeIfAbsent(
            new WalkSafetyLookupKey(item.targetId(), targetDateTime, basisPetId),
            key -> placeWalkSafetyQueryPort.findWalkSafety(key.placeId(), key.targetDateTime(), condition));

        return safety
            .map(result -> toInfo(item, date, basisPetId, targetDateTime, result))
            // 장소는 남긴다 — 화면은 이 줄에서 장소 위험도 API 를 직접 불러 다시 시도할 수 있다.
            .orElseGet(() -> PlanItemWalkSafetyInfo.unavailable(
                item, date, item.targetId(), PlanItemWalkSafetyUnavailableReason.LOOKUP_FAILED));
    }

    /**
     * 그 항목이 장소로 내보낼 수 있는 아이디. {@code WALK} 의 {@code targetId} 는
     * {@code walk_course.id} 라 그대로 실으면 화면이 <b>남의 아이디로</b> 장소를 연다 (#89).
     *
     * <p>사유를 가르는 순서상 {@code PAST_DATE} 는 장소 여부를 보기 전에 나가므로, 그 줄에서만
     * 이 판정이 필요하다.
     */
    private static Long placeIdOf(PlanItem item) {
        return item.itemType().isPlaceTarget() ? item.targetId() : null;
    }

    /**
     * 그날 판정 기준 반려견. <b>일자 날씨 브리핑과 같은 경로</b>({@link PlanWeatherProcessor#briefDay})
     * 로 구한다 — 여기서 따로 고르면 두 화면이 같은 날을 다른 아이 기준으로 말한다.
     *
     * <p>그날 적합도 조회가 전부 실패해 기준을 못 낸 경우에만 대표(첫 번째) 반려견으로 떨어진다.
     * 그날 기준이 없다는 것이 항목 판정까지 포기할 이유는 아니다.
     */
    private long basisPetOn(
        Plan plan, int day, List<PlanItem> dayItems,
        Map<Long, PetConditionQueryResult> conditions, List<Long> petIds
    ) {
        Long basisPetId = planWeatherProcessor.briefDay(plan, day, dayItems, conditions).basisPetId();
        return basisPetId != null ? basisPetId : petIds.get(0);
    }

    private static PlanItemWalkSafetyInfo toInfo(
        PlanItem item, LocalDate date, long basisPetId, LocalDateTime targetDateTime,
        PlaceWalkSafetyQueryResult result
    ) {
        return PlanItemWalkSafetyInfo.builder()
            .planItemId(item.id())
            .day(item.day())
            .date(date)
            .sequence(item.sequence())
            .startTime(item.startTime())
            .title(item.title())
            .placeId(item.targetId())
            .placeTitle(result.placeTitle())
            // 원천은 우리가 보낸 시각을 보정하지 않고 그대로 돌려준다
            // (tour-service PlaceInsightQuery.resolvedDateTime). 그래도 분기를 남기는 것은
            // 응답에서 이 필드가 빠졌을 때 판정 기준 시각이 통째로 비는 것을 막는 방어적 대체다.
            .targetDateTime(result.targetDateTime() != null ? result.targetDateTime() : targetDateTime)
            .basisPetId(basisPetId)
            .levelCode(result.levelCode())
            .levelName(result.levelName())
            .levelDescription(result.levelDescription())
            .estimatedPavementCelsius(result.estimatedPavementCelsius())
            .feelsLikeCelsius(result.feelsLikeCelsius())
            .temperature(result.temperature())
            .saferWindowStart(result.saferWindowStart())
            .saferWindowEnd(result.saferWindowEnd())
            .build();
    }

    /**
     * 같은 답이 나오는 호출을 접기 위한 키. 장소·시각·기준 반려견이 같으면 tour-service 답도 같다.
     *
     * <p>{@code targetDateTime} 은 날짜까지 포함한다 — 같은 장소 같은 시:분이라도 <b>날이 다르면
     * 답이 다르다.</b> 노면온도 추정이 태양 고도(날짜·위도)를 쓰고 예보 자체도 날짜별이다.
     */
    private record WalkSafetyLookupKey(long placeId, LocalDateTime targetDateTime, long basisPetId) {

    }
}
