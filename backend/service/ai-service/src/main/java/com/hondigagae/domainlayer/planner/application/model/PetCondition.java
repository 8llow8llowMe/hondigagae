package com.hondigagae.domainlayer.planner.application.model;

import lombok.Builder;

/**
 * 일정 생성에 쓰는 반려견 특성. 프롬프트에 그대로 실리므로 값은 사람이 읽는 한국어 표현이다.
 *
 * <p>이 값이 없으면 "반려견 맞춤"이 성립하지 않는다 — 크기를 모르면 소형견 전용 카페를
 * 대형견 일정에 넣고, 더위 민감을 모르면 한여름 야외 일정을 짠다. 그래서 조회 실패 시에도
 * 잡은 계속 돌리되(auth 장애가 일정 생성 불가로 번지면 안 된다), 특성이 빠졌다는 사실을
 * 로그로 남긴다.
 */
@Builder
public record PetCondition(
    String breed,
    String sizeName,
    // 사람이 읽는 kg 표기 ("3.5"). 없으면 null — 지어 적지 않는다.
    String weightText,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    String activityName,
    boolean walkPreferred
) {
}
