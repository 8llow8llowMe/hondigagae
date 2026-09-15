package com.hondigagae.domainlayer.plan.application.exception;

public final class PlanValidationMessage {

    // PLAN_101 은 petId 가 필수였을 때의 코드다. 다견 담기에서 petId 가 선택이 되면서 같은 자리에
    // 양수 제약을 두었다 — 필드는 같고 위반 종류만 바뀌었다.
    public static final String PET_ID_POSITIVE = "PLAN_101:반려견 아이디는 양수여야 합니다.";
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
    public static final String VISITED_REQUIRED = "PLAN_114:방문 여부는 필수입니다.";
    public static final String PET_IDS_SIZE_INVALID = "PLAN_115:동행 반려견은 최대 5마리까지 지정할 수 있습니다.";
    public static final String PACKING_ITEMS_REQUIRED = "PLAN_116:준비물 목록은 필수입니다.";
    public static final String PACKING_ITEMS_SIZE_INVALID = "PLAN_117:준비물은 한 번에 최대 50개까지 보낼 수 있습니다.";
    public static final String PACKING_CATEGORY_REQUIRED = "PLAN_118:준비물 분류는 필수입니다.";
    public static final String PACKING_CATEGORY_LENGTH_INVALID = "PLAN_119:준비물 분류는 30자 이하만 가능합니다.";
    public static final String PACKING_NAME_REQUIRED = "PLAN_120:준비물 이름은 필수입니다.";
    public static final String PACKING_NAME_LENGTH_INVALID = "PLAN_121:준비물 이름은 100자 이하만 가능합니다.";
    public static final String PACKING_REASON_LENGTH_INVALID = "PLAN_122:준비물 이유는 500자 이하만 가능합니다.";
    public static final String PACKING_CHECKED_REQUIRED = "PLAN_123:챙김 여부는 필수입니다.";
    public static final String REVIEW_OVERALL_RATING_REQUIRED = "PLAN_126:전체 만족도는 필수입니다.";
    public static final String REVIEW_OVERALL_RATING_RANGE_INVALID = "PLAN_127:전체 만족도는 1 이상 5 이하여야 합니다.";
    public static final String REVIEW_BODY_LENGTH_INVALID = "PLAN_128:후기 본문은 2000자 이하만 가능합니다.";
    public static final String REVIEW_ITEMS_REQUIRED = "PLAN_129:장소별 후기 목록은 필수입니다.";
    public static final String REVIEW_ITEMS_SIZE_INVALID = "PLAN_130:장소별 후기는 한 번에 최대 50개까지 보낼 수 있습니다.";
    public static final String REVIEW_ITEM_ID_POSITIVE = "PLAN_131:일정 항목 아이디는 양수여야 합니다.";
    public static final String REVIEW_ITEM_RATING_REQUIRED = "PLAN_132:장소 만족도는 필수입니다.";
    public static final String REVIEW_ITEM_RATING_RANGE_INVALID = "PLAN_133:장소 만족도는 1 이상 5 이하여야 합니다.";
    public static final String REVIEW_ITEM_COMMENT_LENGTH_INVALID = "PLAN_134:장소 한 줄 후기는 200자 이하만 가능합니다.";

    private PlanValidationMessage() {
    }
}
