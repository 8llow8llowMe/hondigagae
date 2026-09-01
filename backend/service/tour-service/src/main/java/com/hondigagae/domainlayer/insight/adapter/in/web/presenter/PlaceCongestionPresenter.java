package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.DailyCongestionItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceCongestionResponse;
import com.hondigagae.domainlayer.insight.application.info.PlaceCongestionInfo;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import org.springframework.stereotype.Component;

@Component
public class PlaceCongestionPresenter {

    public PlaceCongestionResponse toResponse(PlaceCongestionInfo info) {
        return PlaceCongestionResponse.builder()
            // Snowflake 아이디는 문자열로 내린다. long 그대로 보내면 JS 가 조용히 절삭한다.
            .placeId(String.valueOf(info.placeId()))
            .fromDate(info.fromDate())
            .toDate(info.toDate())
            .dailyCongestions(info.snapshots().stream().map(this::toItem).toList())
            .build();
    }

    private DailyCongestionItem toItem(CongestionSnapshot snapshot) {
        return DailyCongestionItem.builder()
            .date(snapshot.date())
            .level(snapshot.level().toMetadata())
            .concentrationRate(snapshot.concentrationRate())
            .build();
    }
}
