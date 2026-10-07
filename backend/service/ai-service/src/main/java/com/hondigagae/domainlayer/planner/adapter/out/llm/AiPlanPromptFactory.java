package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
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
 *
 * <p><b>근거 문장에서 가리키게 될 것(일차·반려견)에는 대괄호를 쓰지 않는다.</b> 모델은 입력의
 * 표기를 그대로 흉내 내서, {@code [1일차]} 라고 주면 {@code "[1일차]~[3일차] 구름많음"} 처럼
 * 사용자 화면에 그 표기가 그대로 나간다 (#233). 대괄호는 후보 줄의 태그
 * ({@code [필수 포함]} · {@code [선호]})처럼 <b>지시문이 이름으로 부르는 표시</b>에만 남긴다 —
 * 이것은 문장 안에서 인용될 일이 없다. 그래도 새는 것은 {@link LlmTextCleaner} 가 응답에서 걷어낸다.
 */
@Component
public class AiPlanPromptFactory {

    /**
     * 역할과 규칙만 담은 고정 시스템 프롬프트.
     *
     * <p>규칙을 굳이 적는 이유는 각각 실제로 틀릴 수 있는 지점이기 때문이다 - 후보 밖 장소를
     * 지어내는 것, 반려견이 아니라 사람 기준으로 짜는 것, 근거를 일반론으로 적는 것.
     *
     * <p><b>규칙 번호를 옮기지 않는다.</b> 문서와 주석이 "규칙 9번(조사)" · "규칙 11번(같은 장소)" 처럼
     * 번호로 부른다. 출력 스키마를 줄일 때(#1128) 새 스키마와 어긋난 규칙(1 · 2 · 3 · 4 · 7 · 11)은 같은 자리에서
     * 고쳐 썼다 — 장소는 후보 번호로, 장소 없는 항목은 없이, 숙소는 그날의 lodging 으로.
     */
    private static final String SYSTEM_PROMPT = """
        당신은 반려견과 함께하는 제주 여행 일정을 설계하는 전문가입니다.

        지켜야 할 규칙:
        1. 장소는 사용자가 준 후보 목록 안에서만 고르고, 후보 줄 앞의 번호로 적습니다. 목록에 없는
           장소는 이름이 떠오르더라도 절대 쓰지 않습니다.
        2. 사람이 아니라 반려견 기준으로 짭니다. 하루 이동을 과하게 넣지 말고, 활동 사이에
           카페처럼 쉬어 갈 후보를 둡니다. 후보 줄의 권역을 보고 하루는 한 권역, 많아야 맞닿은
           두 권역 안에서 고릅니다. 그날 밤 숙소(lodging)도 그날 마지막 장소와 다음 날 첫 장소의
           권역이나 맞닿은 권역에서 고릅니다. 맞닿은 권역은 북서부·북부·북동부끼리와
           남서부·남부·남동부끼리의 옆자리, 그리고 북서부-남서부, 북동부-남동부입니다.
        3. 식사는 음식점 후보가 있을 때만 그 후보로 넣습니다. 없으면 넣지 않습니다.
           없는 것을 있다고 하지 않는 편이 낫습니다.
        4. 근거(reasons)는 최대 3개, 후보 데이터에 적힌 사실로만 씁니다. "좋은 곳입니다" 같은
           일반론이 아니라 실내 여부, 동반 조건, 분류처럼 목록에서 확인되는 내용을 적습니다.
        5. 확신할 수 없는 것은 적지 않습니다. 운영시간, 요금, 예약 가능 여부는 후보 목록에
           없으므로 언급하지 않습니다.
        6. 근거와 메모는 사용자에게 그대로 보이는 문장입니다. 대괄호([ ]) 같은 기호 표기를
           쓰지 말고, 일자는 "2일차", 여러 날은 "1~3일차" 처럼 자연스러운 문장으로 적습니다.
        7. 모든 항목에는 후보 번호가 있어야 합니다. 장소가 없는 항목(빈 식사 자리, 이동)은
           만들지 않습니다. 메모는 한 문장으로 짧게(25자 안팎) 씁니다.
        8. 사용자에게 보이는 문장은 "~해요" 체로 씁니다. "~한다", "~합니다", "~해라" 를 섞지
           않습니다. 한 초안 안에서 말투가 갈리면 안 됩니다.
        9. 장소명 뒤에 조사(은/는, 이/가, 을/를)를 붙이지 않습니다. 장소명이 숫자나 영문으로
           끝나면 받침 판정이 어긋나므로("애월코스트34은"), 조사가 필요 없는 문장으로 바꿔 씁니다.
        10. 반려견의 생애 단계는 입력에 적힌 표현만 씁니다. 입력에 없는 "노령견", "노견",
            "어린 강아지" 같은 단정을 덧붙이지 않습니다.
        11. 같은 장소를 여러 날에 넣지 않습니다. 날마다 다른 곳을 고릅니다. 숙박 후보는 항목에
            넣지 않고, 그날 밤 묵을 숙박 후보 번호를 그날의 lodging 에 적습니다 — 같은 숙소에 이어
            묵어도 됩니다. 마지막 날 lodging 은 null 입니다. 그날 밤은 집으로 돌아갑니다.
        12. 후보 사이의 이동 거리와 혼잡도는 입력에 없습니다. "이동 거리가 짧다", "한적하다" 처럼
            쓰지 않습니다. 반려견 성향 때문에 고른 곳은 성향으로만 설명합니다("사람을 불편해하는
            아이라"). 더위는 날씨 전망의 최고기온이 31℃ 이상인 날에만 말합니다.
        13. 항목 메모는 그 장소의 분류와 실내 여부에 맞게 씁니다. 실내 장소를 야외라고, 숙소나
            음식점을 산책하는 곳이라고 적지 않습니다.
        """;

    public String systemPrompt() {
        return SYSTEM_PROMPT;
    }

    /** 준비물 생성용 시스템 프롬프트. 일정 생성과 같은 이유로 상수 고정(프롬프트 캐싱)이다. */
    private static final String PACKING_SYSTEM_PROMPT = """
        당신은 반려견 동반 여행의 준비물을 챙겨 주는 전문가입니다.

        지켜야 할 규칙:
        1. 제공된 일정·날씨 전망·반려견 특성에서 근거를 찾을 수 있는 준비물을 우선합니다.
        2. 이유는 일반론이 아니라 제공된 데이터의 사실로 적습니다 - "2일차 강수확률 80%" 처럼.
        3. 제공되지 않은 정보(숙소 시설, 차량 유무 등)는 가정하지 않습니다.
        4. 여행과 무관한 물건은 넣지 않습니다.
        5. 이유는 사용자에게 그대로 보이는 문장입니다. 대괄호([ ]) 같은 기호 표기를 쓰지 말고,
           일자는 "2일차", 여러 날은 "1~3일차" 처럼 자연스러운 문장으로 적습니다.
        6. 이유는 "~해요" 체로 씁니다. "~한다", "~합니다", "~해라" 를 섞지 않습니다.
        7. 반려견의 생애 단계는 입력에 적힌 표현만 씁니다. 입력에 없는 "노령견", "노견",
           "어린 강아지" 같은 단정을 덧붙이지 않습니다.
        8. 배변봉투, 물그릇, 리드줄, 하네스, 사료와 간식은 서버가 넣습니다. 적지 않습니다.
        9. 우비, 쿨매트, 옷 같은 날씨 대비 물건도 서버가 예보 수치로 정합니다. 적지 않습니다.
        10. 그 밖에 이 여행의 일정·반려견 특성에서 근거를 찾을 수 있는 물건만 적습니다. 실제로 파는
            반려견 여행 용품(물티슈, 이동장, 담요, 진드기 기피제, 인식표 등)만 씁니다. 사람용 물건이나
            없는 물건("방충망 장갑", "반려견 우산")은 적지 않습니다.
        11. 이유의 날씨 문장은 전망 수치와 맞아야 합니다. 강수확률 60% 미만인 날 비를, 최고기온
            31℃(더위에 민감한 아이는 28℃) 미만인 날 더위를, 최저기온 5℃(추위에 민감한 아이는 10℃)
            초과인 날 추위를 이유로 들지 않습니다. 물건과 이유가 서로 맞아야 합니다.
        """;

    /**
     * 일정 생성의 다견 규칙 — <b>가장 제약이 큰 아이</b>가 기준이다.
     * 한 마리라도 못 들어가면 그 장소는 갈 수 없기 때문이다.
     */
    private static final String PLAN_MULTI_PET_RULE = """
        - 입장 제한(크기·체중)은 가장 큰 크기와 가장 무거운 체중 기준으로 판정할 것
        """;

    /**
     * 준비물의 다견 규칙 — <b>합집합</b>이다.
     *
     * <p>일정 생성과 반대인 것이 요점이다. 준비물은 점수를 매기는 일이 아니라 목록을 만드는
     * 일이라, "가장 제약이 큰 아이 하나"로 접으면 다른 아이에게 필요한 물건이 빠진다.
     * 더위에 약한 아이의 쿨매트와 추위에 약한 아이의 옷은 둘 다 필요하다.
     *
     * <p>대신 <b>어느 아이 때문인지 이유에 밝히게</b> 한다. 합집합으로 만들면 "왜 이게
     * 필요한가"가 흐려지는데, 준비물은 항목마다 근거를 붙이는 것이 핵심인 기능이라
     * 그 문장이 흐려지면 목록 자체가 신뢰를 잃는다.
     */
    private static final String PACKING_MULTI_PET_RULE = """
        - 아이마다 필요한 물건을 모두 넣을 것. 한 아이에게만 필요한 물건도 빠뜨리지 말 것
        - 특정 아이 때문에 필요한 물건은 이유에 어느 아이인지 밝힐 것 - "반려견 2가 더위에 약해" 처럼
        - 아이들이 함께 쓸 수 있는 물건은 하나로 적되 마리 수가 필요하면 수량을 밝힐 것
        """;

    public String packingSystemPrompt() {
        return PACKING_SYSTEM_PROMPT;
    }

    /** 준비물 생성용 사용자 프롬프트. 일정 생성과 같은 절(반려견·날씨)을 재사용해 두 프롬프트가 갈라지지 않게 한다. */
    public String packingUserPrompt(PackingChecklistQuery query) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("여행 정보\n");
        prompt.append("- 기간: ").append(query.startDate()).append(" ~ ").append(query.endDate()).append('\n');

        appendPetSection(prompt, query.safePetConditions(), PACKING_MULTI_PET_RULE);
        appendWeatherLines(prompt, query.safeWeatherOutlook(), parseDateOrNull(query.startDate()));

        if (query.planOutline() != null) {
            prompt.append("\n여행 일정\n");
            appendOutlineDays(prompt, query.planOutline());
        }

        prompt.append("\n위 여행에 필요한 반려견 준비물 목록을 만들어 주세요.");
        return prompt.toString();
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

        appendPetSection(prompt, query.safePetConditions(), PLAN_MULTI_PET_RULE);
        appendWeatherSection(prompt, query);
        appendRegenerateSection(prompt, query);

        /*
          후보는 아이디가 아니라 번호로 싣는다 (#1128). 18자리 placeId 는 항목마다 6~9토큰이라 그대로 옮겨
          쓰게 하면 그만큼 디코드가 늘고, 옮겨 적다 틀릴 자리도 생긴다. 번호는 safeCandidates() 순서의 1-based
          인덱스이고 어댑터가 같은 목록에서 되돌린다 — 이 순서가 둘 사이의 계약이다.
        */
        prompt.append("\n후보 장소 (이 목록 안에서만 고르고, 줄 앞의 번호로 적을 것)\n");
        List<PlaceCandidate> candidates = query.safeCandidates();
        for (int index = 0; index < candidates.size(); index++) {
            PlaceCandidate candidate = candidates.get(index);
            prompt.append("- ").append(index + 1).append(". ");
            if (query.safePinnedPlaceIds().contains(candidate.placeId())) {
                prompt.append("[필수 포함] ");
            } else if (query.safeFavoritePlaceIds().contains(candidate.placeId())) {
                prompt.append("[선호] ");
            }
            prompt.append(candidate.title())
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
            // 주소의 읍면 이름으로 동서를 가늠하라고 맡기지 않는다 — 규칙 2가 이 이름을 그대로 비교한다 (#1171).
            JejuZone zone = JejuZone.of(candidate.lat(), candidate.lng());
            if (zone != null) {
                prompt.append(" | 권역: ").append(zone.getDisplayName());
            }
            if (candidate.addr() != null && !candidate.addr().isBlank()) {
                prompt.append(" | ").append(candidate.addr());
            }
            prompt.append('\n');
        }

        if (isRegenerate(query)) {
            // 재생성은 그날 하루만 출력시킨다 — "N일 일정을 만들어 주세요" 로 끝내면 위 절의 지시와 맞서 전체를 다시 쓴다.
            prompt.append("\n위 조건으로 ").append(query.regenerateDay()).append("일차 하루 일정만 만들어 주세요.");
        } else {
            prompt.append("\n위 조건으로 ").append(resolveDayCount(query)).append("일 일정을 만들어 주세요.");
        }
        return prompt.toString();
    }

    /** 하루 재생성인가. 워커가 regenerateDay 와 planOutline 을 함께 채운다 — 둘 중 하나만 있으면 전체 생성으로 본다. */
    private static boolean isRegenerate(AiPlanGenerationQuery query) {
        return query.regenerateDay() != null && query.planOutline() != null;
    }

    /**
     * 반려견 특성 절. 이 값이 시스템 프롬프트의 "반려견 기준" 규칙에 실체를 준다 —
     * 특성 없이 "반려견 기준으로 짜라"고만 하면 모델은 일반적인 강아지를 상상한다.
     * 특성이 없으면(조회 실패/프로필 부재) 절 자체를 생략한다 — 없는 값을 지어 적지 않는다.
     */
    /**
     * 반려견 절.
     *
     * <p><b>여러 마리일 때의 규칙은 쓰임마다 반대라서</b> 호출부가 정한다.
     *
     * <ul>
     *   <li>일정 생성 — <b>가장 제약이 큰 아이</b>가 기준이다. 한 마리라도 못 들어가면
     *       그 장소는 못 간다</li>
     *   <li>준비물 — <b>합집합</b>이다. 더위에 약한 아이의 쿨매트와 추위에 약한 아이의 옷이
     *       둘 다 필요하다. 여기서 "가장 제약이 큰 아이"로 접으면 다른 아이 물건이 빠진다</li>
     * </ul>
     *
     * @param multiPetRule 여러 마리일 때 덧붙일 판정 규칙. 한 마리면 쓰이지 않는다
     */
    private void appendPetSection(StringBuilder prompt, List<PetCondition> pets, String multiPetRule) {
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
            // 이유 문장이 "반려견 2가 …" 로 가리킬 이름이다. 대괄호를 두면 그 표기까지 따라 나온다.
            prompt.append("반려견 ").append(index + 1).append('\n');
            appendPetTraits(prompt, pets.get(index));
        }
        prompt.append(multiPetRule);
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
        appendWeatherLines(prompt, outlooks, parseDateOrNull(query.startDate()));
        // 배치 지시는 일정 생성 전용이다 — 준비물 프롬프트는 전망 줄만 재사용한다.
        prompt.append("- 강수확률이 60% 이상이거나 강수형태가 있는 날은 실내 후보 위주로 배치할 것\n");
        prompt.append("- 최고기온 31℃ 이상인 날 야외 일정은 아침·저녁에 두고, 더위에 민감한 반려견이면 한낮 야외를 넣지 말 것\n");
        prompt.append("- 전망이 없는 날짜의 날씨는 지어내지 말 것\n");
    }

    /** 일자별 전망 줄. 일정 생성·준비물 생성 프롬프트가 같은 표기를 쓰도록 한 곳에 둔다. */
    private void appendWeatherLines(StringBuilder prompt, List<DayWeatherOutlook> outlooks, LocalDate startDate) {
        if (outlooks.isEmpty()) {
            return;
        }
        prompt.append("\n여행 기간 날씨 전망 (기상청 예보)\n");
        for (DayWeatherOutlook outlook : outlooks) {
            prompt.append("- ");
            if (startDate != null) {
                long dayIndex = ChronoUnit.DAYS.between(startDate, outlook.date()) + 1;
                prompt.append(dayLabel(dayIndex)).append(' ');
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
    }

    /**
     * 일차 표기. 날씨 전망·일정 개요·재생성 지시가 모두 이 한 가지 표기를 쓴다.
     *
     * <p>모델이 이유 문장에서 그날을 가리킬 때 그대로 옮겨 쓰는 이름이므로 <b>사용자에게 보여도
     * 되는 꼴</b>이어야 한다. {@code [1일차]} 는 아니고 {@code 1일차} 는 그렇다.
     */
    private static String dayLabel(long day) {
        return day + "일차";
    }

    private LocalDate parseDateOrNull(String date) {
        try {
            return LocalDate.parse(date);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    /**
     * 하루 재생성 절. 기존 일정은 <b>겹치지 않게 하는 맥락</b>으로만 보여 주고, 지정한 날 하루만 출력하게 한다.
     *
     * <p>전에는 "나머지 날은 그대로 유지해 전체 일정을 출력할 것" 이었다. 화면은 그날 하루만 쓰는데
     * ({@code plan-day-regenerate-view.tsx} 가 대상 일자만 거른다) 모델은 7일치를 다시 써서, 하루 재생성의
     * 디코드가 전체 생성과 같았다 (#1128). 다른 날 장소를 넣지 말라는 지시가 기존 일정을 싣는 이유다 —
     * 숙소는 규칙 11 대로 이어 묵을 수 있다. 그래도 다른 날이 오면 어댑터가 대상 일자만 남긴다.
     */
    private void appendRegenerateSection(StringBuilder prompt, AiPlanGenerationQuery query) {
        if (!isRegenerate(query)) {
            return;
        }
        int target = query.regenerateDay();
        prompt.append("\n기존 일정 (겹치지 않게 참고만 할 것)\n");
        appendOutlineDays(prompt, query.planOutline());
        prompt.append("- ").append(dayLabel(target)).append("만 새로 짜서 그날 하루만 출력할 것. days 에는 ")
            .append(dayLabel(target)).append(" 하나만 담을 것\n");
        prompt.append("- 다른 날에 있는 장소는 넣지 말 것. 숙소는 이어 묵어도 됨\n");
    }

    /**
     * 일정 개요의 일자별 줄. 하루 재생성·준비물 생성 프롬프트가 같은 표기를 쓰도록 한 곳에 둔다.
     *
     * <p>아이디는 싣지 않는다 (#1128). 둘 다 이름으로 충분하다 — 재생성은 겹치지 않게 보는 맥락이고(출력은
     * 후보 번호다), 준비물은 아이디를 쓰지 않는다. 18자리 숫자는 토큰만 먹고, 모델이 출력에 흉내 낼 거리가 된다.
     */
    private void appendOutlineDays(StringBuilder prompt, PlanOutline outline) {
        for (PlanOutline.PlanOutlineDay day : outline.safeDays()) {
            prompt.append(dayLabel(day.day()));
            if (day.safeItems().isEmpty()) {
                prompt.append(" (항목 없음)");
            }
            for (PlanOutline.PlanOutlineItem item : day.safeItems()) {
                prompt.append(" · ").append(item.title() == null ? "이름없음" : item.title());
            }
            prompt.append('\n');
        }
    }

    private void appendPetTraits(StringBuilder prompt, PetCondition pet) {
        if (pet.breed() != null && !pet.breed().isBlank()) {
            prompt.append("- 견종: ").append(pet.breed()).append('\n');
        }
        if (pet.ageText() != null && !pet.ageText().isBlank()) {
            prompt.append("- 나이: ").append(pet.ageText());
            /*
              **단계를 값으로 넘긴다** (#493). 전에는 "노령견은 …, 어린 반려견은 …" 을 나이와
              무관하게 모든 아이에게 붙였다. 모델이 그 낱말을 그대로 끌어다 써서 6살 말티즈의
              근거에 "노령견의 피로를 최소화한다" 가 나왔다 — 고를 여지를 없애는 쪽이 맞다.
            */
            if (pet.lifeStage() != null) {
                prompt.append(" (").append(pet.lifeStage().getDisplayName()).append(')');
                String guidance = pet.lifeStage().getPlanningGuidance();
                if (guidance != null) {
                    prompt.append(" - ").append(guidance);
                }
            }
            prompt.append('\n');
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
        if (pet.lowSociality()) {
            prompt.append("- 사회성이 낮음: 다른 반려견이나 사람이 몰리는 장소를 피하고 한적한 곳 위주로 짤 것\n");
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
