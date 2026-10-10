package com.hondigagae.shared.travel.plan;

import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 일정 항목의 종류. <b>{@code targetId} 가 어느 아이디 공간을 가리키는지</b>를 함께 정한다.
 *
 * <h2>왜 서비스 안이 아니라 여기 있는가</h2>
 *
 * 이 코드를 쓰는 서비스가 둘이다 — plan-service 가 저장하고, ai-service 가 초안에 실어 보낸다.
 * 초안 항목은 사용자가 그대로 담기 때문에 <b>ai-service 의 {@code itemType} 은 plan-service 의
 * 저장 규칙을 그대로 따라야 한다.</b>
 *
 * <p>전에는 ai-service 가 이것을 문자열과 주석("plan-service 의 PlanItemType 과 코드를 맞춘다")
 * 으로만 지켰고, 그래서 어긋났다. AI 초안이 {@code WALK} 항목에 {@code place.id} 를 실어 보냈고
 * 아무도 막지 않았다 — {@code WALK} 는 장소 검증에서 빠지도록 되어 있어 <b>틀린 아이디가
 * 조용히 저장됐다.</b> 지킬 규칙을 한쪽만 갖고 있으면 다른 쪽은 지킬 수 없다.
 *
 * <h2>아이디 공간</h2>
 *
 * <ul>
 *   <li>{@link #PLACE} · {@link #MEAL} · {@link #LODGING} — {@code targetId} 는 {@code place.id}</li>
 *   <li>{@link #WALK} — {@code targetId} 는 <b>{@code walk_course.id}</b>. 다른 표라 값이 겹쳐도
 *       뜻이 다르다</li>
 *   <li>{@link #MOVE} — 대상이 없다. {@code targetId} 는 null 이다</li>
 * </ul>
 */
@Getter
@RequiredArgsConstructor
public enum PlanItemType {

    PLACE("장소", "관광지·카페 등 방문 장소 항목입니다."),
    MEAL("식사", "식당 방문 항목입니다."),
    LODGING("숙박", "숙소 체크인/숙박 항목입니다."),
    WALK("산책", "산책 코스 항목입니다."),
    MOVE("이동", "이동 구간 항목입니다.");

    /**
     * {@code targetId} 가 {@code place.id} 를 가리키는 유형.
     *
     * <p><b>{@code WALK} 는 들어가지 않는다.</b> 그 {@code targetId} 는 {@code walk_course.id} 라
     * 장소로 조회하면 남의 아이디로 없는 장소를 찾게 된다. {@code MOVE} 는 대상이 없다.
     *
     * <p>이 집합을 쓰는 곳이 셋이다 — 저장 시 존재 검증(plan-service), 상세 응답의 장소 요약
     * 조회(plan-service), 그리고 AI 초안이 장소를 실을 수 있는 유형인지 판정(ai-service).
     * 각자 들고 있으면 한쪽만 고쳐질 자리다.
     */
    private static final Set<PlanItemType> PLACE_TARGETS = Set.of(PLACE, MEAL, LODGING);

    private final String displayName;
    private final String description;

    public boolean isPlaceTarget() {
        return PLACE_TARGETS.contains(this);
    }

    /**
     * 코드 문자열을 유형으로 읽는다. 모르는 값이면 비어 있다.
     *
     * <p>LLM 응답처럼 <b>믿을 수 없는 문자열</b>을 유형으로 옮기는 자리를 위한 것이다.
     * {@code valueOf} 는 그때 {@code IllegalArgumentException} 을 던지는데, 모델이 코드를
     * 조금 다르게 적었다고 초안 생성 전체를 실패시킬 이유는 없다.
     */
    public static Optional<PlanItemType> from(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        String normalized = code.trim().toUpperCase();
        return Arrays.stream(values())
            .filter(type -> type.name().equals(normalized))
            .findFirst();
    }
}
