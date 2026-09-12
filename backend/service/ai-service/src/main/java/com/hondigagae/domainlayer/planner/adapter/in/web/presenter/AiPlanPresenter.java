package com.hondigagae.domainlayer.planner.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanDayItem;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanReasonItem;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanScheduleItem;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanDraftResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.PackingListResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobConditionsResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.application.info.AiPlanConditionsInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import com.hondigagae.domainlayer.planner.application.info.PackingListInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanSubmissionInfo;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanSubmissionStatus;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class AiPlanPresenter {

    public AiPlanSubmitResponse toSubmitResponse(AiPlanSubmissionInfo info) {
        AiPlanSubmissionStatus status = info.submissionStatus();
        return AiPlanSubmitResponse.builder()
            .submissionStatus(CodeNameDescriptionMetadata.of(status.name(), status.getDisplayName(), status.getDescription()))
            .jobId(info.jobId())
            .build();
    }

    public AiPlanJobStatusResponse toJobStatusResponse(AiPlanJobInfo info) {
        AiPlanJobStatus status = info.status();
        AiPlanJobStep step = info.step();
        return AiPlanJobStatusResponse.builder()
            .jobId(info.jobId())
            .status(CodeNameDescriptionMetadata.of(status.name(), status.getDisplayName(), status.getDescription()))
            // 아직 시작하지 않았으면(PENDING) 단계가 없다. 0 이나 1 로 채우면 화면이 시작한 것으로 그린다.
            .step(step == null ? null : step.toMetadata())
            .stepOrder(step == null ? null : step.order())
            .totalSteps(AiPlanJobStep.total())
            .conditions(toConditionsResponse(info.conditions()))
            .planDraft(toDraftResponse(info.planDraft()))
            .errorCode(info.errorCode())
            .errorMessage(info.errorMessage())
            .build();
    }

    /**
     * 생성 조건을 응답 모양으로. 초안과 달리 <b>상태를 가리지 않고</b> 내린다 — 대기 중인
     * 작업도 "무엇을 만들고 있는지" 를 화면이 그대로 보여 줄 수 있어야 한다.
     *
     * <p>반려견 식별자는 여기서 문자열로 바꾼다. Snowflake 라 숫자로 내리면 자바스크립트가
     * 조용히 반올림한다 (coding-conventions §7-1). 경계는 Presenter 다.
     */
    private AiPlanJobConditionsResponse toConditionsResponse(AiPlanConditionsInfo conditions) {
        if (conditions == null) {
            return null;
        }
        List<Long> petIds = conditions.petIds() == null ? List.of() : conditions.petIds();
        return AiPlanJobConditionsResponse.builder()
            .areaCode(conditions.areaCode())
            .sigunguCode(conditions.sigunguCode())
            .startDate(conditions.startDate())
            .endDate(conditions.endDate())
            .petIds(petIds.stream().map(String::valueOf).toList())
            .budget(conditions.budget())
            .requestNote(conditions.requestNote())
            .build();
    }

    /**
     * 완료 전(PENDING/RUNNING)이나 실패 상태에서는 초안이 없다. 상태별 nullable 페이로드 규약을 따른다.
     */
    private AiPlanDraftResponse toDraftResponse(AiPlanDraftInfo draft) {
        if (draft == null) {
            return null;
        }
        return AiPlanDraftResponse.builder()
            .days(toDayItems(draft.days()))
            .reasons(toReasonItems(draft.reasons()))
            .build();
    }

    private List<AiPlanDayItem> toDayItems(List<AiPlanDraftInfo.AiPlanDayInfo> days) {
        if (days == null) {
            return List.of();
        }
        return days.stream()
            .map(day -> AiPlanDayItem.builder()
                .day(day.day())
                .items(toScheduleItems(day.items()))
                .build())
            .toList();
    }

    private List<AiPlanScheduleItem> toScheduleItems(List<AiPlanDraftInfo.AiPlanItemInfo> items) {
        if (items == null) {
            return List.of();
        }
        return items.stream()
            .map(item -> AiPlanScheduleItem.builder()
                .itemType(item.itemType().name())
                .placeId(item.placeId() == null ? null : String.valueOf(item.placeId()))
                .title(item.title())
                .note(item.note())
                .build())
            .toList();
    }

    private List<AiPlanReasonItem> toReasonItems(List<AiPlanDraftInfo.AiPlanReasonInfo> reasons) {
        if (reasons == null) {
            return List.of();
        }
        return reasons.stream()
            .map(reason -> AiPlanReasonItem.builder()
                .code(reason.code())
                .name(reason.name())
                .description(reason.description())
                .build())
            .toList();
    }
    public PackingListResponse toPackingListResponse(long planId, PackingListInfo info) {
        java.util.List<PackingListResponse.PackingListItem> items = info.items().stream()
            .map(item -> PackingListResponse.PackingListItem.builder()
                .category(item.category())
                .name(item.name())
                .reason(item.reason())
                .build())
            .toList();
        return PackingListResponse.builder()
            .planId(String.valueOf(planId))
            .items(items)
            .totalCount(items.size())
            .build();
    }
}
