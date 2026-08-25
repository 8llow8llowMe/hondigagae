package com.hondigagae.domainlayer.planner.application.exception;

public final class AiPlanValidationMessage {

    public static final String AREA_CODE_REQUIRED = "AIPLAN_101:여행 지역 코드는 필수입니다.";
    public static final String START_DATE_REQUIRED = "AIPLAN_102:여행 시작일은 필수입니다.";
    public static final String END_DATE_REQUIRED = "AIPLAN_103:여행 종료일은 필수입니다.";
    public static final String PET_ID_REQUIRED = "AIPLAN_104:반려견 식별자는 필수입니다.";
    public static final String PET_ID_POSITIVE = "AIPLAN_105:반려견 식별자는 양수여야 합니다.";
    public static final String BUDGET_POSITIVE = "AIPLAN_106:예산은 0보다 커야 합니다.";
    public static final String REQUEST_NOTE_LENGTH_INVALID = "AIPLAN_107:요청 메모는 500자 이하만 가능합니다.";

    private AiPlanValidationMessage() {
    }
}
