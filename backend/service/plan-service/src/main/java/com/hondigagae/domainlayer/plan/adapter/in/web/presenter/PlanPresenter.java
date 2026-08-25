package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemDetailItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.persistence.dto.SliceResponse;
import java.util.List;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Component;

@Component
public class PlanPresenter {

    public PlanDetailResponse toDetailResponse(PlanInfo info) {
        List<PlanItemDetailItem> items = info.items().stream()
            .map(this::toItemDetail)
            .toList();

        return PlanDetailResponse.builder()
            .planId(String.valueOf(info.planId()))
            .petId(String.valueOf(info.petId()))
            .areaCode(info.areaCode())
            .sigunguCode(info.sigunguCode())
            .title(info.title())
            .startDate(info.startDate())
            .endDate(info.endDate())
            .budget(info.budget())
            .status(toStatusMetadata(info.status()))
            .totalDays(info.totalDays())
            .items(items)
            .build();
    }

    public SliceResponse<PlanSummaryItem> toSliceResponse(Slice<PlanSummaryInfo> slice) {
        return SliceResponse.of(slice.map(this::toSummaryItem));
    }

    private PlanSummaryItem toSummaryItem(PlanSummaryInfo info) {
        return PlanSummaryItem.builder()
            .planId(String.valueOf(info.planId()))
            .petId(String.valueOf(info.petId()))
            .areaCode(info.areaCode())
            .title(info.title())
            .startDate(info.startDate())
            .endDate(info.endDate())
            .status(toStatusMetadata(info.status()))
            .build();
    }

    private PlanItemDetailItem toItemDetail(PlanItemInfo info) {
        PlanItemType itemType = info.itemType();
        return PlanItemDetailItem.builder()
            .planItemId(String.valueOf(info.planItemId()))
            .day(info.day())
            .sequence(info.sequence())
            .itemType(CodeNameDescriptionMetadata.of(itemType.name(), itemType.getDisplayName(), itemType.getDescription()))
            .targetId(info.targetId())
            .title(info.title())
            .memo(info.memo())
            .startTime(info.startTime())
            .build();
    }

    private CodeNameDescriptionMetadata toStatusMetadata(PlanStatus status) {
        return CodeNameDescriptionMetadata.of(status.name(), status.getDisplayName(), status.getDescription());
    }
}
