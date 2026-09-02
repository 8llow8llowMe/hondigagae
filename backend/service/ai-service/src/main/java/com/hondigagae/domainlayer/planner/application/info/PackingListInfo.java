package com.hondigagae.domainlayer.planner.application.info;

import com.hondigagae.domainlayer.planner.domain.model.PackingList;
import java.util.List;
import lombok.Builder;

/**
 * 준비물 목록의 application 표현. Presenter 가 응답으로 옮긴다.
 */
@Builder
public record PackingListInfo(
    List<PackingItemInfo> items
) {

    public static PackingListInfo from(PackingList packingList) {
        List<PackingItemInfo> items = packingList.safeItems().stream()
            .map(item -> PackingItemInfo.builder()
                .category(item.category())
                .name(item.name())
                .reason(item.reason())
                .build())
            .toList();
        return PackingListInfo.builder().items(items).build();
    }

    @Builder
    public record PackingItemInfo(String category, String name, String reason) {

    }
}
