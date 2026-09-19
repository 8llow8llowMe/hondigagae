package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.ItemBriefInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.ScheduleInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.WalkTimesInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.WeatherWarningInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.WalkTimesQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.WeatherWarningQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlaceSummaryQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.WalkTimesQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.WeatherWarningQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWalkTimesUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWarningUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 하루치 여행 브리핑 조립 — 그날 일정 요약 + 날씨 + 기상특보 + 산책 골든타임.
 *
 * <h2>전부 중계다. 재계산하지 않는다</h2>
 *
 * 날씨는 {@link PlanWeatherProcessor#briefDay} 를 그대로 부르고, 특보와 골든타임은
 * tour-service 가 낸 값을 옮기기만 한다. 점수·등급·골든타임 구간을 이쪽에서 다시 세우면
 * 일정 화면과 장소 화면이 같은 날 같은 곳을 다르게 말하게 된다 — 판정 규칙의 소유자는
 * tour-service 다.
 *
 * <h2>특보·골든타임은 요청 날짜가 오늘일 때만 붙인다</h2>
 *
 * <p><b>골든타임</b>은 tour 의 {@code GET /api/v1/insights/walk-times} 가 "오늘 남은 시간"
 * 전용이라 내일 이후를 물을 수단 자체가 없다. 없는 값을 지어내는 대신 사유를 준다 — 문장이
 * 아니라 enum 이라, 화면이 "기다리면 풀린다" 와 "재시도해야 한다" 를 갈라 그릴 수 있다 (#716).
 *
 * <p><b>특보</b>는 발효 중인 것만 존재한다. tour 의 적합도 판정도 같은 규칙으로
 * {@code targetDate.equals(LocalDate.now())} 일 때만 특보를 붙인다 — 내일 날짜에 오늘 특보를
 * 붙이면 "내일 태풍" 이라는 없는 예보가 화면에 선다.
 *
 * <h2>특보를 못 확인한 것을 "없음" 으로 보이게 하지 않는다</h2>
 *
 * 이 브리핑의 가장 위험한 실패는 <b>특보가 떠 있는데 화면이 조용한 것</b>이다. 그래서
 * {@link WeatherWarningQueryPort} 만 조회 실패를 예외로 올리고, 여기서 잡아
 * {@code weatherWarningUnavailableReason} 에
 * {@link PlanBriefingWarningUnavailableReason#LOOKUP_FAILED} 를 담는다. 특보가 정말 없으면 그
 * 필드는 null 이다 — 두 상태가 응답에서 구분된다.
 *
 * <h2>원격 호출 수</h2>
 *
 * 하루치라 상한이 낮다 — auth 반려견 특성 1 + tour 적합도(서로 다른 조건 수, 최대 5)
 * + tour 장소 요약 1 + tour 특보 1 + tour 골든타임 1. 대표 장소가 없으면 장소 요약·골든타임이
 * 빠지고, 오늘이 아니면 특보·골든타임 호출은 아예 나가지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanBriefingProcessor {

    private final PlanItemRepositoryPort planItemRepositoryPort;
    private final PlanPlaceLookupPort planPlaceLookupPort;
    private final PlanWeatherProcessor planWeatherProcessor;
    private final WeatherWarningQueryPort weatherWarningQueryPort;
    private final WalkTimesQueryPort walkTimesQueryPort;
    /** 날씨 판정과 <b>같은</b> "오늘" 을 써야 한다 — 갈리면 자정 경계에서 한 응답 안의 두 값이 어긋난다. */
    private final Clock clock;

    /**
     * 소유권 확인은 다른 유스케이스와 같이 Facade 가 한다 — 이 Processor 는 브리핑 조립만 맡는다.
     *
     * @param petIds 동행 반려견. 비어 있지 않아야 한다 — 옛 일정도 {@code Plan.resolvePetIds} 가 대표 한 마리로 채운다
     * @param date 브리핑할 날짜. 일정 기간 밖이면 {@link PlanErrorCode#PLAN_DAY_OUT_OF_RANGE}
     */
    public PlanBriefingInfo brief(long memberId, Plan plan, List<Long> petIds, LocalDate date) {
        int day = resolveDay(plan, date);

        // 일자 단위 조회 포트가 없어 전체를 받아 거른다. 한 일정은 최대 30일이라 이 편이 단순하고,
        // 상세·날씨 브리핑이 이미 같은 조회를 쓴다.
        List<PlanItem> dayItems = planItemRepositoryPort.findByPlanId(plan.id()).stream()
            .filter(item -> item.day() == day)
            .sorted(Comparator.comparingInt(PlanItem::sequence))
            .toList();

        Map<Long, PetConditionQueryResult> conditions = planWeatherProcessor.loadConditions(memberId, plan, petIds);
        PlanDayWeatherInfo weather = planWeatherProcessor.briefDay(plan, day, dayItems, conditions);

        // 대표 장소는 날씨 판정과 같은 것을 쓴다. 다르면 한 화면에 서로 다른 장소가 기준으로 선다.
        Optional<PlanItem> representative = PlanWeatherProcessor.pickRepresentative(dayItems);
        Optional<PlanPlaceSummaryQueryResult> representativePlace = findSummary(representative);

        boolean today = date.equals(LocalDate.now(clock));
        Long basisPetId = resolveBasisPetId(weather, petIds);

        Warning warning = today ? loadWarning(plan, date) : Warning.notToday();
        Golden golden = today
            ? loadWalkTimes(plan, representative, representativePlace, conditionOf(conditions, basisPetId))
            : Golden.notToday();

        return PlanBriefingInfo.builder()
            .planId(plan.id())
            .planTitle(plan.title())
            .day(day)
            .date(date)
            .today(today)
            .petIds(petIds)
            .basisPetId(basisPetId)
            // 반려견 특성을 한 마리라도 실제로 받아왔는지. 날씨 브리핑과 같은 판정이다.
            .petConditionApplied(conditions.values().stream().anyMatch(PlanBriefingProcessor::isKnown))
            .schedule(toScheduleInfo(dayItems, representative, representativePlace))
            .weather(weather)
            .weatherWarning(warning.info())
            .weatherWarningUnavailableReason(warning.unavailableReason())
            .walkTimes(golden.info())
            .walkTimesUnavailableReason(golden.unavailableReason())
            .build();
    }

    private int resolveDay(Plan plan, LocalDate date) {
        int day = (int) ChronoUnit.DAYS.between(plan.startDate(), date) + 1;
        if (!plan.containsDay(day)) {
            throw new PlanException(PlanErrorCode.PLAN_DAY_OUT_OF_RANGE);
        }
        return day;
    }

    /** 날씨 판정이 고른 기준 아이가 있으면 그 아이. 판정을 못 냈으면 대표(첫 번째)다. */
    private Long resolveBasisPetId(PlanDayWeatherInfo weather, List<Long> petIds) {
        if (weather != null && weather.basisPetId() != null) {
            return weather.basisPetId();
        }
        return petIds == null || petIds.isEmpty() ? null : petIds.get(0);
    }

    /** 기준 아이의 조건. 특성을 못 받았으면 일반 조건으로 판정한다 — 조회 자체를 막지 않는다. */
    private PetConditionQueryResult conditionOf(Map<Long, PetConditionQueryResult> conditions, Long basisPetId) {
        PetConditionQueryResult condition = basisPetId == null ? null : conditions.get(basisPetId);
        return condition == null ? PetConditionQueryResult.unknown() : condition;
    }

    private static boolean isKnown(PetConditionQueryResult pet) {
        return pet.sizeType() != null || pet.heatSensitive() || pet.coldSensitive()
            || pet.noiseSensitive() || pet.breed() != null;
    }

    /**
     * 대표 장소 요약을 한 번만 조회한다 — 좌표가 필요한 곳이 골든타임 한 자리뿐이다.
     * 원천에서 사라진(delisted) 장소는 요약이 아예 오지 않고, 그 항목은 일정에 그대로 남는다.
     */
    private Optional<PlanPlaceSummaryQueryResult> findSummary(Optional<PlanItem> representative) {
        return representative
            .map(PlanItem::targetId)
            .flatMap(placeId -> planPlaceLookupPort.findSummaries(List.of(placeId)).stream().findFirst());
    }

    /**
     * 특보 조회. <b>실패를 "없음" 으로 접지 않는다</b> — 예외를 잡아 사유로 바꾸고,
     * 특보가 정말 없을 때는 사유를 비운다.
     */
    private Warning loadWarning(Plan plan, LocalDate date) {
        try {
            return new Warning(
                weatherWarningQueryPort.findActiveWarning().map(this::toWarningInfo).orElse(null), null);
        } catch (PlanException exception) {
            log.warn("Weather warning lookup failed planId={} date={} errorCode={}",
                plan.id(), date, exception.getErrorCode().getCode());
            return new Warning(null, PlanBriefingWarningUnavailableReason.LOOKUP_FAILED);
        }
    }

    /** 골든타임 조회. 붙이지 못한 이유를 셋으로 가른다 — 장소 없음 / 좌표 없음 / 조회 실패. */
    private Golden loadWalkTimes(
        Plan plan,
        Optional<PlanItem> representative,
        Optional<PlanPlaceSummaryQueryResult> representativePlace,
        PetConditionQueryResult condition
    ) {
        if (representative.isEmpty()) {
            return new Golden(null, PlanBriefingWalkTimesUnavailableReason.NO_PLACE_ITEM);
        }
        // delisted 라 요약이 안 왔거나, 남아 있어도 원천이 좌표를 주지 않은 장소가 있다.
        if (representativePlace.isEmpty() || !representativePlace.get().hasPoint()) {
            log.info("Plan briefing skips walk times without point planId={} placeId={}",
                plan.id(), representative.get().targetId());
            return new Golden(null, PlanBriefingWalkTimesUnavailableReason.NO_PLACE_POINT);
        }

        PlanPlaceSummaryQueryResult place = representativePlace.get();
        return walkTimesQueryPort.findWalkTimes(place.lat(), place.lng(), condition)
            .map(result -> new Golden(toWalkTimesInfo(result), null))
            .orElseGet(() -> new Golden(null, PlanBriefingWalkTimesUnavailableReason.LOOKUP_FAILED));
    }

    private ScheduleInfo toScheduleInfo(
        List<PlanItem> dayItems,
        Optional<PlanItem> representative,
        Optional<PlanPlaceSummaryQueryResult> representativePlace
    ) {
        return ScheduleInfo.builder()
            .itemCount(dayItems.size())
            .visitedCount((int) dayItems.stream().filter(PlanItem::visited).count())
            .firstItem(dayItems.isEmpty() ? null : toItemBrief(dayItems.get(0)))
            .lastItem(dayItems.isEmpty() ? null : toItemBrief(dayItems.get(dayItems.size() - 1)))
            .representativePlaceId(representative.map(PlanItem::targetId).orElse(null))
            .representativePlaceTitle(representative.map(PlanItem::title).orElse(null))
            .representativeLat(representativePlace.map(PlanPlaceSummaryQueryResult::lat).orElse(null))
            .representativeLng(representativePlace.map(PlanPlaceSummaryQueryResult::lng).orElse(null))
            .build();
    }

    private ItemBriefInfo toItemBrief(PlanItem item) {
        return ItemBriefInfo.builder()
            .planItemId(item.id())
            .sequence(item.sequence())
            .itemType(item.itemType())
            .title(item.title())
            .startTime(item.startTime())
            .visited(item.visited())
            .build();
    }

    /**
     * out-port 계약(QueryResult)을 application 표현으로 접는다. Presenter 까지 QueryResult 가
     * 번지면 tour-service 응답 스키마 변화가 화면 조립 코드를 직접 흔든다 (architecture-guide §4).
     */
    private WeatherWarningInfo toWarningInfo(WeatherWarningQueryResult result) {
        return WeatherWarningInfo.builder()
            .typeCode(result.typeCode())
            .typeName(result.typeName())
            .typeDescription(result.typeDescription())
            .levelCode(result.levelCode())
            .levelName(result.levelName())
            .levelDescription(result.levelDescription())
            // 경보 판정을 다시 세우지 않는다 — tour-service 가 준 값을 그대로 옮긴다 (#357).
            .recommendationSuppressed(result.recommendationSuppressed())
            .effectiveAt(result.effectiveAt())
            .build();
    }

    private WalkTimesInfo toWalkTimesInfo(WalkTimesQueryResult result) {
        return WalkTimesInfo.builder()
            .from(result.from())
            .forecastCoverageCode(result.forecastCoverageCode())
            .forecastCoverageName(result.forecastCoverageName())
            .forecastCoverageDescription(result.forecastCoverageDescription())
            .goldenStart(result.goldenStart())
            .goldenEnd(result.goldenEnd())
            .goldenLevelCode(result.goldenLevelCode())
            .goldenLevelName(result.goldenLevelName())
            .goldenLevelDescription(result.goldenLevelDescription())
            .goldenLevelScoreDescription(result.goldenLevelScoreDescription())
            .goldenWindowStatusCode(result.goldenWindowStatusCode())
            .goldenWindowStatusName(result.goldenWindowStatusName())
            .goldenWindowStatusDescription(result.goldenWindowStatusDescription())
            .petConditionApplied(result.petConditionApplied())
            .build();
    }

    /** 특보 조회 결과와 못 붙인 사유. 둘 다 null 이면 "발효 중인 특보 없음" 이다. */
    private record Warning(WeatherWarningInfo info, PlanBriefingWarningUnavailableReason unavailableReason) {

        static Warning notToday() {
            return new Warning(null, PlanBriefingWarningUnavailableReason.NOT_TODAY);
        }
    }

    /** 골든타임 조회 결과와 못 붙인 사유. */
    private record Golden(WalkTimesInfo info, PlanBriefingWalkTimesUnavailableReason unavailableReason) {

        static Golden notToday() {
            return new Golden(null, PlanBriefingWalkTimesUnavailableReason.NOT_TODAY);
        }
    }
}
