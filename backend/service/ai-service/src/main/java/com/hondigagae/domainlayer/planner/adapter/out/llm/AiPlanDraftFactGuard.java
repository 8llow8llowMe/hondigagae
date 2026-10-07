package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;

/**
 * 초안을 <b>서버가 가진 사실</b>과 대조해 어긋나는 것을 걷어낸다 (#975).
 *
 * <p>모델의 자유 서술이 검증 없이 나가던 자리다. dev 실측에서 같은 결과에 "각 일정 간 이동 거리가
 * 짧아…" 와 FE 의 {@code 직선 30.1km — 하루 이동이 깁니다} 가 함께 붙었고, 1박 2일의 마지막 날에
 * 숙박이 들어갔고, 16~23℃ 에 "한낮의 더위를 피할 수 있습니다" 가 나왔고, 콘도를 "해안가에서 가벼운
 * 산책을 할 수 있는 실외 장소" 로 설명했다. 프롬프트가 1차 방어고 여기가 마지막 방어다 —
 * {@link LlmTextCleaner} 와 같은 결이다.
 *
 * <h2>규칙</h2>
 *
 * <ul>
 *   <li><b>마지막 날에는 숙박이 없다.</b> 그날 밤은 집에 간다. 당일치기도 같다 — 1일차가 마지막 날이다</li>
 *   <li><b>확인할 수 없는 근거는 버린다.</b> 모델은 후보 사이 거리와 혼잡도를 본 적이 없다
 *       (프롬프트에 없다). {@code SHORT_DISTANCE} · {@code LOW_CONGESTION} 근거와, 다른 근거 ·
 *       메모 안의 거리 · 혼잡 문장은 추측이다</li>
 *   <li><b>더위는 더운 날에만 말한다.</b> 최고기온이 {@value #HOT_DAY_MAX_TEMPERATURE}℃ 미만이거나
 *       전망이 없는 날의 더위 문장은 버린다. 임계값은 프롬프트의 배치 지시와 같다</li>
 *   <li><b>메모가 장소 유형 · 실내 여부와 맞아야 한다.</b> 실내 장소를 "야외" 로, 숙소를 "산책" 하는
 *       곳으로 적은 문장은 버린다</li>
 *   <li><b>지형 · 시설은 이름 · 분류에 있을 때만 말한다 (#1172).</b> 후보 데이터에는 개요가 없어서
 *       (dev 의 여행지 원천은 개요가 "관광지" 한 낱말이다) 모델이 이름에서 짐작한다 — 용두암을
 *       "용암 동굴 탐방", 서귀포해양도립공원을 "수영장 주변 산책로" 로 적었다. 동굴 · 수영장 · 정상 ·
 *       전망 같은 주장은 장소 이름 · 분류 · 유형에 그 낱말이 있을 때만 남긴다</li>
 * </ul>
 *
 * <p><b>문장 단위로 걷는다.</b> 메모 한 줄에 맞는 말과 틀린 말이 섞여 있는 일이 흔하다 —
 * 통째로 버리면 맞는 말까지 잃는다. 남는 문장이 없으면 근거는 버리고, 메모는 후보 데이터로
 * 만든 서버 문구로 바꾼다. 장소가 없는 항목(식사 자리 · 이동)은 메모를 비운다 — 지어 채울 사실이 없다.
 *
 * <p>항목 종류는 {@link OllamaLlmAdapter} 가 후보 분류로 정해 둔다(숙박 → {@code LODGING}, #1128). 그날 밤
 * 숙소(모델이 적은 {@code lodging} 번호)도 어댑터가 그날 끝에 {@code LODGING} 항목으로 붙여 넘긴다.
 * 이 클래스는 그 결과를 믿고 {@code itemType} 으로 숙박을 가른다 — <b>마지막 날 숙박을 빼는 규칙은 여기 하나다.</b>
 */
@Slf4j
final class AiPlanDraftFactGuard {

    /** 후보의 {@code contentTypeName}. tour-service {@code ContentType} 의 표시명이다. */
    static final String LODGING_CONTENT_TYPE = "숙박";
    static final String RESTAURANT_CONTENT_TYPE = "음식점";

    /**
     * 숙소 항목의 서버 문구. 메모가 통째로 빠졌을 때와, 어댑터가 그날 {@code lodging} 번호로 숙박 항목을
     * 붙일 때 같이 쓴다 — 모델은 숙소 메모를 쓰지 않는다 (#1128).
     */
    static final String LODGING_NOTE = "반려견과 함께 묵는 숙소예요.";

    /** 이 온도 이상인 날만 "덥다" 고 말할 수 있다. 프롬프트의 "최고기온 31℃ 이상인 날" 과 같은 값이다. */
    static final double HOT_DAY_MAX_TEMPERATURE = 31.0d;

    /** 모델이 근거를 가질 수 없는 근거 코드. 거리 · 혼잡은 프롬프트에 실리지 않는다. */
    private static final Set<String> UNVERIFIABLE_REASON_CODES = Set.of("SHORT_DISTANCE", "LOW_CONGESTION");

    /*
      문장 판정 패턴. **낱말이 아니라 주장을 잡는다.** "야외" 한 낱말로 자르면 실내 카페의
      "비가 오면 야외 대신 실내에서 쉬어요" 가 지워지고, "가까워" 로 자르면 해변의 "바다와 가까워 걷기
      좋아요" 가 지워진다 — 둘 다 맞는 문장이다. 그래서 거리는 <b>장소 사이</b>의 거리를, 실내외는
      <b>이 장소가 무엇이다</b>라는 서술을, 산책은 <b>산책하는 곳이다</b>라는 서술을 잡는다.
     */
    private static final Pattern DISTANCE_CLAIM = Pattern.compile(
        "이동\\s*거리|이동이\\s*(짧|적|길지)|동선이\\s*(짧|가깝|가까)|거리가\\s*(짧|가깝|가까)|가까운\\s*거리"
            + "|(장소|일정|곳)\\s*(사이|간)[^.!?]*?(가까|가깝|짧|멀지)|멀지\\s*않");
    private static final Pattern CONGESTION_CLAIM = Pattern.compile(
        "혼잡|붐비지|붐비는|한적|사람이\\s*(적|많)|인파|북적");
    private static final Pattern HEAT_CLAIM = Pattern.compile(
        "더위|더운|폭염|무더|뙤약|한낮의\\s*열|햇볕이\\s*뜨거|뜨거운\\s*(햇볕|햇살|날씨|한낮|낮)");
    /**
     * 반려견 성향 표현. 프롬프트가 입력으로 준 사실이라 날씨와 무관하게 말할 수 있다 —
     * 23℃ 에도 "더위에 약한 초코를 위해 그늘 위주로 짰어요" 는 맞는 문장이다. 더위 판정 전에 지운다.
     */
    private static final Pattern HEAT_TRAIT = Pattern.compile("더위에\\s*(민감|약|취약)");
    private static final Pattern OUTDOOR_ASSERTION = Pattern.compile(
        "(야외|실외)\\s*(장소|공간|명소|관광지|시설)|(야외|실외)(라|여서|이라|이어서|예요|이에요)");
    private static final Pattern INDOOR_ASSERTION = Pattern.compile(
        "실내\\s*(장소|공간|명소|관광지|시설)|실내(라|여서|이라|이어서|예요|이에요)");
    private static final Pattern WALK_PLACE_ASSERTION = Pattern.compile(
        "산책(을|하기)?\\s*(할\\s*수\\s*있는|하기\\s*좋은|좋은)[^.!?]*?(곳|장소|공간|카페|숙소)|산책\\s*(장소|코스|명소)");

    /**
     * 지형 · 시설 주장과, 그 주장을 뒷받침하는 이름 · 분류 · 유형 낱말 (#1172).
     *
     * <p>주소는 근거로 보지 않는다 — 지번의 {@code 산 12-1} 이 "산" 이 된다. 정상은 이름에 산 · 오름이
     * 있을 때만이다. 수월봉을 "산 정상에서 바다 전망" 으로 적은 것이 실측 사례라 봉은 넣지 않았다.
     */
    private static final List<FeatureClaim> FEATURE_CLAIMS = List.of(
        new FeatureClaim(Pattern.compile("동굴"), List.of("굴")),
        new FeatureClaim(Pattern.compile("수영"), List.of("수영장", "해수욕장")),
        new FeatureClaim(Pattern.compile("정상|등반|등산"), List.of("산", "오름")),
        new FeatureClaim(Pattern.compile("전망"), List.of("전망", "뷰")),
        new FeatureClaim(Pattern.compile("폭포"), List.of("폭포")),
        new FeatureClaim(Pattern.compile("계곡"), List.of("계곡")),
        new FeatureClaim(Pattern.compile("등대"), List.of("등대")),
        new FeatureClaim(Pattern.compile("해변|백사장|모래사장"), List.of("해변", "해수욕장", "해안", "비치")));

    /** 문장 경계. 마침표 · 물음표 · 느낌표 뒤 공백에서 자른다 — {@code 3.5km} 같은 소수점은 자르지 않는다. */
    private static final Pattern SENTENCE_BOUNDARY = Pattern.compile("(?<=[.!?])\\s+");

    private final Map<Long, PlaceCandidate> candidateById;
    private final int dayCount;
    /** 일차 → 그날 최고기온. 값이 없으면 그날 전망이 없는 것이다. */
    private final Map<Integer, Double> maxTemperatureByDay;

    AiPlanDraftFactGuard(Map<Long, PlaceCandidate> candidateById, int dayCount,
                         Map<Integer, Double> maxTemperatureByDay) {
        this.candidateById = candidateById;
        this.dayCount = dayCount;
        this.maxTemperatureByDay = maxTemperatureByDay;
    }

    AiPlanDraft apply(AiPlanDraft draft) {
        Counts counts = new Counts();
        List<AiPlanDraftDay> days = draft.days() == null ? List.of() : draft.days().stream()
            .map(day -> guardDay(day, counts))
            .toList();
        List<AiPlanDraftReason> reasons = draft.reasons() == null ? List.of() : draft.reasons().stream()
            .map(reason -> guardReason(reason, counts))
            .filter(Objects::nonNull)
            .toList();
        counts.report();
        return AiPlanDraft.builder().days(days).reasons(reasons).build();
    }

    private AiPlanDraftDay guardDay(AiPlanDraftDay day, Counts counts) {
        boolean lastDay = day.day() >= dayCount;
        boolean hotDay = isHot(maxTemperatureByDay.get(day.day()));
        List<AiPlanDraftItem> items = new ArrayList<>();
        for (AiPlanDraftItem item : day.items() == null ? List.<AiPlanDraftItem>of() : day.items()) {
            if (lastDay && item.itemType() == PlanItemType.LODGING) {
                counts.lastDayLodging++;
                log.warn("LLM put lodging on the last day day={} placeId={} title={} - dropped",
                    day.day(), item.placeId(), item.title());
                continue;
            }
            items.add(guardNote(item, hotDay, counts));
        }
        return AiPlanDraftDay.builder().day(day.day()).items(items).build();
    }

    private AiPlanDraftItem guardNote(AiPlanDraftItem item, boolean hotDay, Counts counts) {
        if (item.note() == null) {
            return item;
        }
        PlaceCandidate place = item.placeId() == null ? null : candidateById.get(item.placeId());
        String kept = keepSentences(item.note(), sentence -> contradictsItem(sentence, place, hotDay));
        if (kept != null && kept.equals(item.note())) {
            return item;
        }
        counts.notesTrimmed++;
        String note = kept != null ? kept : fallbackNote(place);
        log.info("LLM note contradicted server facts placeId={} before={} after={}", item.placeId(), item.note(), note);
        return AiPlanDraftItem.builder()
            .itemType(item.itemType())
            .placeId(item.placeId())
            .title(item.title())
            .note(note)
            .build();
    }

    private boolean contradictsItem(String sentence, PlaceCandidate place, boolean hotDay) {
        if (isUnverifiable(sentence) || (!hotDay && claimsHeat(sentence))) {
            return true;
        }
        if (place == null) {
            return false;
        }
        if (Boolean.TRUE.equals(place.indoor()) && OUTDOOR_ASSERTION.matcher(sentence).find()) {
            return true;
        }
        if (Boolean.FALSE.equals(place.indoor()) && INDOOR_ASSERTION.matcher(sentence).find()) {
            return true;
        }
        String facts = placeFacts(place);
        if (FEATURE_CLAIMS.stream().anyMatch(feature -> feature.ungrounded(sentence, facts))) {
            return true;
        }
        // 숙소 · 음식점을 산책하는 곳이라고 적은 문장. 콘도가 "해안가에서 가벼운 산책을 할 수 있는 실외 장소" 가
        // 됐었다. "산책 뒤에 들러요" 처럼 순서를 말하는 문장은 맞으므로 남긴다.
        boolean staysOrEats = LODGING_CONTENT_TYPE.equals(place.contentTypeName())
            || RESTAURANT_CONTENT_TYPE.equals(place.contentTypeName());
        return staysOrEats && WALK_PLACE_ASSERTION.matcher(sentence).find();
    }

    /** 지형 · 시설 주장의 근거가 될 수 있는 후보 사실. 이름 · 원천 분류 · 유형만이다. */
    private static String placeFacts(PlaceCandidate place) {
        return String.join(" ", Objects.toString(place.title(), ""),
            Objects.toString(place.sourceCategory(), ""), Objects.toString(place.contentTypeName(), ""));
    }

    private static boolean claimsHeat(String sentence) {
        return HEAT_CLAIM.matcher(HEAT_TRAIT.matcher(sentence).replaceAll("")).find();
    }

    private AiPlanDraftReason guardReason(AiPlanDraftReason reason, Counts counts) {
        if (reason.code() != null && UNVERIFIABLE_REASON_CODES.contains(reason.code())) {
            counts.reasonsDropped++;
            log.info("LLM reason cannot be verified code={} description={} - dropped", reason.code(), reason.description());
            return null;
        }
        if (reason.description() == null) {
            return reason;
        }
        boolean hotTrip = maxTemperatureByDay.values().stream().anyMatch(AiPlanDraftFactGuard::isHot);
        String kept = keepSentences(reason.description(),
            sentence -> isUnverifiable(sentence) || (!hotTrip && claimsHeat(sentence)));
        if (kept == null) {
            counts.reasonsDropped++;
            log.info("LLM reason contradicted server facts code={} description={} - dropped",
                reason.code(), reason.description());
            return null;
        }
        if (kept.equals(reason.description())) {
            return reason;
        }
        counts.reasonsTrimmed++;
        return AiPlanDraftReason.builder().code(reason.code()).name(reason.name()).description(kept).build();
    }

    private boolean isUnverifiable(String sentence) {
        return DISTANCE_CLAIM.matcher(sentence).find() || CONGESTION_CLAIM.matcher(sentence).find();
    }

    /**
     * 모순인 문장을 뺀 나머지. 남는 문장이 없으면 null 이다.
     *
     * <p>하나도 빠지지 않았으면 <b>원문을 그대로</b> 돌려준다 — 공백을 다시 이어 붙인 문자열과
     * 원문이 달라 "바뀌었다" 로 세는 일이 없게 한다.
     */
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

    /**
     * 메모가 통째로 빠졌을 때 쓰는 서버 문구. <b>후보 데이터에 적힌 것만</b> 말한다.
     *
     * <p>장소 이름을 넣지 않는다 — 조사가 받침에 따라 갈려서(#233 의 {@code 애월코스트34은})
     * 이름 뒤에 붙일 말을 고를 수 없다. 이름은 바로 위 제목에 있다.
     */
    private static String fallbackNote(PlaceCandidate place) {
        if (place == null) {
            return null;
        }
        if (LODGING_CONTENT_TYPE.equals(place.contentTypeName())) {
            return LODGING_NOTE;
        }
        if (RESTAURANT_CONTENT_TYPE.equals(place.contentTypeName())) {
            return "반려견과 함께 들르는 음식점·카페예요.";
        }
        if (place.indoor() == null) {
            return "반려견과 함께 들르는 장소예요.";
        }
        return place.indoor() ? "반려견과 함께 들르는 실내 장소예요." : "반려견과 함께 들르는 실외 장소예요.";
    }

    private static boolean isHot(Double maxTemperature) {
        return maxTemperature != null && maxTemperature >= HOT_DAY_MAX_TEMPERATURE;
    }

    /** 이 주장을 했는데 장소 사실에 근거 낱말이 하나도 없으면 지어낸 것이다. */
    private record FeatureClaim(Pattern claim, List<String> grounds) {

        boolean ungrounded(String sentence, String facts) {
            return claim.matcher(sentence).find() && grounds.stream().noneMatch(facts::contains);
        }
    }

    /** 무엇을 얼마나 걷었는지. 계속 늘면 프롬프트가 아니라 입력(후보 · 전망)을 볼 신호다. */
    private static final class Counts {
        private int lastDayLodging;
        private int notesTrimmed;
        private int reasonsTrimmed;
        private int reasonsDropped;

        private void report() {
            if (lastDayLodging + notesTrimmed + reasonsTrimmed + reasonsDropped == 0) {
                return;
            }
            log.warn("LLM plan corrected against server facts lastDayLodging={} notesTrimmed={} reasonsTrimmed={} reasonsDropped={}",
                lastDayLodging, notesTrimmed, reasonsTrimmed, reasonsDropped);
        }
    }
}
