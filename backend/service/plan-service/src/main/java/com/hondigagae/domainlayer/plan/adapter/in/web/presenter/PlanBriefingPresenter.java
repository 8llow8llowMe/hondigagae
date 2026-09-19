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
import com.hondigagae.shared.travel.plan.PlanItemType;
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
            // 코드와 문장은 항상 짝으로 나간다 — 화면이 사유별로 다르게 그리려면 코드가,
            // 그대로 안내하려면 문장이 필요하다. 문장의 출처는 enum 하나다 (#716).
            .weatherWarningUnavailableReasonCode(info.weatherWarningUnavailableReason() == null
                ? null : info.weatherWarningUnavailableReason().name())
            .weatherWarningUnavailableReason(info.weatherWarningUnavailableReason() == null
                ? null : info.weatherWarningUnavailableReason().getDescription())
            .walkTimes(toWalkTimesItem(info.walkTimes(), schedule))
            .walkTimesUnavailableReasonCode(info.walkTimesUnavailableReason() == null
                ? null : info.walkTimesUnavailableReason().name())
            .walkTimesUnavailableReason(info.walkTimesUnavailableReason() == null
                ? null : info.walkTimesUnavailableReason().getDescription())
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
            // 골든타임이 null 인 날에도 좌표는 나간다 — 화면이 지도와 시간대별 곡선 조회를
            // 부를 수 있어야 한다. 좌표를 모르는 날은 null 이고, 0.0 으로 접지 않는다 (#716).
            .representativeLat(schedule.representativeLat())
            .representativeLng(schedule.representativeLng())
            .build();
    }

    private PlanBriefingItemSummaryItem toItemSummary(ItemBriefInfo item) {
        if (item == null) {
            return null;
        }
        PlanItemType itemType = item.itemType();
        return PlanBriefingItemSummaryItem.builder()
            .planItemId(String.valueOf(item.planItemId()))
            .sequence(item.sequence())
            // 일정 상세 응답(PlanItemDetailItem)과 같은 모양으로 내린다 — 두 화면이 같은 값을
            // 다른 모양으로 받으면 프론트가 한국어 매핑 테이블을 따로 만들게 된다 (#716).
            // 조립식은 PlanPresenter·PlanShareLinkPresenter 와 같다. PlanItemType 은 plan-service
            // 밖(shared-travel)에 있어 CodeNameDescribable 을 붙이러 가지 않는다.
            .itemType(itemType == null ? null
                : CodeNameDescriptionMetadata.of(itemType.name(), itemType.getDisplayName(), itemType.getDescription()))
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
