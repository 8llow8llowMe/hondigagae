package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanBriefingItemSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanBriefingScheduleItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanBriefingWalkTimesItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanBriefingWeatherWarningItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanBriefingResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.ItemBriefInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.ScheduleInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.WalkTimesInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.WeatherWarningInfo;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 여행 브리핑 {@code Info -> Response}.
 *
 * <p>날씨 하루치는 {@link PlanWeatherPresenter#toDayItem} 을 그대로 쓴다 — 일정 날씨 브리핑과
 * 같은 DTO 를 내려 프론트가 두 화면에서 같은 컴포넌트를 쓰게 한다.
 */
@Component
@RequiredArgsConstructor
public class PlanBriefingPresenter {

    private final PlanWeatherPresenter planWeatherPresenter;

    public PlanBriefingResponse toResponse(PlanBriefingInfo info) {
        ScheduleInfo schedule = info.schedule();
        return PlanBriefingResponse.builder()
            .planId(String.valueOf(info.planId()))
            .planTitle(info.planTitle())
            .day(info.day())
            .date(info.date())
            .today(info.today())
            .petIds(info.petIds() == null ? List.of() : info.petIds().stream().map(String::valueOf).toList())
            .basisPetId(info.basisPetId() == null ? null : String.valueOf(info.basisPetId()))
            .petConditionApplied(info.petConditionApplied())
            .schedule(toScheduleItem(schedule))
            .weather(info.weather() == null ? null : planWeatherPresenter.toDayItem(info.weather()))
            .weatherWarning(toWarningItem(info.weatherWarning()))
            .weatherWarningUnavailableReason(info.weatherWarningUnavailableReason())
            .walkTimes(toWalkTimesItem(info.walkTimes(), schedule))
            .walkTimesUnavailableReason(info.walkTimesUnavailableReason())
            .build();
    }

    private PlanBriefingScheduleItem toScheduleItem(ScheduleInfo schedule) {
        if (schedule == null) {
            return null;
        }
        return PlanBriefingScheduleItem.builder()
            .itemCount(schedule.itemCount())
            .visitedCount(schedule.visitedCount())
            .firstItem(toItemSummary(schedule.firstItem()))
            .lastItem(toItemSummary(schedule.lastItem()))
            .representativePlaceId(schedule.representativePlaceId() == null
                ? null : String.valueOf(schedule.representativePlaceId()))
            .representativePlaceTitle(schedule.representativePlaceTitle())
            .build();
    }

    private PlanBriefingItemSummaryItem toItemSummary(ItemBriefInfo item) {
        if (item == null) {
            return null;
        }
        return PlanBriefingItemSummaryItem.builder()
            .planItemId(String.valueOf(item.planItemId()))
            .sequence(item.sequence())
            // 기존 계약과 같게 enum 이름을 그대로 내보낸다 (coding-conventions §8-3).
            .itemType(item.itemType() == null ? null : item.itemType().name())
            .title(item.title())
            .startTime(item.startTime())
            .visited(item.visited())
            .build();
    }

    private PlanBriefingWeatherWarningItem toWarningItem(WeatherWarningInfo warning) {
        if (warning == null) {
            return null;
        }
        return PlanBriefingWeatherWarningItem.builder()
            .type(CodeNameDescriptionMetadata.of(warning.typeCode(), warning.typeName(), warning.typeDescription()))
            .level(CodeNameDescriptionMetadata.of(warning.levelCode(), warning.levelName(), warning.levelDescription()))
            .recommendationSuppressed(warning.recommendationSuppressed())
            .effectiveAt(warning.effectiveAt())
            .build();
    }

    /**
     * 좌표는 일정 요약의 대표 장소 좌표다 — 골든타임이 있다는 것은 그 좌표로 판정했다는 뜻이라
     * 같은 값을 화면이 곡선 조회에 다시 쓸 수 있게 함께 내린다.
     */
    private PlanBriefingWalkTimesItem toWalkTimesItem(WalkTimesInfo walkTimes, ScheduleInfo schedule) {
        if (walkTimes == null || schedule == null
            || schedule.representativeLat() == null || schedule.representativeLng() == null) {
            return null;
        }
        return PlanBriefingWalkTimesItem.builder()
            .lat(schedule.representativeLat())
            .lng(schedule.representativeLng())
            .from(walkTimes.from())
            .forecastCoverage(toMetadata(
                walkTimes.forecastCoverageCode(), walkTimes.forecastCoverageName(), walkTimes.forecastCoverageDescription()))
            .goldenStart(walkTimes.goldenStart())
            .goldenEnd(walkTimes.goldenEnd())
            .goldenLevel(walkTimes.goldenLevelCode() == null ? null : ScoreMetricMetadata.of(
                walkTimes.goldenLevelCode(), walkTimes.goldenLevelName(),
                walkTimes.goldenLevelDescription(), walkTimes.goldenLevelScoreDescription()))
            .goldenWindowStatus(toMetadata(
                walkTimes.goldenWindowStatusCode(), walkTimes.goldenWindowStatusName(), walkTimes.goldenWindowStatusDescription()))
            .petConditionApplied(walkTimes.petConditionApplied())
            .build();
    }

    private CodeNameDescriptionMetadata toMetadata(String code, String name, String description) {
        return code == null ? null : CodeNameDescriptionMetadata.of(code, name, description);
    }
}
