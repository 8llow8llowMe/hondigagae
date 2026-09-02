package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import java.time.LocalDate;
import java.util.List;
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
        if (!query.safePinnedPlaceIds().isEmpty()) {
            prompt.append("- 필수 포함: 후보 목록에서 [필수 포함] 표시가 붙은 장소 ")
                .append(query.safePinnedPlaceIds().size())
                .append("곳을 빠짐없이 일정에 배치할 것\n");
        }
        if (!query.safeFavoritePlaceIds().isEmpty()) {
            prompt.append("- 선호 장소: [선호] 표시가 붙은 장소는 조건(입장 제한·동선·날씨)이 맞으면 우선 배치할 것. 필수는 아님\n");
        }

        appendPetSection(prompt, query.safePetConditions());
        appendWeatherSection(prompt, query);
        appendRegenerateSection(prompt, query);

        prompt.append("\n후보 장소 (이 목록 안에서만 고를 것)\n");
        for (PlaceCandidate candidate : query.safeCandidates()) {
            prompt.append("- ");
            if (query.safePinnedPlaceIds().contains(candidate.placeId())) {
                prompt.append("[필수 포함] ");
            } else if (query.safeFavoritePlaceIds().contains(candidate.placeId())) {
                prompt.append("[선호] ");
            }
            prompt.append("placeId=").append(candidate.placeId())
                .append(" | ").append(candidate.title())
                .append(" | ").append(nullSafe(candidate.contentTypeName()))
                .append(" | ").append(candidate.indoorText())
                .append(" | 동반: ").append(nullSafe(candidate.petAllowanceName()));
            if (candidate.allowedPetSizeName() != null && !candidate.allowedPetSizeName().isBlank()) {
                prompt.append(" | 입장크기: ").append(candidate.allowedPetSizeName());
            }
            if (candidate.maxPetWeightKg() != null) {
                prompt.append(" | 체중제한: ").append(candidate.maxPetWeightKg()).append("kg");
            }
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
     * 반려견 특성 절. 이 값이 시스템 프롬프트의 "반려견 기준" 규칙에 실체를 준다 —
     * 특성 없이 "반려견 기준으로 짜라"고만 하면 모델은 일반적인 강아지를 상상한다.
     * 특성이 없으면(조회 실패/프로필 부재) 절 자체를 생략한다 — 없는 값을 지어 적지 않는다.
     */
    private void appendPetSection(StringBuilder prompt, List<PetCondition> pets) {
        if (pets == null || pets.isEmpty()) {
            return;
        }
        if (pets.size() == 1) {
            prompt.append("\n함께 여행하는 반려견\n");
            appendPetTraits(prompt, pets.get(0));
            return;
        }
        prompt.append("\n함께 여행하는 반려견 ").append(pets.size()).append("마리\n");
        for (int index = 0; index < pets.size(); index++) {
            prompt.append("[반려견 ").append(index + 1).append("]\n");
            appendPetTraits(prompt, pets.get(index));
        }
        // 여러 마리면 입장 제한은 가장 제약이 큰 아이가 기준이다 — 한 마리라도 못 들어가면 그 장소는 못 간다.
        prompt.append("- 입장 제한(크기·체중)은 가장 큰 크기와 가장 무거운 체중 기준으로 판정할 것\n");
    }

    /**
     * 여행 기간 날씨 전망 절. 이 절이 있어야 "비 오는 날 실내 위주" 배치가 <b>그날 실제로
     * 비가 오는지</b>를 근거로 이뤄진다 — 반려견의 더위 민감을 알아도 그날 더운지 모르면
     * 규칙이 빈 구호다. 전망이 없으면(조회 실패·커버리지 밖) 절을 생략한다 — 지어내지 않는다.
     */
    private void appendWeatherSection(StringBuilder prompt, AiPlanGenerationQuery query) {
        List<DayWeatherOutlook> outlooks = query.safeWeatherOutlook();
        if (outlooks.isEmpty()) {
            return;
        }
        LocalDate startDate = parseDateOrNull(query.startDate());
        prompt.append("\n여행 기간 날씨 전망 (기상청 예보)\n");
        for (DayWeatherOutlook outlook : outlooks) {
            prompt.append("- ");
            if (startDate != null) {
                long dayIndex = ChronoUnit.DAYS.between(startDate, outlook.date()) + 1;
                prompt.append('[').append(dayIndex).append("일차] ");
            }
            prompt.append(outlook.date());
            if (outlook.skyStateName() != null) {
                prompt.append(" | ").append(outlook.skyStateName());
            }
            if (outlook.precipitationTypeName() != null) {
                prompt.append(" | 강수형태: ").append(outlook.precipitationTypeName());
            }
            if (outlook.maxPrecipitationProbability() != null) {
                prompt.append(" | 강수확률 ").append(outlook.maxPrecipitationProbability()).append('%');
            }
            if (outlook.minTemperature() != null || outlook.maxTemperature() != null) {
                prompt.append(" | 기온 ")
                    .append(outlook.minTemperature() == null ? "?" : outlook.minTemperature())
                    .append('~')
                    .append(outlook.maxTemperature() == null ? "?" : outlook.maxTemperature())
                    .append("℃");
            }
            if (outlook.maxWindSpeed() != null) {
                prompt.append(" | 최대풍속 ").append(outlook.maxWindSpeed()).append("m/s");
            }
            prompt.append('\n');
        }
        prompt.append("- 강수확률이 60% 이상이거나 강수형태가 있는 날은 실내 후보 위주로 배치할 것\n");
        prompt.append("- 최고기온 31℃ 이상인 날 야외 일정은 아침·저녁에 두고, 더위에 민감한 반려견이면 한낮 야외를 넣지 말 것\n");
        prompt.append("- 전망이 없는 날짜의 날씨는 지어내지 말 것\n");
    }

    private LocalDate parseDateOrNull(String date) {
        try {
            return LocalDate.parse(date);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    /**
     * 하루 재생성 절. 기존 일정 전체를 보여 주고 지정한 날만 새로 짜게 한다 —
     * 이 절이 없으면 "재생성"이 아니라 완전히 새로운 일정이 나온다.
     */
    private void appendRegenerateSection(StringBuilder prompt, AiPlanGenerationQuery query) {
        PlanOutline outline = query.planOutline();
        if (outline == null || query.regenerateDay() == null) {
            return;
        }
        prompt.append("\n기존 일정\n");
        for (PlanOutline.PlanOutlineDay day : outline.safeDays()) {
            prompt.append("[").append(day.day()).append("일차]");
            if (day.safeItems().isEmpty()) {
                prompt.append(" (항목 없음)");
            }
            for (PlanOutline.PlanOutlineItem item : day.safeItems()) {
                prompt.append(" · ").append(item.title() == null ? "이름없음" : item.title());
                if (item.placeId() != null) {
                    prompt.append("(placeId=").append(item.placeId()).append(')');
                }
            }
            prompt.append('\n');
        }
        prompt.append("- 위 일정에서 ").append(query.regenerateDay())
            .append("일차만 새로 구성할 것. 나머지 날은 기존 항목을 순서까지 그대로 유지해 전체 일정을 출력할 것\n");
    }

    private void appendPetTraits(StringBuilder prompt, PetCondition pet) {
        if (pet.breed() != null && !pet.breed().isBlank()) {
            prompt.append("- 견종: ").append(pet.breed()).append('\n');
        }
        if (pet.sizeName() != null) {
            prompt.append("- 크기: ").append(pet.sizeName())
                .append(" (입장 조건이 맞는 후보만 고를 것)").append('\n');
        }
        if (pet.weightText() != null && !pet.weightText().isBlank()) {
            prompt.append("- 체중: ").append(pet.weightText())
                .append("kg (체중제한이 있는 후보는 제한 이내인지 확인할 것)").append('\n');
        }
        if (pet.activityName() != null) {
            prompt.append("- 활동량: ").append(pet.activityName()).append('\n');
        }
        if (pet.heatSensitive()) {
            prompt.append("- 더위에 민감함: 한낮 야외 일정을 피하고 실내나 그늘 위주로 짤 것\n");
        }
        if (pet.coldSensitive()) {
            prompt.append("- 추위에 민감함: 겨울철 장시간 야외 일정을 피할 것\n");
        }
        if (pet.noiseSensitive()) {
            prompt.append("- 소음에 민감함: 붐비는 장소를 연달아 배치하지 말 것\n");
        }
        if (pet.walkPreferred()) {
            prompt.append("- 산책을 좋아함: 하루에 한 번은 걷는 일정을 넣을 것\n");
        }
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
