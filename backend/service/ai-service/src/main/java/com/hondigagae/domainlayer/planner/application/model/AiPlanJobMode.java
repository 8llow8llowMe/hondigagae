package com.hondigagae.domainlayer.planner.application.model;

import java.util.Locale;

/**
 * 일정 생성 잡이 무엇을 짜는지 (#985). 단계별 소요를 이 구분으로 나눠 본다.
 *
 * <p>전체 생성과 하루 재생성은 워커의 같은 경로를 지나지만 프롬프트와 후보 규모가 달라
 * 단계 길이가 다르다. 한 분포로 섞으면 "재생성은 왜 느린가" 에 답할 수 없다.
 */
public enum AiPlanJobMode {

    /** 여행 기간 전체를 짠다. */
    FULL,

    /** 기존 일정의 하루만 다시 짠다 ({@code regenerateDay} 가 있는 잡). */
    REGENERATE;

    public static AiPlanJobMode of(Integer regenerateDay) {
        return regenerateDay == null ? FULL : REGENERATE;
    }

    /** 로그·지표 태그 값. 소문자로 적는다 ({@code mode=full}). */
    public String tagValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
