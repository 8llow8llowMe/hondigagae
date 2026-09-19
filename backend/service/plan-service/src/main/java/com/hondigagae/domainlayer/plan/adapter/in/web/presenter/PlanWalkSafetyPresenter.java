package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemWalkSafetyItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWalkSafetyResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanWalkSafetyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWalkSafetyInfo.PlanItemWalkSafetyInfo;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PlanWalkSafetyPresenter {

    public PlanWalkSafetyResponse toResponse(PlanWalkSafetyInfo info) {
        return PlanWalkSafetyResponse.builder()
            .planId(String.valueOf(info.planId()))
            .planTitle(info.planTitle())
            .petIds(info.petIds() == null ? List.of() : info.petIds().stream().map(String::valueOf).toList())
            .items(info.items().stream().map(this::toItem).toList())
            .build();
    }

    private PlanItemWalkSafetyItem toItem(PlanItemWalkSafetyInfo item) {
        return PlanItemWalkSafetyItem.builder()
            .planItemId(String.valueOf(item.planItemId()))
            .day(item.day())
            .date(item.date())
            .sequence(item.sequence())
            .startTime(item.startTime())
            .title(item.title())
            .placeId(item.placeId() == null ? null : String.valueOf(item.placeId()))
            .placeTitle(item.placeTitle())
            .targetDateTime(item.targetDateTime())
            .basisPetId(item.basisPetId() == null ? null : String.valueOf(item.basisPetId()))
            // Wrapper 를 그대로 옮긴다 — 묻지 않은 줄의 null 을 false 로 접으면 하지 않은 판정을
            // 했다고 말하게 된다.
            .petConditionApplied(item.petConditionApplied())
            .walkSafetyLevel(toLevelMetadata(item))
            .estimatedPavementCelsius(item.estimatedPavementCelsius())
            .feelsLikeCelsius(item.feelsLikeCelsius())
            .temperature(item.temperature())
            .saferWindowStart(item.saferWindowStart())
            .saferWindowEnd(item.saferWindowEnd())
            // 코드와 문장을 함께 내린다. 문장만 주면 프론트가 사유별로 다르게 그릴 수 없고,
            // 코드만 주면 문구가 둘로 갈린다 (일자 날씨와 같은 규칙).
            .unavailableReasonCode(item.unavailableReason() == null ? null : item.unavailableReason().name())
            .unavailableReason(item.unavailableReason() == null
                ? null : item.unavailableReason().getDescription())
            .build();
    }

    private ScoreMetricMetadata toLevelMetadata(PlanItemWalkSafetyInfo item) {
        if (item.levelCode() == null) {
            return null;
        }
        // scoreDescription 은 원천(WalkSafetyLevel)이 주는 값을 그대로 옮긴다 (#717).
        return ScoreMetricMetadata.of(
            item.levelCode(), item.levelName(), item.levelDescription(), item.levelScoreDescription());
    }
}
