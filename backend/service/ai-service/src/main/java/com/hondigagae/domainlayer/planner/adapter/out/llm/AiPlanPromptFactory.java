package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;

/**
 * 프롬프트 조립.
 *
 * <p>시스템 프롬프트를 상수로 고정한 것은 <b>프롬프트 캐싱</b> 때문이다. 캐시는 접두사 일치라
 * 앞부분이 한 바이트라도 흔들리면 뒤가 전부 무효가 된다. 요청마다 달라지는 값(날짜, 후보 목록,
 * 사용자 메모)은 전부 user 메시지 쪽에 둔다.
 *
 * <p>출력 형식을 여기 적지 않는 것도 의도다. 형식은 구조화 출력 스키마
 * ({@code LlmPlanDraftResponse}) 가 강제하므로, 프롬프트에 또 적으면 두 곳이 갈라진다.
 */
@Component
public class AiPlanPromptFactory {

    /**
     * 역할과 규칙만 담은 고정 시스템 프롬프트.
     *
     * <p>규칙을 굳이 적는 이유는 각각 실제로 틀릴 수 있는 지점이기 때문이다 - 후보 밖 장소를
     * 지어내는 것, 반려견이 아니라 사람 기준으로 짜는 것, 근거를 일반론으로 적는 것.
     */
    private static final String SYSTEM_PROMPT = """
        당신은 반려견과 함께하는 제주 여행 일정을 설계하는 전문가입니다.

        지켜야 할 규칙:
        1. 일정에 넣는 장소는 반드시 사용자가 준 후보 목록 안에서만 고릅니다. 목록에 없는 장소는
           이름이 떠오르더라도 절대 쓰지 않습니다. placeId 는 목록의 값을 그대로 옮깁니다.
        2. 사람이 아니라 반려견 기준으로 짭니다. 하루 이동을 과하게 넣지 말고, 활동 사이에
           쉬는 자리를 둡니다.
        3. 하루에 식사 항목(MEAL)을 최소 한 번 넣되, 후보에 식음료 장소가 없으면 억지로
           넣지 않습니다. 없는 것을 있다고 하지 않는 편이 낫습니다.
        4. 근거(reasons)는 후보 데이터에 적힌 사실로만 씁니다. "좋은 곳입니다" 같은 일반론이
           아니라 실내 여부, 동반 조건, 분류처럼 목록에서 확인되는 내용을 적습니다.
        5. 확신할 수 없는 것은 적지 않습니다. 운영시간, 요금, 예약 가능 여부는 후보 목록에
           없으므로 언급하지 않습니다.
        """;

    public String systemPrompt() {
        return SYSTEM_PROMPT;
    }

    /**
     * 요청마다 달라지는 부분. 캐시 접두사 뒤에 오도록 user 메시지로 보낸다.
     */
    public String userPrompt(AiPlanGenerationQuery query) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("여행 조건\n");
        prompt.append("- 기간: ").append(query.startDate()).append(" ~ ").append(query.endDate())
            .append(" (총 ").append(resolveDayCount(query)).append("일)\n");
        if (query.budget() != null && !query.budget().isBlank()) {
            prompt.append("- 예산: ").append(query.budget()).append("원\n");
        }
        if (query.requestNote() != null && !query.requestNote().isBlank()) {
            prompt.append("- 사용자 요청: ").append(query.requestNote()).append('\n');
        }

        prompt.append("\n후보 장소 (이 목록 안에서만 고를 것)\n");
        for (PlaceCandidate candidate : query.safeCandidates()) {
            prompt.append("- placeId=").append(candidate.placeId())
                .append(" | ").append(candidate.title())
                .append(" | ").append(nullSafe(candidate.contentTypeName()))
                .append(" | ").append(candidate.indoorText())
                .append(" | 동반: ").append(nullSafe(candidate.petAllowanceName()));
            if (candidate.sourceCategory() != null && !candidate.sourceCategory().isBlank()) {
                prompt.append(" | 분류: ").append(candidate.sourceCategory());
            }
            if (candidate.addr() != null && !candidate.addr().isBlank()) {
                prompt.append(" | ").append(candidate.addr());
            }
            prompt.append('\n');
        }

        prompt.append("\n위 조건으로 ").append(resolveDayCount(query)).append("일 일정을 만들어 주세요.");
        return prompt.toString();
    }

    /**
     * 여행 일수. 날짜가 없거나 형식이 어긋나면 1일로 본다.
     *
     * <p>날짜 검증은 이미 요청 단계에서 끝났지만, 어댑터가 상위 검증을 신뢰해 터지는 것보다
     * 최소값으로 내려앉는 편이 낫다.
     */
    public int resolveDayCount(AiPlanGenerationQuery query) {
        try {
            LocalDate start = LocalDate.parse(query.startDate());
            LocalDate end = LocalDate.parse(query.endDate());
            return (int) ChronoUnit.DAYS.between(start, end) + 1;
        } catch (RuntimeException exception) {
            return 1;
        }
    }

    private String nullSafe(String value) {
        return value == null || value.isBlank() ? "정보없음" : value;
    }
}
