package com.hondigagae.domainlayer.planner.application.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 사용자 요청 문구에 적힌 지역 (#1423).
 *
 * <p>요청 문구는 프롬프트 한 줄로만 들어갔고, 제주 전체 요청이면 그 아래에 요청과 무관한 권역 순서 제안(#1257)이
 * 실렸다 — "성산 쪽 위주로" 라고 적어도 1일차 북서부 → 2일차 남서부 순서가 그 요청을 덮었고, 후보 풀도 6권역에 고르게
 * 깔렸다. 실내 · 카페(#1170)처럼 <b>장소 데이터로 확인되는 낱말만</b> 읽는다 — 여기서는 지명 사전의 낱말과 그 권역
 * ({@link JejuZone})이다. 그 밖의 자유 서술은 지금처럼 프롬프트 문장으로만 남는다.
 *
 * <ul>
 *   <li><b>경계에 걸친 낱말은 주 권역 하나로 둔다.</b> 옆 권역은 {@link #reach()} 가 흡수한다</li>
 *   <li><b>긴 낱말부터 맞추고, 맞춘 구간은 지운 뒤 다음을 본다</b> — "북동부" 가 "동부" 로 한 번 더 걸리지 않게.
 *       "서귀포시" 는 "서귀포" 로 걸린다</li>
 *   <li><b>부정은 바로 뒤만 본다</b> ({@link RequestNoteNegation}) — 낱말 뒤 20자 안(쉼표 · 마침표 · 줄바꿈과 다음 낱말을
 *       넘지 않는다)에 {@code 말고 · 빼고 · 제외 · 싫 · 별로 · 아닌 · 아니라 · 아니고} 가 있으면 그 낱말을 버린다. "애월 말고
 *       서귀포" 는 남부만이다</li>
 *   <li><b>맨몸 방향어({@code 서부 · 동부 · 남부 · 북부})는 앞뒤 경계를 본다</b> — "공항에서부터" · "운동부족" · "남부럽지" ·
 *       "서부두" 에 걸렸다. 앞은 한글이 아니거나 {@code 제주}, 뒤는 한글이 아니거나 {@code 쪽 · 권 · 지역 · 해안 · 위주 · 로 ·
 *       에 · 은 · 는 · 만 · 으로 · 일주 · 해변 · 여행} 이어야 한다. {@code 서쪽} 같은 꼴과 세 글자 권역 이름은 그대로다</li>
 *   <li><b>낱말은 사전의 대표 낱말로 적는다</b> — {@code 서부} 는 {@code 서쪽}, {@code 산남} 은 {@code 남쪽}. "서쪽, 서부" 처럼
 *       같은 뜻이 두 번 적히지 않는다</li>
 *   <li><b>{@code 제주} · {@code 제주도} 단독은 섬 전체라 좁히지 않는다.</b> {@code 제주시} 는 북부다. 한라산은 어느
 *       권역에도 넣지 않는다 — 북 · 남 줄의 경계(위도 33.36)가 정상을 지나 한 권역이라 할 수 없다</li>
 *   <li><b>다른 말 속 글자에 걸리는 이름은 앞뒤를 본다</b> — {@code 사계절}(사계) · {@code 키우도록}(우도) ·
 *       {@code 10월정도}(월정). {@code 한경} 단독은 {@code 편한경로} 에 걸려 {@code 한경면} 만 쓴다. FE 지역 칩 제안
 *       ({@code frontend/src/lib/ai-plan/region-hint.ts}, #1381)과 같은 오탐 처리다</li>
 * </ul>
 *
 * @param words 요청에서 읽은 낱말. 나온 순서, 중복 없음
 * @param zones 그 낱말들의 권역. 선언 순서
 */
public record RequestedRegion(List<String> words, Set<JejuZone> zones) {

    /** 지역을 묻지 않은 요청. 하루 재생성도 이것이다 — 기존 일정이 앞뒤 동선을 정한다. */
    public static final RequestedRegion NONE = new RequestedRegion(List.of(), Set.of());

    /** 맨몸 방향어의 앞 — 한글이 아니거나(문장 시작 · 공백 · 문장부호) 바로 앞이 "제주". "운동부족" 의 동부가 아니다. */
    private static final String HALF_BEFORE = "(?:(?<![가-힣])|(?<=제주))";

    /**
     * 맨몸 방향어의 뒤 — 다른 말이 이어지는 글자만 막는다("남부럽지" · "남부끄럽" · "서부두" · "이동부터" · "운동부족" ·
     * "이동부담"). 허용 목록으로 두면 "동부를" · "서부랑 남부" 처럼 흔한 조사를 놓쳐, 함께 쓴 다른 낱말 쪽으로만 좁혔다.
     * 앞 경계({@link #HALF_BEFORE})가 이미 "에서부터" · "운동부족" 을 거른다.
     */
    private static final String HALF_AFTER = "(?![럽끄두터족담])";

    private static final Set<JejuZone> NORTH_WEST = Set.of(JejuZone.NORTH_WEST);
    private static final Set<JejuZone> NORTH = Set.of(JejuZone.NORTH);
    private static final Set<JejuZone> NORTH_EAST = Set.of(JejuZone.NORTH_EAST);
    private static final Set<JejuZone> SOUTH_WEST = Set.of(JejuZone.SOUTH_WEST);
    private static final Set<JejuZone> SOUTH = Set.of(JejuZone.SOUTH);
    private static final Set<JejuZone> SOUTH_EAST = Set.of(JejuZone.SOUTH_EAST);

    /**
     * 낱말 사전. <b>긴 낱말이 앞이다</b>({@link Term#length} 내림차순, 같으면 선언 순서) — 정렬은 {@link #TERMS} 가 한다.
     * 권역 경계는 {@link JejuZone#of} 의 경도 126.42 · 126.68, 위도 33.36(한라산)이다.
     */
    private static final List<Term> DICTIONARY = List.of(
        // 북서부 — 애월 · 한림
        Term.of("애월", NORTH_WEST), Term.of("곽지", NORTH_WEST), Term.of("한림", NORTH_WEST),
        Term.of("협재", NORTH_WEST), Term.of("금능", NORTH_WEST), Term.of("하귀", NORTH_WEST),
        // 남서부 — 한경 · 대정 · 안덕 · 중문. 한경 단독은 "편한경로" 에 걸린다
        Term.of("한경면", SOUTH_WEST), Term.guarded("고산", "(?<!최)고산", SOUTH_WEST), Term.of("수월봉", SOUTH_WEST),
        Term.of("대정", SOUTH_WEST), Term.of("모슬포", SOUTH_WEST), Term.of("안덕", SOUTH_WEST),
        Term.of("산방산", SOUTH_WEST), Term.of("가파도", SOUTH_WEST), Term.of("마라도", SOUTH_WEST),
        Term.of("중문", SOUTH_WEST), Term.guarded("사계", "사계(?!절)", SOUTH_WEST),
        // 남부 — 서귀포 시내
        Term.of("서귀포", SOUTH), Term.of("천지연", SOUTH), Term.of("쇠소깍", SOUTH), Term.of("위미", SOUTH),
        // 남동부
        Term.of("남원", SOUTH_EAST), Term.of("표선", SOUTH_EAST),
        // 북동부 — 구좌 · 성산 · 우도
        Term.of("성산", NORTH_EAST), Term.of("섭지코지", NORTH_EAST), Term.of("일출봉", NORTH_EAST),
        Term.guarded("우도", "우도(?!록)", NORTH_EAST), Term.of("구좌", NORTH_EAST), Term.of("세화", NORTH_EAST),
        Term.guarded("월정", "(?<!\\d)월정(?!도)", NORTH_EAST), Term.of("김녕", NORTH_EAST),
        Term.of("비자림", NORTH_EAST),
        /*
          북부 — 제주 시내 · 조천. 제주 · 제주도 단독은 섬 전체다. **공항은 넣지 않는다** — "공항에서 렌트해서 다녀요" 처럼
          지역이 아니라 출발점을 말하는 문장이 흔하다. 연동도 "일정 연동" 같은 말에 걸려 뺐다(제주시가 그 자리를 덮는다).
        */
        // 짧은 지명은 붙여 쓴 말을 피한다 — "이호텔 근처로"(이호) · "강아지도두마리"(도두)
        Term.of("제주시", NORTH), Term.of("노형", NORTH), Term.guarded("이호", "이호(?!텔)", NORTH),
        Term.guarded("도두", "도두(?!\\s?마리)", NORTH), Term.of("조천", NORTH), Term.of("함덕", NORTH),
        // 권역 이름 — JejuZone 의 displayName 과 같다. 세 글자 방향어도 한 권역이다("남서쪽" 이 "서쪽" 으로 읽혀 북서부까지 들었다)
        Term.of("북서부", NORTH_WEST), Term.of("북동부", NORTH_EAST), Term.of("남서부", SOUTH_WEST),
        Term.of("남동부", SOUTH_EAST), Term.of("북서쪽", NORTH_WEST), Term.of("북동쪽", NORTH_EAST),
        Term.of("남서쪽", SOUTH_WEST), Term.of("남동쪽", SOUTH_EAST),
        // 방향어 — 섬의 한쪽 해안 전체. 맨몸 꼴(서부 · 동부 · 남부 · 북부)은 앞뒤 경계를 본다
        Term.guarded("서쪽", "서쪽|" + half("서부"), Set.of(JejuZone.NORTH_WEST, JejuZone.SOUTH_WEST)),
        Term.guarded("동쪽", "동쪽|" + half("동부"), Set.of(JejuZone.NORTH_EAST, JejuZone.SOUTH_EAST)),
        Term.guarded("남쪽", "남쪽|산남|" + half("남부"), Set.of(JejuZone.SOUTH_WEST, JejuZone.SOUTH, JejuZone.SOUTH_EAST)),
        Term.guarded("북쪽", "북쪽|산북|" + half("북부"), Set.of(JejuZone.NORTH_WEST, JejuZone.NORTH, JejuZone.NORTH_EAST))
    );

    /** 긴 낱말부터 맞추는 순서. 정렬은 안정적이라 길이가 같으면 사전 선언 순서다. */
    private static final List<Term> TERMS =
        DICTIONARY.stream().sorted(Comparator.comparingInt(Term::length).reversed()).toList();

    public RequestedRegion {
        words = words == null ? List.of() : List.copyOf(words);
        // 선언 순서를 지킨다 — 프롬프트가 이 순서로 권역을 적고, 같은 요청이면 같은 프롬프트여야 한다 (#1321)
        zones = zones == null || zones.isEmpty() ? Set.of() : Collections.unmodifiableSet(EnumSet.copyOf(zones));
    }

    /** 요청 문구에서 지역을 읽는다. 읽은 낱말이 없으면 {@link #NONE} 이다. */
    public static RequestedRegion from(String requestNote) {
        if (requestNote == null || requestNote.isBlank()) {
            return NONE;
        }
        List<Hit> hits = findHits(requestNote);
        Map<String, Set<JejuZone>> kept = new LinkedHashMap<>();
        for (int index = 0; index < hits.size(); index++) {
            Hit hit = hits.get(index);
            int nextStart = index + 1 < hits.size() ? hits.get(index + 1).start() : requestNote.length();
            if (!RequestNoteNegation.negatedAfter(requestNote, hit.end(), nextStart)) {
                kept.computeIfAbsent(hit.word(), word -> EnumSet.noneOf(JejuZone.class)).addAll(hit.zones());
            }
        }
        if (kept.isEmpty()) {
            return NONE;
        }
        Set<JejuZone> zones = EnumSet.noneOf(JejuZone.class);
        kept.values().forEach(zones::addAll);
        return new RequestedRegion(new ArrayList<>(kept.keySet()), zones);
    }

    /** 지역을 물었는가. */
    public boolean asksAnything() {
        return !zones.isEmpty();
    }

    /** 요청 권역과 그 맞닿은 권역({@link JejuZone#adjacentTo}). 후보 풀을 거르는 범위다. */
    public Set<JejuZone> reach() {
        Set<JejuZone> reach = EnumSet.noneOf(JejuZone.class);
        for (JejuZone zone : JejuZone.values()) {
            if (zones.stream().anyMatch(zone::adjacentTo)) {
                reach.add(zone);
            }
        }
        return reach;
    }

    /**
     * 후보 풀을 좁히는 요청인가 — 맞닿은 권역까지 넓혀도 섬 전체가 아니다. 서쪽 끝과 동쪽 끝을 함께 부르면("애월이랑 남원")
     * 맞닿은 권역까지가 여섯 권역이라 거를 것이 없다. "남쪽" 은 좁힌다 — 북부는 남쪽 어느 권역과도 맞닿지 않는다.
     */
    public boolean narrows() {
        return asksAnything() && reach().size() < JejuZone.values().length;
    }

    /** 사용자 문장에 쓰는 낱말 — {@code 성산, 표선}. */
    public String label() {
        return String.join(", ", words);
    }

    /** 긴 낱말부터 맞추고 맞춘 구간을 지운다. 결과는 나온 순서다. */
    private static List<Hit> findHits(String requestNote) {
        StringBuilder remaining = new StringBuilder(requestNote);
        List<Hit> hits = new ArrayList<>();
        for (Term term : TERMS) {
            Matcher matcher = term.pattern().matcher(remaining);
            List<Hit> found = new ArrayList<>();
            while (matcher.find()) {
                // 맞춘 꼴이 아니라 대표 낱말로 적는다 — "서부" 는 "서쪽", "산남" 은 "남쪽"
                found.add(new Hit(matcher.start(), matcher.end(), term.word(), term.zones()));
            }
            // 찾기를 마친 뒤 지운다 — 찾는 도중에 지우면 matcher 가 바뀐 문자열을 본다
            for (Hit hit : found) {
                for (int position = hit.start(); position < hit.end(); position++) {
                    remaining.setCharAt(position, ' ');
                }
            }
            hits.addAll(found);
        }
        hits.sort(Comparator.comparingInt(Hit::start));
        return hits;
    }

    /** 맨몸 방향어의 꼴 — 앞뒤 경계({@link #HALF_BEFORE} · {@link #HALF_AFTER})를 건다. */
    private static String half(String word) {
        return HALF_BEFORE + word + HALF_AFTER;
    }

    /**
     * 사전의 낱말 하나. {@code word} 는 사용자 문장에 쓰는 대표 낱말이고, 그 길이가 맞추는 순서를 정한다 — 정규식
     * 길이가 아니다.
     */
    private record Term(String word, Pattern pattern, Set<JejuZone> zones) {

        private static Term of(String word, Set<JejuZone> zones) {
            return new Term(word, Pattern.compile(Pattern.quote(word)), zones);
        }

        /** 앞뒤를 보는 낱말 · 여러 꼴이 같은 권역인 낱말. 꼴들은 대표 낱말과 길이가 같아야 순서가 맞는다. */
        private static Term guarded(String word, String regex, Set<JejuZone> zones) {
            return new Term(word, Pattern.compile(regex), zones);
        }

        private int length() {
            return word.length();
        }
    }

    private record Hit(int start, int end, String word, Set<JejuZone> zones) {
    }
}
