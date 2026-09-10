package com.hondigagae.domainlayer.plan.application.port.out.query;

import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 발효 중인 기상특보 — 가장 무거운 한 건. 원천은 tour-service 다.
 *
 * <p>enum 대신 code/name/description 문자열을 들고 있는 이유는 이 서비스가 그 값을
 * <b>해석하지 않고 전달만 하기 때문</b>이다. 특보 종류·단계가 늘어도 이쪽이 먼저 깨지지 않는다
 * ({@link PetConditionQueryResult} 와 같은 결정).
 *
 * <p>{@code recommendationSuppressed} 는 tour-service 가 준다. "경보면 추천을 막는다" 는 판정을
 * 여기서 {@code levelCode.equals("WARNING")} 으로 다시 세우면 같은 규칙이 두 서비스에 생기고,
 * 한쪽만 고쳐지면 같은 특보에 서로 다른 말을 하는 화면이 나온다 (#357).
 */
@Builder
public record WeatherWarningQueryResult(
    String typeCode,
    String typeName,
    String typeDescription,
    String levelCode,
    String levelName,
    String levelDescription,
    boolean recommendationSuppressed,
    LocalDateTime effectiveAt
) {

}
