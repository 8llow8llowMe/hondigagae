package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline.PlanOutlineDay;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 준비물의 여행 맥락 — 여행 날짜가 걸친 달, 제주 여행인가, 배로 들어가는 섬 (#1435).
 *
 * <p>사용성 테스트(dev, 11/6~8 제주 2박3일, 웰시코기 12kg)의 준비물이 기본 5개뿐이었다. 1일차 첫 장소가 배로 들어가는
 * 비양도인데 이동장 · 탑승 조건이 없었고, 제주 입도 안내도, 11월 계절 품목도 없었다 — 여행이 열흘 뒤라 예보가 없었다.
 * 예보 · 일정 · 반려견 특성만 사실로 보던 규칙에 이 여행의 맥락 셋을 더한다.
 *
 * <p>규칙({@link PackingListRules})과 프롬프트({@link AiPlanPromptFactory#packingUserPrompt})가 <b>같은 판정을 쓰도록 한 곳에
 * 둔다.</b> 프롬프트가 "1일차 비양도" 를 실었는데 규칙이 그 섬을 사실로 보지 않으면, 모델이 시킨 대로 쓴 이유가 버려진다.
 *
 * <h2>섬은 제목으로 판정한다</h2>
 *
 * 일정 개요에는 제목 · 항목 종류 · 장소 아이디뿐이라 좌표로 판정할 수 없다. 장소({@code PLACE}) · 산책({@code WALK}) 항목의
 * 제목에 {@link #ISLANDS} 의 이름이 들어 있으면 그날 그 섬에 간다고 본다. 식사 · 숙박 · 이동 항목은 보지 않는다 — 제주시의
 * "마라도횟집" 같은 식당 이름이 섬으로 잡힌다. 본섬에서 하는 일로 확인된 제목({@link #MAINLAND_TITLES})도 뺀다. <b>한계:</b>
 * 제목에 섬 이름이 없는 섬 안 장소(우도의 카페 등)는 놓치고, 확인되지 않은 본섬 장소는 섬 이름이 들어 있으면 섬으로 잡는다.
 *
 * <h2>입도 수단은 모른다</h2>
 *
 * 일정에 항공편 · 배편 정보가 없다. 그래서 제주 여행이면 "비행기나 배" 를 함께 말하고 수단을 단정하지 않는다 — 입도 안내가
 * 기본 경로다.
 */
final class PackingTripContext {

    /** 제주의 관광 지역코드. {@code AiPlanWorker} 의 권역 판정과 같은 값이다. */
    static final String JEJU_AREA_CODE = "39";

    /**
     * 배로 들어가는 제주의 부속 섬. <b>모두 '도' 로 끝나 받침이 없다</b> — 이유 문장이 조사 '는' 을 붙인다. 받침 있는 이름을
     * 더하면 조사를 다시 본다.
     */
    static final List<String> ISLANDS = List.of("우도", "비양도", "가파도", "마라도", "추자도", "차귀도");

    /** 섬을 보는 항목 종류. 식사 · 숙박 · 이동 항목의 제목은 섬에 간다는 뜻이 아니다. */
    private static final Set<PlanItemType> ISLAND_ITEM_TYPES = EnumSet.of(PlanItemType.PLACE, PlanItemType.WALK);

    /**
     * 섬 이름이 들어 있어도 본섬에서 하는 일인 장소. dev place 표(2026-10-14)에서 섬 이름이 든 제목 중 주소가 섬이 아닌 곳은
     * 14곳이었고, 그중 배를 타지 않는 것은 성산(본섬)에서 출발하는 {@code 우도잠수함} 하나였다. 여객선 · 유람선 · 선착장 · 요트 ·
     * 바다낚시("마라도가는여객선", "차귀도유람선", "비양도선착장" …)는 주소가 본섬이어도 실제로 배를 타므로 섬으로 둔다.
     */
    private static final Pattern MAINLAND_TITLES = Pattern.compile("우도\\s*잠수함");

    /** 1년이 넘는 기간이어도 달은 12개다. 날짜가 어긋난 입력에서 오래 돌지 않게 끊는다. */
    private static final int MAX_MONTHS = 12;

    private final LocalDate startDate;
    private final LocalDate endDate;
    private final List<Integer> months;
    private final boolean jeju;
    private final List<IslandVisit> islands;

    private PackingTripContext(LocalDate startDate, LocalDate endDate, boolean jeju, List<IslandVisit> islands) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.months = monthsBetween(startDate, endDate);
        this.jeju = jeju;
        this.islands = islands;
    }

    static PackingTripContext of(PackingChecklistQuery query) {
        LocalDate start = parseOrNull(query.startDate());
        LocalDate end = parseOrNull(query.endDate());
        // 끝을 모르거나 시작보다 앞이면 하루짜리로 본다 — 준비물 규칙의 일수 계산과 같다.
        if (start != null && (end == null || end.isBefore(start))) {
            end = start;
        }
        PlanOutline outline = query.planOutline();
        boolean jeju = outline != null && JEJU_AREA_CODE.equals(outline.areaCode());
        return new PackingTripContext(start, end, jeju, islandsOf(outline));
    }

    /** 여행 날짜를 아는가. 모르면 계절을 판정하지 않는다 — 모르는 것을 지어내지 않는다. */
    boolean knowsDates() {
        return startDate != null;
    }

    /** 여행 날짜가 걸친 달, 날짜 순. 날짜를 모르면 비어 있다. */
    List<Integer> months() {
        return months;
    }

    boolean jeju() {
        return jeju;
    }

    /** 배로 들어가는 섬, 일차 순. 같은 섬은 처음 가는 날 하나만 남긴다. */
    List<IslandVisit> islands() {
        return islands;
    }

    /** 여행 기간 안의 날짜를 가진 예보가 하나라도 있는가. 날짜를 모르면 없다고 본다. */
    boolean hasForecastWithinTrip(List<DayWeatherOutlook> outlooks) {
        if (startDate == null) {
            return false;
        }
        return outlooks.stream()
            .map(DayWeatherOutlook::date)
            .anyMatch(date -> date != null && !date.isBefore(startDate) && !date.isAfter(endDate));
    }

    /** 걸친 달 중 {@code candidates} 에 드는 첫 달. 날짜 순이라 여행 날짜 중 처음 그 조건을 만족하는 날의 달이다. */
    Optional<Integer> firstMonthIn(Set<Integer> candidates) {
        return months.stream().filter(candidates::contains).findFirst();
    }

    /** {@code 11월(가을)}, 걸친 달이 둘 이상이면 {@code 2월(겨울)~3월(봄)}. 날짜를 모르면 비어 있다. */
    Optional<String> seasonLabel() {
        if (months.isEmpty()) {
            return Optional.empty();
        }
        String first = monthLabel(months.get(0));
        return Optional.of(months.size() == 1 ? first : first + "~" + monthLabel(months.get(months.size() - 1)));
    }

    /** {@code 1일차 비양도 · 3일차 우도} 처럼 일차와 섬을 잇는다. 구분자는 쓰는 곳(이유 · 프롬프트)이 정한다. */
    String islandLabel(String delimiter) {
        return islands.stream().map(visit -> visit.day() + "일차 " + visit.name()).collect(Collectors.joining(delimiter));
    }

    /** 달의 계절. 3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울. */
    static String seasonOf(int month) {
        return switch (month) {
            case 3, 4, 5 -> "봄";
            case 6, 7, 8 -> "여름";
            case 9, 10, 11 -> "가을";
            default -> "겨울";
        };
    }

    private static String monthLabel(int month) {
        return month + "월(" + seasonOf(month) + ")";
    }

    private static List<Integer> monthsBetween(LocalDate start, LocalDate end) {
        if (start == null) {
            return List.of();
        }
        Set<Integer> months = new LinkedHashSet<>();
        YearMonth last = YearMonth.from(end);
        for (YearMonth month = YearMonth.from(start); !month.isAfter(last) && months.size() < MAX_MONTHS; month = month.plusMonths(1)) {
            months.add(month.getMonthValue());
        }
        return List.copyOf(months);
    }

    private static List<IslandVisit> islandsOf(PlanOutline outline) {
        if (outline == null) {
            return List.of();
        }
        List<IslandVisit> visits = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        outline.safeDays().stream()
            .sorted(Comparator.comparingInt(PlanOutlineDay::day))
            .forEach(day -> day.safeItems().stream()
                .filter(item -> item.title() != null && PlanItemType.from(item.itemType()).filter(ISLAND_ITEM_TYPES::contains).isPresent())
                .filter(item -> !MAINLAND_TITLES.matcher(item.title()).find())
                .forEach(item -> ISLANDS.stream()
                    .filter(island -> item.title().contains(island))
                    .filter(seen::add)
                    .forEach(island -> visits.add(new IslandVisit(day.day(), island)))));
        return List.copyOf(visits);
    }

    private static LocalDate parseOrNull(String date) {
        try {
            return date == null ? null : LocalDate.parse(date);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    /** 그날 배로 들어가는 섬. */
    record IslandVisit(int day, String name) {
    }
}
