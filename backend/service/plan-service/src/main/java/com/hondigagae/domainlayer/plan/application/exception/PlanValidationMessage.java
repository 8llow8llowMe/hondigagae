package com.hondigagae.domainlayer.plan.application.exception;

public final class PlanValidationMessage {

    public static final String PET_ID_REQUIRED = "PLAN_101:반려견 아이디는 필수입니다.";
    public static final String AREA_CODE_REQUIRED = "PLAN_102:지역 코드는 필수입니다.";
    public static final String TITLE_REQUIRED = "PLAN_103:일정 제목은 필수입니다.";
    public static final String TITLE_LENGTH_INVALID = "PLAN_104:일정 제목은 60자 이하만 가능합니다.";
    public static final String START_DATE_REQUIRED = "PLAN_105:여행 시작일은 필수입니다.";
    public static final String END_DATE_REQUIRED = "PLAN_106:여행 종료일은 필수입니다.";
    public static final String BUDGET_NEGATIVE_INVALID = "PLAN_107:예산은 0 이상이어야 합니다.";
    public static final String ITEM_TYPE_REQUIRED = "PLAN_108:일정 항목 유형은 필수입니다.";
    public static final String ITEM_TITLE_REQUIRED = "PLAN_109:일정 항목 이름은 필수입니다.";
    public static final String ITEM_TITLE_LENGTH_INVALID = "PLAN_110:일정 항목 이름은 100자 이하만 가능합니다.";
    public static final String ITEM_DAY_MIN_INVALID = "PLAN_111:일차는 1 이상이어야 합니다.";
    public static final String MEMO_LENGTH_INVALID = "PLAN_112:메모는 500자 이하만 가능합니다.";
    public static final String SIZE_RANGE_INVALID = "PLAN_113:조회 개수는 1 이상 50 이하만 가능합니다.";

    private PlanValidationMessage() {
    }
}
