package com.hondigagae.domainlayer.dining.adapter.in.web.presenter;

import com.hondigagae.domainlayer.dining.adapter.in.web.dto.item.NearbyDiningItem;
import com.hondigagae.domainlayer.dining.adapter.in.web.dto.response.NearbyDiningResponse;
import com.hondigagae.domainlayer.dining.application.info.NearbyDiningInfo;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class NearbyDiningPresenter {

    /** 제공처 표기. 응답에 반드시 실어 출처를 드러낸다. */
    private static final String PROVIDER_NAME = "카카오맵";

    public NearbyDiningResponse toResponse(List<NearbyDiningInfo> infos) {
        List<NearbyDiningItem> items = infos.stream()
            .map(this::toItem)
            .toList();

        return NearbyDiningResponse.builder()
            .places(items)
            .totalCount(items.size())
            .providerName(PROVIDER_NAME)
            // 지도 검색 결과일 뿐 반려견 동반 여부가 확인된 데이터가 아니다. 항상 false 로 내려 화면이 단정하지 않게 한다.
            .petPolicyVerified(false)
            .build();
    }

    private NearbyDiningItem toItem(NearbyDiningInfo info) {
        return NearbyDiningItem.builder()
            .name(info.name())
            .address(info.address())
            .lat(info.lat())
            .lng(info.lng())
            .phone(info.phone())
            .category(info.category())
            .detailUrl(info.detailUrl())
            .distanceMeters(info.distanceMeters())
            .build();
    }
}
