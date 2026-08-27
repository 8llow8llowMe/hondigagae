package com.hondigagae.domainlayer.insight.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 명칭 매칭 방식.
 *
 * <p>{@link #UNMATCHED} 가 이 enum 의 존재 이유다. 매칭에 실패한 명칭을 행 없이 버리면
 * "아직 안 해 본 것"과 "해 봤지만 못 찾은 것"이 구분되지 않아, 커버리지가 얼마나 되는지
 * 아무도 모르게 된다.
 */
@Getter
@RequiredArgsConstructor
public enum NameMatchType {

    EXACT("완전일치", "원천 명칭이 장소명과 그대로 일치했습니다."),
    NORMALIZED("정규화 일치", "괄호/공백/기호를 제거한 뒤 일치했습니다."),
    MANUAL("수동 확인", "사람이 확인해 연결했습니다."),
    UNMATCHED("매칭 실패", "대응하는 장소를 찾지 못했습니다.");

    private final String displayName;
    private final String description;

    public boolean isMatched() {
        return this != UNMATCHED;
    }
}
