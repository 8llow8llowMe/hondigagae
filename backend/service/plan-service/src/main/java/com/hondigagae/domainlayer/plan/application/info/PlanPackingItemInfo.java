package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import lombok.Builder;

@Builder
public record PlanPackingItemInfo(
    long packingItemId,
    String category,
    String name,
    String reason,
    PackingItemSource source,
    boolean checked,
    int sortOrder
) {

}
