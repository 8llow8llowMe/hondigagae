package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanPackingDetailItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanPackingListResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanPackingInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanPackingItemInfo;
import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import org.springframework.stereotype.Component;

@Component
public class PlanPackingPresenter {

    public PlanPackingListResponse toListResponse(PlanPackingInfo info) {
        return PlanPackingListResponse.builder()
            .planId(String.valueOf(info.planId()))
            .items(info.items().stream().map(this::toDetailItem).toList())
            .totalCount(info.totalCount())
            .checkedCount(info.checkedCount())
            .generatedAt(info.generatedAt())
            .build();
    }

    private PlanPackingDetailItem toDetailItem(PlanPackingItemInfo info) {
        return PlanPackingDetailItem.builder()
            // Snowflake 아이디는 문자열로 내린다 (coding-conventions §7-1).
            .packingItemId(String.valueOf(info.packingItemId()))
            .category(info.category())
            .name(info.name())
            .reason(info.reason())
            .source(toSourceMetadata(info.source()))
            .checked(info.checked())
            .sortOrder(info.sortOrder())
            .build();
    }

    private CodeNameDescriptionMetadata toSourceMetadata(PackingItemSource source) {
        return CodeNameDescriptionMetadata.of(source.name(), source.getDisplayName(), source.getDescription());
    }
}
