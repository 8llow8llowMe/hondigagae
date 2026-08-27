package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.domainlayer.placeimport.domain.enums.EmergencyFacilityTypeCode;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 문화정보원 CSV 의 긴급 시설(동물병원·동물약국) 한 행.
 *
 * <p>여행 장소가 아니라 급할 때 찾는 곳이라 place 가 아닌 별도 테이블에 적재한다.
 *
 * <p>이름·주소·좌표가 통째로 같은 중복이 많은 원천이다. 제주 기준 841행이
 * {@code sourceKey}(시설명+주소 해시) upsert 로 214곳으로 정리된다
 * (동물병원 225 -> 86, 동물약국 616 -> 128).
 *
 * <p>데이터 품질이 종류마다 다르다 — 운영시간을 동물약국은 98%(125/128)가 주는데
 * 동물병원은 절반(114/225)만 준다. 그래서 null 을 허용하고, 조회 응답에서
 * "휴무"가 아니라 "정보 없음"으로 드러낸다.
 */
@Builder
public record ImportedEmergencyFacility(
    String sourceKey,
    EmergencyFacilityTypeCode facilityType,
    String name,
    String addr,
    String sigunguCode,
    BigDecimal lat,
    BigDecimal lng,
    String tel,
    String operatingHours,
    // 구조화된 주간 스케줄(WeeklySchedule spec). 원문을 풀 수 없으면 null — 판정을 "모름"으로 남긴다.
    String weeklyHoursSpec,
    String restDate,
    boolean open24,
    LocalDateTime sourceModifiedAt
) {

    public long facilityId() {
        // place 와 다른 테이블이지만 같은 해시 공간을 쓰므로 접두어로 갈라 둔다.
        return PlaceIdFactory.create(PlaceSourceType.CULTURE_PORTAL,
            "EMERGENCY|" + facilityType.name() + "|" + sourceKey);
    }
}
