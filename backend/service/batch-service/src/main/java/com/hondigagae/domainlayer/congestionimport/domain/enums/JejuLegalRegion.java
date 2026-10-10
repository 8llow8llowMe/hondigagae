package com.hondigagae.domainlayer.congestionimport.domain.enums;

import java.util.List;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 제주 법정동 코드.
 *
 * <p><b>관광 areaCode 와 다른 체계다.</b> 관광 API 는 제주를 39, 시군구를 3/4 로 부르지만
 * 통계 3종(집중률/방문자수/연관 관광지)은 법정동 코드(제주=50, 제주시=50110, 서귀포시=50130)를 쓴다.
 * 두 체계를 섞으면 조용히 0건이 오므로 상수로 못박는다 (data-api-analysis.md §8).
 */
@Getter
@RequiredArgsConstructor
public enum JejuLegalRegion {

    JEJU_SI("50", "50110", "제주시"),
    SEOGWIPO_SI("50", "50130", "서귀포시");

    private final String areaCd;
    private final String signguCd;
    private final String displayName;

    public static List<JejuLegalRegion> all() {
        return List.of(values());
    }
}
