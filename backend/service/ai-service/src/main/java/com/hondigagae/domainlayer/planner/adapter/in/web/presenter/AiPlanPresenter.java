package com.hondigagae.domainlayer.planner.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanDayItem;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanReasonItem;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanScheduleItem;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanDraftResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.PackingListResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import com.hondigagae.domainlayer.planner.application.info.PackingListInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanSubmissionInfo;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
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
        return AiPlanJobStatusResponse.builder()
            .jobId(info.jobId())
            .status(CodeNameDescriptionMetadata.of(status.name(), status.getDisplayName(), status.getDescription()))
            .planDraft(toDraftResponse(info.planDraft()))
            .errorCode(info.errorCode())
            .errorMessage(info.errorMessage())
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
