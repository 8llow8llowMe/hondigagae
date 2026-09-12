package com.hondigagae.domainlayer.planner.application.model;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 반려견 생애 단계. <b>몇 살부터 노령견인지는 서비스가 정한다</b> (#493).
 *
 * <p>전에는 프롬프트가 나이와 무관하게 "노령견은 이동과 도보를 줄이고, 어린 반려견은 낯선 환경
 * 연속 배치를 피할 것" 을 <b>모든 반려견에게</b> 붙였다. 모델이 그 낱말을 그대로 끌어다 써서
 * <b>6살 말티즈의 초안 근거에 "노령견의 피로를 최소화한다" 가 나왔다</b> — 사실이 아닌 말이
 * 사용자에게 그대로 나간 것이다. 단계를 값으로 정해 넘기면 모델이 고를 여지가 없다.
 *
 * <p><b>기준은 7년(84개월) 하나다.</b> 수의학적으로는 소형견이 더 늦게(10~12년), 대형견이 더
 * 일찍(6~7년) 노령에 접어들지만, 견종별 표를 갖고 있지 않은 지금 크기로 기준을 나누면 근거 없는
 * 숫자를 하나 더 만드는 일이 된다. 국내 반려 서비스가 흔히 쓰는 7세를 쓰고, 크기·견종을 반영한
 * 세분화는 그 표가 생겼을 때 한다.
 *
 * <p><b>나이를 모르면 단계도 없다</b>({@code null}). {@code ageText} 가 null 일 때 억지로
 * {@link #ADULT} 로 접지 않는다 — 모르는 것을 성견이라고 단정하면 처음 문제와 같은 꼴이 된다.
 */
@Getter
@RequiredArgsConstructor
public enum PetLifeStage {

    /** 12개월 미만. */
    PUPPY("자견", "낯선 환경을 연달아 배치하지 말 것"),

    /** 12개월 이상 84개월 미만. <b>활동 강도에 따로 걸 제약이 없다.</b> */
    ADULT("성견", null),

    /** 84개월(7년) 이상. */
    SENIOR("노령견", "이동과 도보를 줄이고 휴식을 자주 둘 것");

    private static final int PUPPY_MAX_MONTHS_EXCLUSIVE = 12;
    private static final int SENIOR_MIN_MONTHS = 84;

    private final String displayName;

    /** 이 단계에서 일정에 걸 제약. 없으면 null — 프롬프트에 빈 괄호를 남기지 않는다. */
    private final String planningGuidance;

    /** @param ageMonths 개월 수. null 이면 null 을 그대로 돌려준다 */
    public static PetLifeStage fromAgeMonths(Integer ageMonths) {
        if (ageMonths == null) {
            return null;
        }
        if (ageMonths < PUPPY_MAX_MONTHS_EXCLUSIVE) {
            return PUPPY;
        }
        return ageMonths < SENIOR_MIN_MONTHS ? ADULT : SENIOR;
    }
}
