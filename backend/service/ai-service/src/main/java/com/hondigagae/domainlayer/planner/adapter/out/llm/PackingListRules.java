package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.domain.model.PackingList.PackingItem;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;

/**
 * 준비물 목록을 <b>서버 규칙</b>으로 짠다 (#976). 모델은 조건부 품목만 더한다.
 *
 * <p>모델 출력이 텍스트 정리만 거쳐 그대로 저장되던 자리다. dev 실측(3일, 말티즈, 17~24℃, 강수 10~20%)에서
 * 존재하지 않는 {@code 방충망 장갑}, 강수 10~20% 를 근거로 든 {@code 소형견용 우산}, 배변봉투 자리에
 * {@code 휴대용 화장지}, 이유가 따로 노는 {@code 통풍 좋은 가벼운 재킷}, 24℃ 에 "더위에 민감한 말티즈"
 * 수분 보충이 나왔다. 프롬프트를 세게 써서는 확정적으로 못 막는다 — 모델은 규칙을 어긴다.
 *
 * <h2>세 겹</h2>
 *
 * <ol>
 *   <li><b>기본 품목은 서버가 넣는다.</b> 배변봉투 · 물그릇 · 리드줄 · 하네스 · 사료와 간식은 어느 여행에나
 *       필요하고 근거를 따질 일이 아니다. 모델이 같은 것을 적으면 버리고 서버 문장을 쓴다</li>
 *   <li><b>날씨 품목은 수치로 정한다.</b> 우비 · 쿨매트 · 옷은 예보가 임계값을 넘을 때만 서버가 넣고,
 *       이유에 그 수치를 적는다. 모델이 조건 밖에서 적은 같은 종류는 버린다</li>
 *   <li><b>그 밖의 품목은 목록 안에서만 받는다.</b> 실제로 파는 반려견 여행 용품의 낱말 목록
 *       ({@link #EXTRAS})에 걸리지 않으면 버린다. 걸려도 이유의 날씨 문장이 예보와 어긋나면 그 문장을 걷고,
 *       걷은 뒤 남는 이유가 없으면 품목을 버린다. 처음부터 이유가 없던 품목은 남긴다 — 틀린 말을 한 것이 아니다</li>
 * </ol>
 *
 * <p><b>순서는 이 여행에만 해당하는 것부터다</b> — 날씨 품목, 모델 품목, 기본 품목. 일정 상세의 요약 카드가
 * 앞 5개만 보여 주는데, 기본 품목을 앞에 두면 모든 여행에서 그 5줄이 똑같아진다.
 *
 * <p>강수 60% · 최고기온 31℃ 는 일정 프롬프트의 배치 지시와 같은 값이다. 더위 민감 28℃, 최저기온 5℃,
 * 추위 민감 10℃ 는 준비물에서 새로 정한 값이다. 반려견 특성은 문턱을 낮출 뿐이다 — 그 아이에게 먼저 오는
 * 날씨가 있다는 뜻이지, 날씨와 무관하게 품목을 부르는 이유가 아니다. 17~24℃ 의 더위 민감 말티즈에게
 * 쿨매트는 필요 없다. 여러 마리면 한 마리라도 민감하면 낮춘다(다견 합집합과 같은 방향).
 */
@Slf4j
final class PackingListRules {

    static final String CATEGORY_ESSENTIAL = "필수";
    static final String CATEGORY_WEATHER = "날씨 대비";
    static final String CATEGORY_CARE = "반려견 케어";
    static final String CATEGORY_MOVING = "이동 중";
    private static final Set<String> CATEGORIES =
        Set.of(CATEGORY_ESSENTIAL, CATEGORY_WEATHER, CATEGORY_CARE, CATEGORY_MOVING);

    static final int RAINY_PRECIPITATION_PROBABILITY = 60;
    static final double HOT_DAY_MAX_TEMPERATURE = 31.0d;
    static final double HOT_DAY_MAX_TEMPERATURE_FOR_HEAT_SENSITIVE = 28.0d;
    static final double COLD_DAY_MIN_TEMPERATURE = 5.0d;
    static final double COLD_DAY_MIN_TEMPERATURE_FOR_COLD_SENSITIVE = 10.0d;

    /** 강수가 없다는 뜻의 강수형태 표시명. tour-service {@code PrecipitationType} 의 NONE · UNKNOWN 이다. */
    private static final Set<String> NO_PRECIPITATION = Set.of("없음", "정보 없음");

    /** 기본 품목. 모델이 같은 것을 적으면 이 문장으로 대신한다. */
    private static final List<Kind> ESSENTIALS = List.of(
        new Kind("배변봉투", Pattern.compile("배변\\s*봉투|배변봉지|똥\\s*봉투|위생\\s*봉투|화장지|휴지"),
            "산책과 이동 중에 배변을 바로 치워요."),
        new Kind("휴대용 물그릇", Pattern.compile("물\\s*그릇|급수|물병|식수|워터\\s*보틀|물통"),
            "이동 중에도 물을 자주 마시게 해요."),
        new Kind("리드줄", Pattern.compile("리드\\s*줄|목줄|리드"),
            "반려견 동반 장소는 대부분 리드줄 착용이 입장 조건이에요."),
        new Kind("하네스", Pattern.compile("하네스"),
            "리드줄을 몸통에 걸어 목에 가는 부담을 덜어요."));

    /** 사료는 이유에 여행 일수를 적는다. 그래서 {@link #ESSENTIALS} 와 따로 둔다. */
    private static final Pattern FOOD = Pattern.compile("사료|간식");

    /*
      날씨 품목의 종류. 서버가 맡으므로 모델이 적은 같은 종류는 조건과 무관하게 버린다. 우산은 받지 않는다 —
      반려견 우산은 쓰지 않는 물건이고, 비는 우비가 막는다 (#976 의 `소형견용 우산`). `방수` · `아이스` 는 뒤에
      입을 것 · 식힐 것이 올 때만 날씨 품목이다 — 방수 배변패드와 아이스박스는 다른 물건이다.
     */
    private static final Pattern RAIN_GEAR = Pattern.compile("우비|레인\\s*코트|비옷|우산|방수\\s*(옷|재킷|자켓|점퍼|코트)");
    private static final Pattern COOLING_GEAR = Pattern.compile(
        "쿨\\s*매트|쿨\\s*조끼|냉감|아이스\\s*(팩|조끼|매트|방석)|쿨링|쿨토시");
    private static final Pattern WARM_GEAR = Pattern.compile("옷|방한|패딩|재킷|자켓|점퍼|조끼|니트|보온");

    /**
     * 모델이 더할 수 있는 품목. <b>실제로 파는 반려견 여행 용품의 낱말</b>이다. 여기에 없으면 버린다 —
     * {@code 방충망 장갑} 같은 것이 여기서 걸러진다. 목록에 없는 좋은 물건이 버려지는 것이 존재하지 않는
     * 물건이 나가는 것보다 덜 나쁘다. 사용자는 직접 더할 수 있다.
     */
    private static final Pattern EXTRAS = Pattern.compile(String.join("|",
        "물티슈", "수건", "타월", "배변\\s*패드", "이동장", "켄넬", "(펫|반려견|강아지)\\s*캐리어", "이동\\s*가방", "슬링백",
        "카시트", "안전\\s*벨트", "드라이브", "담요", "방석", "매트", "빗", "브러시", "구급", "상비약", "반창고",
        "소독", "진드기", "해충", "벌레", "기피제", "인식표", "이름표", "접종", "장난감", "노즈워크",
        "개모차", "유모차", "발\\s*세정", "발\\s*클리너", "신발", "발\\s*보호", "멀미", "그루밍", "샴푸",
        "밥그릇", "식기", "위생\\s*팬티", "매너\\s*벨트", "기저귀", "선크림", "자외선", "구명", "라이프\\s*(재킷|자켓)"));

    /**
     * 서버 종류 낱말에 걸려도 모델 품목으로 받는 것. 구명조끼는 `조끼`, 라이프재킷은 `재킷` 에 걸려 옷으로
     * 버려지는데, 서버의 옷 품목은 추운 날에만 나와서 해변 · 카약 일정의 안전용품이 어디에도 남지 않는다.
     */
    private static final Pattern NOT_SERVER_KIND = Pattern.compile("구명|라이프\\s*(재킷|자켓)");

    /*
      이유 안의 날씨 문장. 예보가 뒷받침하지 않으면 걷는다. 비는 **서술**로 잡는다 — `비가` 한 낱말로 잡으면
      "준비가 필요해요" · "장비가" 가 걸리고, "비 예보는 없지만" 처럼 예보와 맞는 문장까지 걸린다.
     */
    private static final Pattern RAIN_CLAIM = Pattern.compile(
        "(?<![가-힣])비\\s*(가\\s*(오|올|와|내리)|소식이\\s*있|예보가\\s*있|올\\s*수)|강수\\s*확률이?\\s*\\d|우천|소나기");
    private static final Pattern HEAT_CLAIM = Pattern.compile("더위|더운|폭염|무더|뙤약|햇볕이\\s*뜨거|뜨거운|열사병");
    private static final Pattern COLD_CLAIM = Pattern.compile("추위|추운|쌀쌀|한파|체온이\\s*떨어");

    private static final Pattern SENTENCE_BOUNDARY = Pattern.compile("(?<=[.!?])\\s+");

    private final PackingChecklistQuery query;
    private final LocalDate startDate;

    PackingListRules(PackingChecklistQuery query) {
        this.query = query;
        this.startDate = parseOrNull(query.startDate());
    }

    List<PackingItem> apply(List<PackingItem> modelItems) {
        Optional<String> rain = rainReason();
        Optional<String> heat = heatReason();
        Optional<String> cold = coldReason();

        List<PackingItem> result = new ArrayList<>();
        rain.ifPresent(reason -> result.add(item(CATEGORY_WEATHER, "반려견 우비", reason)));
        heat.ifPresent(reason -> result.add(item(CATEGORY_WEATHER, "쿨매트", reason)));
        cold.ifPresent(reason -> result.add(item(CATEGORY_WEATHER, "반려견 옷", reason)));

        int dropped = 0;
        for (PackingItem modelItem : modelItems) {
            PackingItem kept = keepExtra(modelItem, rain.isPresent(), heat.isPresent(), cold.isPresent());
            if (kept == null) {
                dropped++;
                log.info("LLM packing item replaced or dropped by server rules name={} reason={}",
                    modelItem.name(), modelItem.reason());
                continue;
            }
            boolean duplicate = result.stream().anyMatch(existing -> existing.name().equals(kept.name()));
            if (!duplicate) {
                result.add(kept);
            }
        }
        ESSENTIALS.forEach(kind -> result.add(item(CATEGORY_ESSENTIAL, kind.name(), kind.reason())));
        result.add(item(CATEGORY_ESSENTIAL, "사료와 간식", foodReason()));
        if (dropped > 0) {
            log.warn("LLM packing list corrected by server rules modelItems={} dropped={} rainy={} hot={} cold={}",
                modelItems.size(), dropped, rain.isPresent(), heat.isPresent(), cold.isPresent());
        }
        return result;
    }

    /** 모델 품목 하나. 서버가 맡는 종류이거나 목록 밖이거나 이유가 남지 않으면 null 이다. */
    private PackingItem keepExtra(PackingItem modelItem, boolean rainy, boolean hot, boolean cold) {
        String name = modelItem.name().strip();
        boolean serverKind = !NOT_SERVER_KIND.matcher(name).find()
            && (ESSENTIALS.stream().anyMatch(kind -> kind.pattern().matcher(name).find())
                || FOOD.matcher(name).find()
                || RAIN_GEAR.matcher(name).find()
                || COOLING_GEAR.matcher(name).find()
                || WARM_GEAR.matcher(name).find());
        if (serverKind || !EXTRAS.matcher(name).find()) {
            return null;
        }
        // 공백뿐인 이유는 없는 이유다. 화면에 빈 줄을 그리지 않게 null 로 모은다.
        String reason = modelItem.reason() == null || modelItem.reason().isBlank() ? null : modelItem.reason();
        if (reason != null) {
            reason = keepSentences(reason, sentence ->
                (!rainy && RAIN_CLAIM.matcher(sentence).find())
                    || (!hot && HEAT_CLAIM.matcher(sentence).find())
                    || (!cold && COLD_CLAIM.matcher(sentence).find()));
            if (reason == null) {
                return null;
            }
        }
        // 분류가 빠지는 일이 흔하다. 불변 Set 의 contains(null) 은 NPE 라 먼저 거른다.
        String category = modelItem.category() != null && CATEGORIES.contains(modelItem.category())
            ? modelItem.category() : CATEGORY_CARE;
        return item(category, name, reason);
    }

    private String foodReason() {
        int days = dayCount();
        return days <= 1
            ? "평소 먹던 사료와 간식이라야 배탈이 덜 나요."
            : days + "일 동안 먹을 평소 사료와 간식이에요. 먹던 것이라야 배탈이 덜 나요.";
    }

    /** 강수확률이 가장 높은 비 오는 날의 이유. 확률이 없고 강수형태만 있는 날도 비 오는 날이다. */
    private Optional<String> rainReason() {
        return query.safeWeatherOutlook().stream()
            .filter(this::isRainy)
            .max(Comparator.comparingInt(PackingListRules::probabilityOf))
            .map(this::rainReason);
    }

    private boolean isRainy(DayWeatherOutlook outlook) {
        boolean likely = outlook.maxPrecipitationProbability() != null
            && outlook.maxPrecipitationProbability() >= RAINY_PRECIPITATION_PROBABILITY;
        boolean forecast = outlook.precipitationTypeName() != null
            && !NO_PRECIPITATION.contains(outlook.precipitationTypeName());
        return likely || forecast;
    }

    private String rainReason(DayWeatherOutlook outlook) {
        String day = dayLabel(outlook);
        if (outlook.maxPrecipitationProbability() != null
            && outlook.maxPrecipitationProbability() >= RAINY_PRECIPITATION_PROBABILITY) {
            return day + "강수확률이 " + outlook.maxPrecipitationProbability() + "%예요.";
        }
        return day + outlook.precipitationTypeName() + " 예보가 있어요.";
    }

    /** 가장 더운 날의 이유. 문턱을 넘는 날이 없으면 비어 있다. */
    private Optional<String> heatReason() {
        double threshold = pets().stream().anyMatch(PetCondition::heatSensitive)
            ? HOT_DAY_MAX_TEMPERATURE_FOR_HEAT_SENSITIVE : HOT_DAY_MAX_TEMPERATURE;
        return query.safeWeatherOutlook().stream()
            .filter(outlook -> outlook.maxTemperature() != null && outlook.maxTemperature() >= threshold)
            .max(Comparator.comparing(DayWeatherOutlook::maxTemperature))
            .map(outlook -> dayLabel(outlook) + "최고기온이 " + temperature(outlook.maxTemperature()) + "℃예요.");
    }

    /** 가장 추운 날의 이유. 문턱을 넘는 날이 없으면 비어 있다. */
    private Optional<String> coldReason() {
        double threshold = pets().stream().anyMatch(PetCondition::coldSensitive)
            ? COLD_DAY_MIN_TEMPERATURE_FOR_COLD_SENSITIVE : COLD_DAY_MIN_TEMPERATURE;
        return query.safeWeatherOutlook().stream()
            .filter(outlook -> outlook.minTemperature() != null && outlook.minTemperature() <= threshold)
            .min(Comparator.comparing(DayWeatherOutlook::minTemperature))
            .map(outlook -> dayLabel(outlook) + "최저기온이 " + temperature(outlook.minTemperature()) + "℃예요.");
    }

    private List<PetCondition> pets() {
        return query.safePetConditions();
    }

    private int dayCount() {
        LocalDate end = parseOrNull(query.endDate());
        if (startDate == null || end == null || end.isBefore(startDate)) {
            return 1;
        }
        return (int) ChronoUnit.DAYS.between(startDate, end) + 1;
    }

    private Integer dayOf(DayWeatherOutlook outlook) {
        if (startDate == null || outlook.date() == null) {
            return null;
        }
        return (int) ChronoUnit.DAYS.between(startDate, outlook.date()) + 1;
    }

    /** 이유 앞머리의 일차. 여행 시작일을 모르면 붙이지 않는다 — 날짜만 있는 문장보다 그편이 읽기 쉽다. */
    private String dayLabel(DayWeatherOutlook outlook) {
        Integer day = dayOf(outlook);
        return day == null ? "" : day + "일차 ";
    }

    private static int probabilityOf(DayWeatherOutlook outlook) {
        return outlook.maxPrecipitationProbability() == null ? 0 : outlook.maxPrecipitationProbability();
    }

    /** 기온 표기. 소수점이 0 이면 떼어 {@code 31℃} 로, 아니면 {@code 30.5℃} 로 적는다. */
    private static String temperature(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    private static String keepSentences(String text, Predicate<String> contradicts) {
        List<String> sentences = Arrays.stream(SENTENCE_BOUNDARY.split(text.strip()))
            .filter(sentence -> !sentence.isBlank())
            .toList();
        List<String> kept = sentences.stream().filter(contradicts.negate()).toList();
        if (kept.size() == sentences.size()) {
            return text;
        }
        return kept.isEmpty() ? null : kept.stream().collect(Collectors.joining(" "));
    }

    private static PackingItem item(String category, String name, String reason) {
        return PackingItem.builder().category(category).name(name).reason(reason).build();
    }

    private static LocalDate parseOrNull(String date) {
        try {
            return date == null ? null : LocalDate.parse(date);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private record Kind(String name, Pattern pattern, String reason) {
    }
}
