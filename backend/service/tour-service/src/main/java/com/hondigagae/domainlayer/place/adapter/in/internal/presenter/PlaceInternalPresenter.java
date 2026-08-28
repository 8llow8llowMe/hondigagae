package com.hondigagae.domainlayer.place.adapter.in.internal.presenter;

import com.hondigagae.domainlayer.place.adapter.in.internal.dto.PlaceCandidateInternalResponse;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PlaceInternalPresenter {

    public List<PlaceCandidateInternalResponse> toCandidateResponses(List<PlaceSummaryInfo> summaries) {
        return summaries.stream()
            .map(this::toCandidateResponse)
            .toList();
    }

    /** 프롬프트에 바로 실을 수 있게 enum 은 표시명으로 바꿔 준다. 없는 값은 null 유지 — 지어내지 않는다. */
    private PlaceCandidateInternalResponse toCandidateResponse(PlaceSummaryInfo info) {
        return PlaceCandidateInternalResponse.builder()
            .placeId(info.placeId())
            .title(info.title())
            .contentTypeName(info.contentType() == null ? null : info.contentType().getDisplayName())
            .addr(info.addr1())
            .petAllowanceName(info.petAllowanceType() == null ? null : info.petAllowanceType().getDisplayName())
            .allowedPetSizeName(info.allowedPetSize() == null ? null : info.allowedPetSize().getDisplayName())
            .maxPetWeightKg(info.maxPetWeightKg())
            .indoor(info.indoor())
            .sourceCategory(info.sourceCategory())
            .lat(info.lat() == null ? null : info.lat().doubleValue())
            .lng(info.lng() == null ? null : info.lng().doubleValue())
            .build();
    }
}
