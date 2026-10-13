package com.hondigagae.domainlayer.planner.application.model;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 사용자 요청 문구에서 후보 풀이 맞춰야 하는 명시 조건 (#1170).
 *
 * <p>자유 서술 전체를 해석하지 않는다. "실내", "카페" 처럼 장소 데이터(실내 여부 · 분류)로
 * 확인할 수 있는 낱말만 본다. 그 밖의 요청("바다 보며 산책")은 지금처럼 프롬프트 문장으로만 남는다.
 *
 * <p><b>부정과 반려견 습관 표현은 요청이 아니다 (#1423).</b> 낱말이 들어 있기만 하면 요청으로 읽어서 "카페 말고 바다
 * 위주로" · "카페는 별로예요" 에도 날마다 카페를 넣고 "요청하신 카페를 날마다 넣었어요" 라고 했다. 부정 판정은 지역과 같은
 * {@link RequestNoteNegation} 이다 — 낱말이 여러 번 나오면 <b>하나라도 부정되지 않았으면</b> 그 조건을 묻는 것이다.
 * "실내견이라" · "실내 배변만 해요" 처럼 반려견이 사는 방식을 말하는 실내는 읽지 않는다.
 */
public record RequestNoteConstraints(boolean cafe, boolean indoor) {

    /** tour-service 장소 검색의 {@code sourceCategory} 완전 일치 값. */
    public static final String CAFE_CATEGORY = "카페";

    /** 숙소의 {@code contentTypeName}. 실내 휴식 요청을 숙소가 대신하지 않게 가른다. */
    public static final String LODGING_CONTENT_TYPE = "숙박";

    private static final Pattern CAFE = Pattern.compile(CAFE_CATEGORY);

    /**
     * 실내 — 반려견 습관 표현(실내견 · 실내 배변 · 실내 생활)은 뺀다. 장소를 고를 조건이 아니라 아이의 성향이다.
     * "실내 견학" 은 장소 요청이라 남긴다.
     */
    private static final Pattern INDOOR = Pattern.compile("실내(?!\\s*(?:견(?!학)|배변|생활))");

    /** 한 말로 묶는 사이 — 공백 · 탭만. 줄바꿈은 부정 판정에서 절의 끝이라 여기서도 묶지 않는다. */
    private static final Pattern SAME_PHRASE_GAP = Pattern.compile("[ \\t]*");

    public static RequestNoteConstraints from(String requestNote) {
        if (requestNote == null || requestNote.isBlank()) {
            return new RequestNoteConstraints(false, false);
        }
        List<Mention> mentions = new ArrayList<>();
        collect(requestNote, CAFE, true, mentions);
        collect(requestNote, INDOOR, false, mentions);
        mentions.sort(Comparator.comparingInt(Mention::start));

        boolean cafe = false;
        boolean indoor = false;
        int index = 0;
        while (index < mentions.size()) {
            // 공백만 사이에 둔 낱말은 한 말이다 — "실내 카페 말고" 의 부정은 실내에도 걸린다
            int last = index;
            while (last + 1 < mentions.size() && SAME_PHRASE_GAP.matcher(
                requestNote.substring(mentions.get(last).end(), mentions.get(last + 1).start())).matches()) {
                last++;
            }
            int nextStart = last + 1 < mentions.size() ? mentions.get(last + 1).start() : requestNote.length();
            if (!RequestNoteNegation.negatedAfter(requestNote, mentions.get(last).end(), nextStart)) {
                for (Mention mention : mentions.subList(index, last + 1)) {
                    cafe |= mention.cafe();
                    indoor |= !mention.cafe();
                }
            }
            index = last + 1;
        }
        return new RequestNoteConstraints(cafe, indoor);
    }

    private static void collect(String requestNote, Pattern pattern, boolean cafe, List<Mention> mentions) {
        Matcher matcher = pattern.matcher(requestNote);
        while (matcher.find()) {
            mentions.add(new Mention(matcher.start(), matcher.end(), cafe));
        }
    }

    /** 요청 문구에 나온 낱말 하나. {@code cafe} 가 아니면 실내다. */
    private record Mention(int start, int end, boolean cafe) {
    }

    public boolean asksAnything() {
        return cafe || indoor;
    }

    /** 실내를 요청했을 때만 검색 필터. 아니면 조건을 걸지 않는다. */
    public Boolean indoorFilter() {
        return indoor ? Boolean.TRUE : null;
    }

    /** 카페를 요청했을 때만 검색 필터. */
    public String categoryFilter() {
        return cafe ? CAFE_CATEGORY : null;
    }

    public static boolean isCafe(PlaceCandidate candidate) {
        return candidate.sourceCategory() != null && candidate.sourceCategory().contains(CAFE_CATEGORY);
    }

    /**
     * 찾아갈 실내 장소. 숙소는 실내여도 빠진다 — "오후엔 실내 카페" 의 자리가 숙소뿐이면
     * 요청을 반영한 것이 아니다.
     */
    public static boolean isIndoorVisit(PlaceCandidate candidate) {
        return Boolean.TRUE.equals(candidate.indoor())
            && !LODGING_CONTENT_TYPE.equals(candidate.contentTypeName());
    }

    /** 실내와 카페를 함께 요청했으면 한 장소가 둘 다여야 한다. */
    public boolean matches(PlaceCandidate candidate) {
        if (cafe && indoor) {
            return isCafe(candidate) && isIndoorVisit(candidate);
        }
        if (cafe) {
            return isCafe(candidate);
        }
        if (indoor) {
            return isIndoorVisit(candidate);
        }
        return false;
    }
}
