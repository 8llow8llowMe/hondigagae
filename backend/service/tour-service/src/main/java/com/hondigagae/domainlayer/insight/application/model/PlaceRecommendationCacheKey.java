package com.hondigagae.domainlayer.insight.application.model;

import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.time.LocalDate;
import lombok.Builder;

/**
 * 장소 추천 결과 캐시를 가르는 값 (#1368). 결과를 바꾸는 입력 전부다 — 하나라도 빠지면 다른 조건의 결과를 돌려준다.
 *
 * @param today   기준 일자가 오늘인지. 같은 날짜라도 어제 밤에 "내일" 로 계산한 결과는 특보도 "오늘" 문구도 없어서
 *                자정을 넘긴 뒤 "오늘" 결과로 쓰면 안 된다
 * @param warning 판정에 쓴 특보(오늘일 때만). 특보가 바뀌면 키가 바뀌어 결과가 특보 캐시보다 낡지 않는다
 */
@Builder
public record PlaceRecommendationCacheKey(
    LocalDate targetDate,
    boolean today,
    WeatherWarning warning,
    PetCondition petCondition,
    int limit
) {

}
