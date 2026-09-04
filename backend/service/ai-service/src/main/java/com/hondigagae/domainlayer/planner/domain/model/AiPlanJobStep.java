package com.hondigagae.domainlayer.planner.domain.model;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 일정 생성 작업의 세부 진행 단계.
 *
 * <p>상태({@link AiPlanJobStatus})만으로는 "생성 중"이 전부라 대기 화면이 진행을 보여 줄 수
 * 없다. LLM 호출이 수십 초라 그 사이 화면이 멈춘 것처럼 보이는데, <b>화면이 단계를 지어내면
 * 거짓 진행률이 된다.</b> 그래서 서버가 실제로 지금 무엇을 하는지 알려 준다.
 *
 * <h2>선언 순서가 계약이다</h2>
 *
 * {@link #order()} 는 {@code ordinal} 에서 나오고 {@link #total()} 은 값의 개수다. 따로 적어
 * 두면 값을 추가할 때 한쪽만 고쳐져 "5 / 4 단계" 같은 것이 나간다.
 *
 * <p><b>여기 있는 단계는 워커가 실제로 밟는 단계여야 한다.</b> 그럴듯한 이름을 늘리면 화면은
 * 정확해 보이는 채로 거짓말을 하게 되고, 그것이 이 기능이 없던 이유다. 단계를 더하거나 순서를
 * 바꿀 때는 {@code AiPlanWorker} 의 실행 순서를 함께 고친다 — 테스트가 그 둘을 묶어 둔다.
 */
@Getter
@RequiredArgsConstructor
public enum AiPlanJobStep implements CodeNameDescribable {

    CONDITIONS("조건 확인", "반려견 특성과, 하루 재생성이면 기존 일정을 확인합니다."),
    CANDIDATES("후보 장소 수집", "여행 지역에서 반려견 동반이 확인된 장소를 모읍니다."),
    WEATHER("날씨 전망 반영", "여행 기간의 일자별 날씨 전망을 붙입니다."),
    DRAFTING("일정 구성", "AI 가 후보 장소로 일자별 일정을 짭니다.");

    private final String displayName;
    private final String description;

    /** 몇 번째 단계인지 (1부터). 화면의 "n / m 단계" 에서 n 이다. */
    public int order() {
        return ordinal() + 1;
    }

    /** 전체 단계 수. 화면의 "n / m 단계" 에서 m 이다. */
    public static int total() {
        return values().length;
    }
}
