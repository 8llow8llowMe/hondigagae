package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.domain.model.PackingList.PackingItem;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Matcher;
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
 *       이유에 그 수치를 적는다. 모델이 조건 밖에서 적은 같은 종류는 버린다. <b>여행 어느 날에도 예보가 없으면
 *       계절로 정한다 (#1435)</b> — 12~2월 · 11 · 3월은 옷, 7 · 8월은 쿨매트. 계절 품목도 날씨 품목과 똑같이 다룬다</li>
 *   <li><b>여행 맥락 품목도 서버가 넣는다 (#1435).</b> 제주 여행이거나 배로 들어가는 섬이 일정에 있으면 이동장을 넣고
 *       이유에 섬 도항 · 제주 입도와 탑승 조건 확인을 적는다. 그때 모델이 적은 이동장 류는 버린다</li>
 *   <li><b>그 밖의 품목은 목록 안에서만 받는다.</b> 실제로 파는 반려견 여행 용품의 낱말 목록
 *       ({@link #EXTRAS})에 걸리지 않으면 버린다. 걸려도 이유의 날씨 문장이 예보와 어긋나면 그 문장을 걷고,
 *       걷은 뒤 남는 이유가 없으면 품목을 버린다</li>
 *   <li><b>이유는 이 여행의 사실에서 그 물건이 하는 일로 이어져야 한다 (#1336).</b> 이유가 일정(일차 · 장소 · 섬) ·
 *       예보 수치 · 반려견 특성 · 여행 계절 · 제주 입도 수단 중 아무것도 가리키지 않으면 버린다 — 이유가 없는 품목도
 *       같다. 가리켜도 그 물건의 쓰임({@link #PURPOSES})과 이어지는 말이 없으면 버린다. prod 의 "2일차 중문색달해수욕장에서
 *       그늘이 필요하므로 담요", "해수욕장에서 물에 젖을 수 있으니 이동장" 은 사실을 가리키지만 물건과 이어지지 않는다</li>
 * </ol>
 *
 * <p><b>순서는 이 여행에만 해당하는 것부터다</b> — 날씨 품목(계절 포함), 여행 맥락 품목, 모델 품목, 기본 품목. 일정
 * 상세의 요약 카드가 앞 5개만 보여 주는데, 기본 품목을 앞에 두면 모든 여행에서 그 5줄이 똑같아진다.
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

    /*
      계절 품목의 달 (#1435). 여행 어느 날에도 예보가 없을 때만 쓴다 — 예보가 하나라도 있으면 수치가 낫다. 4 · 5 · 6 · 9 · 10월은
      계절만으로 부를 품목이 없다. 이유의 달은 여행 날짜 중 그 조건을 처음 만족하는 날의 달이다.
     */
    static final Set<Integer> COLD_SEASON_MONTHS = Set.of(12, 1, 2);
    static final Set<Integer> CHILLY_SEASON_MONTHS = Set.of(11, 3);
    static final Set<Integer> HOT_SEASON_MONTHS = Set.of(7, 8);
    private static final String SEASONAL_NOTE = "아직 예보가 없어 계절 기준으로 넣었어요.";

    /** 여행 맥락 품목의 마지막 문장. 입도 수단과 예약처를 모르므로 규정 확인을 맡긴다. */
    private static final String BOARDING_NOTE = "항공사·선사마다 반려견 탑승 조건(이동장 규격·무게·서류)이 달라 예약한 곳의 규정을 미리 확인해요.";

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

    /*
      이동장 류 (#1435). 여행 맥락 품목이 들어가면 서버가 이 자리를 맡으므로 모델이 적은 것은 버린다. 슬링백 · 개모차 · 유모차는
      탑승 규정의 이동장이 아니라 다른 물건이라 여기 넣지 않는다 — 모델 품목으로 그대로 검사한다.
     */
    private static final String CARRIER_WORDS = "이동장|켄넬|(펫|반려견|강아지)\\s*캐리어|이동\\s*가방";
    private static final Pattern CARRIER = Pattern.compile(CARRIER_WORDS);

    /**
     * 모델이 더할 수 있는 품목. <b>실제로 파는 반려견 여행 용품의 낱말</b>이다. 여기에 없으면 버린다 —
     * {@code 방충망 장갑} 같은 것이 여기서 걸러진다. 목록에 없는 좋은 물건이 버려지는 것이 존재하지 않는
     * 물건이 나가는 것보다 덜 나쁘다. 사용자는 직접 더할 수 있다.
     */
    private static final Pattern EXTRAS = Pattern.compile(String.join("|",
        "물티슈", "수건", "타월", "배변\\s*패드", CARRIER_WORDS, "슬링백",
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

    /* ---- 이유가 이 여행의 사실을 가리키는가 (#1336) ---- */

    /** "2일차" · "1~3일차". 일차가 여행 기간 안이어야 사실이다 — 범위면 끝도 안이어야 한다. */
    private static final Pattern DAY_MENTION = Pattern.compile("(\\d{1,2})\\s*(?:~\\s*(\\d{1,2})\\s*)?일차");

    /**
     * 예보 수치를 가리키는 말. 예보가 있을 때만 사실이다 — 없는데 적은 수치는 지어낸 것이다. {@code 예보} 한 낱말은
     * 넣지 않는다 — "날씨 예보를 미리 확인해요" 는 아무 수치도 가리키지 않는다.
     */
    private static final Pattern WEATHER_MENTION =
        Pattern.compile("강수\\s*확률|\\d+\\s*%|\\d+(?:\\.\\d+)?\\s*℃|기온|풍속|m/s");

    /**
     * 장소 이름의 최소 길이. 전체 이름에도 토막에도 같다 — "이동" 같은 짧은 제목이나 "카페" · "공원" 같은 두 글자
     * 토막은 어느 이유에나 걸린다. 그래서 두 글자 장소("우도")는 이름으로 잡지 못한다.
     */
    private static final int PLACE_TOKEN_MIN_LENGTH = 3;

    /** 장소 이름 토막이어도 장소를 가리키지 않는 말. 반려동물 동반 장소 이름에 흔하다. */
    private static final Set<String> PLACE_TOKEN_STOPWORDS = Set.of(
        "반려견", "애견", "강아지", "반려동물", "동반", "제주도", "제주시", "서귀포", "서귀포시", "해수욕장", "리조트",
        "게스트하우스", "펜션", "호텔", "카페", "놀이터", "운동장");

    /**
     * 이유의 장소 종류 낱말 ↔ 일정 장소 이름의 낱말. "해변 일정 뒤 발을 닦아요" 는 장소 이름을 옮기지 않았어도
     * 일정에 해수욕장이 있으면 그 일정을 가리킨다. 일정에 그런 장소가 없으면 지어낸 말이다 — 일차를 함께 적었어도
     * 버린다("2일차 협재해수욕장에서…" 를 해변 없는 일정에 적은 경우).
     */
    private static final List<PlaceKind> PLACE_KINDS = List.of(
        new PlaceKind(Pattern.compile("해변|바다|바닷가|해수욕|해안|모래사장"),
            Pattern.compile("해수욕장|해변|해안|바다|포구|모래")),
        new PlaceKind(Pattern.compile("숲|오름|휴양림|곶자왈|산책로|둘레길|등산"),
            Pattern.compile("숲|오름|휴양림|곶자왈|산책로|둘레길|한라산")),
        new PlaceKind(Pattern.compile("올레"), Pattern.compile("올레")),
        new PlaceKind(Pattern.compile("카페"), Pattern.compile("카페")),
        new PlaceKind(Pattern.compile("숙소|숙박|호텔|펜션|리조트"),
            Pattern.compile("호텔|펜션|리조트|스테이|민박|게스트하우스|숙소")));

    /**
     * 제주 입도 수단을 가리키는 말 (#1435). 제주 여행일 때만 사실이다 — 수단이 일정에 없어도 비행기나 배로 들어가는 것은
     * 사실이다. 한 글자 {@code 배} 는 넣지 않는다 — "배탈" · "배를 채워" 에 걸린다. 배는 {@code 배를 타} 처럼 서술로 잡는다.
     */
    private static final Pattern TRANSPORT_MENTION = Pattern.compile("비행기|항공|기내|여객선|배편|선박|도항|입도|배를\\s*타");

    /**
     * 달 언급. 앞에 숫자가 붙지 않아야 한다 — "11월" 안의 "1월" 을 1월로 읽지 않는다. "3개월" 은 달이 아니다. 범위도 읽는다 —
     * "12~2월" · "12월~2월" 의 앞 달을 놓치면 1월 여행의 이유가 다른 계절로 버려진다. 연말을 넘는 범위는 펼쳐서 본다.
     */
    private static final Pattern MONTH_MENTION =
        Pattern.compile("(?<!\\d)(1[0-2]|[1-9])\\s*(?:월\\s*)?(?:~\\s*(1[0-2]|[1-9])\\s*)?월");

    /**
     * 계절 낱말과 그 낱말이 가리킬 수 있는 달 (#1435). 낱말은 앞에 한글이 붙지 않을 때만 계절이다 — "돌봄" 의 {@code 봄} 은
     * 아니다. 계절의 달(3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울)에 <b>앞뒤 한 달씩</b>을 더해 본다 — 9월 초 여행의 "여름",
     * 3월 여행의 "겨울", 11월 말의 "초겨울" 은 틀린 말이 아니다. {@code 초} · {@code 늦} 이 붙은 꼴도 같은 범위다. 그래도 11월
     * 여행의 "여름"(5~9월)은 다른 계절이다. {@code 한여름} · {@code 한겨울} 은 한가운데라 그 계절의 달만 본다.
     */
    private static final List<SeasonWord> SEASON_WORDS = List.of(
        new SeasonWord(Pattern.compile("(?<![가-힣])(?:초|늦)?봄"), Set.of(2, 3, 4, 5, 6)),
        new SeasonWord(Pattern.compile("(?<![가-힣])(?:초|늦)?여름"), Set.of(5, 6, 7, 8, 9)),
        new SeasonWord(Pattern.compile("(?<![가-힣])한여름"), Set.of(6, 7, 8)),
        new SeasonWord(Pattern.compile("(?<![가-힣])(?:초|늦)?가을"), Set.of(8, 9, 10, 11, 12)),
        new SeasonWord(Pattern.compile("(?<![가-힣])(?:초|늦)?겨울"), Set.of(11, 12, 1, 2, 3)),
        new SeasonWord(Pattern.compile("(?<![가-힣])한겨울"), Set.of(12, 1, 2)));

    /**
     * 품목 종류 → 그 물건이 하는 일과 이어지는 말. 이유에 이 말이 하나도 없으면 사실과 물건이 이어지지 않은 것이다.
     * 종류 낱말 자체는 지우고 본다 — "이동장이 필요해요" 의 {@code 이동} 이 쓰임으로 읽히면 안 된다.
     *
     * <p><b>한 글자 낱말은 활용형으로 좁힌다.</b> {@code 쉬} 는 "젖기 쉬우니", {@code 잠} 은 "잠시", {@code 거리} 는
     * "볼거리", {@code 침} 은 "아침", {@code 발} 은 "출발", {@code 코} 는 "코스", {@code 비} 는 "비행기" 에 걸려
     * prod 와 같은 따로 노는 이유를 통과시켰다.
     *
     * <p>목록에 없는 종류(인식표 · 구급 · 장난감 …)는 쓰임을 보지 않는다. 쓰임이 넓어 낱말로 묶이지 않는다.
     * 낱말이 모자라 좋은 이유가 버려지면(로그 {@code LLM packing item replaced or dropped}) 낱말을 더한다.
     *
     * <p>{@code 섬} 은 "섬세" · "섬유" · "섬뜩" 에 걸리지 않게 좁힌다 (#1435).
     */
    private static final List<Purpose> PURPOSES = List.of(
        new Purpose(Pattern.compile("담요|방석|매트"), Pattern.compile(String.join("|",
            "보온", "따뜻", "체온", "추위", "추운", "쌀쌀", "바람", "쉬게", "쉬어", "쉴", "쉼", "휴식", "잠자", "잠들",
            "잠을", "낮잠", "눕", "깔", "바닥", "차량", "차 안", "차에서", "이동\\s*중", "낯선", "익숙", "냄새", "안정",
            "편하", "편안"))),
        new Purpose(Pattern.compile(CARRIER_WORDS + "|슬링백|개모차|유모차"),
            Pattern.compile(String.join("|",
                "이동", "차량", "차 안", "차에", "차로", "차를", "자동차", "렌터카", "드라이브", "버스", "비행기", "항공",
                "기내", "여객선", "선박", "배편", "배를", "도항", "입도", "섬(?![세유뜩])", "탑승", "대중교통", "실내", "카페",
                "식당", "숙소", "매장", "입장",
                "안정", "쉬게", "쉬어", "쉴", "쉼", "휴식", "안아", "오래 걷", "많이 걷", "지치", "체력", "장거리",
                "이동\\s*거리", "먼\\s*거리", "km", "킬로",
                "관절", "낯선", "붐비", "혼잡", "사람이 많"))),
        new Purpose(Pattern.compile("수건|타월"), Pattern.compile(String.join("|",
            "물", "젖", "바다", "해변", "해수욕", "계곡", "폭포", "목욕", "(?<![가-힣])비\\s*(가|에|를|예보|소식)", "빗",
            "씻", "닦", "모래", "땀", "(?<!출)발", "수영", "말리"))),
        new Purpose(Pattern.compile("물티슈"), Pattern.compile(String.join("|",
            "닦", "(?<!출)발", "입가", "입 주변", "침을", "침이", "오염", "더러", "모래", "흙", "위생", "식사", "간식",
            "배변", "털", "눈곱", "눈물", "얼굴", "청결", "흘", "정리"))),
        new Purpose(Pattern.compile("진드기|해충|벌레|기피제"), Pattern.compile(String.join("|",
            "풀", "숲", "오름", "잔디", "들판", "초원", "공원", "올레", "곶자왈", "야외", "자연", "정원", "목장", "농장",
            "트레킹", "탐방로", "둘레길", "산책로", "등산", "모기"))),
        new Purpose(Pattern.compile("구명|라이프\\s*(재킷|자켓)"), Pattern.compile(String.join("|",
            "바다", "해변", "해수욕", "물", "수영", "카약", "요트", "보트", "선박", "여객선", "배를", "계곡", "패들",
            "서핑", "스노클"))),
        new Purpose(Pattern.compile("발\\s*세정|발\\s*클리너|신발|발\\s*보호"), Pattern.compile(String.join("|",
            "(?<!출)발", "모래", "해변", "흙", "바닥", "자갈", "현무암", "돌", "산책", "오름", "길", "뜨거운",
            "아스팔트", "진흙"))),
        new Purpose(Pattern.compile("선크림|자외선"), Pattern.compile(String.join("|",
            "햇볕", "햇빛", "해변", "야외", "그늘", "피부", "코(?!스)", "털", "맑", "한낮"))),
        new Purpose(Pattern.compile("멀미"), Pattern.compile(String.join("|",
            "차량", "차 안", "차에", "차로", "자동차", "렌터카", "드라이브", "버스", "이동", "비행기", "여객선", "선박",
            "배편", "배를", "장거리", "우도", "비양도", "가파도", "마라도", "추자도", "차귀도", "도항", "섬(?![세유뜩])"))));

    private final PackingChecklistQuery query;
    private final LocalDate startDate;
    /** 일정 장소 이름(공백을 뺀 전체)과 거기서 떼어 낸 토막. 이유가 장소를 가리키는지 볼 때 쓴다. */
    private final Set<String> placeNames;
    /** 반려견 특성을 가리키는 말. 특성이 있는 것만 담는다 — 더위 민감이 아닌 아이의 "더위" 는 사실이 아니다. */
    private final List<Pattern> petFacts;
    /** 여행 날짜가 걸친 달 · 제주 여행인가 · 배로 들어가는 섬 (#1435). 프롬프트와 같은 판정이다. */
    private final PackingTripContext trip;
    /**
     * 일정의 섬 이름. 두 글자 이름은 앞에 한글이 붙지 않을 때만 섬이다 — "비우도록" 의 {@code 우도} 는 아니다. 세 글자 이름은
     * 다른 낱말 안에 들어갈 일이 드물고, "상추자도" 처럼 앞에 붙는 섬 이름이 있어 경계를 걸지 않는다.
     */
    private final List<Pattern> islandFacts;

    PackingListRules(PackingChecklistQuery query) {
        this.query = query;
        this.startDate = parseOrNull(query.startDate());
        this.placeNames = placeNames(query.planOutline());
        this.petFacts = petFacts(query.safePetConditions());
        this.trip = PackingTripContext.of(query);
        this.islandFacts = trip.islands().stream()
            .map(visit -> Pattern.compile((visit.name().length() <= 2 ? "(?<![가-힣])" : "") + Pattern.quote(visit.name())))
            .toList();
    }

    List<PackingItem> apply(List<PackingItem> modelItems) {
        // 계절은 예보를 대신할 때만 쓴다. 수치 품목이 먼저고, 없을 때 계절이 그 자리에 선다 (#1435).
        boolean seasonal = trip.knowsDates() && !trip.hasForecastWithinTrip(query.safeWeatherOutlook());
        Optional<String> rain = rainReason();
        Optional<String> heat = heatReason().or(() -> seasonal ? seasonalHeatReason() : Optional.<String>empty());
        Optional<String> cold = coldReason().or(() -> seasonal ? seasonalColdReason() : Optional.<String>empty());
        Optional<String> carrier = carrierReason();

        List<PackingItem> result = new ArrayList<>();
        rain.ifPresent(reason -> result.add(item(CATEGORY_WEATHER, "반려견 우비", reason)));
        heat.ifPresent(reason -> result.add(item(CATEGORY_WEATHER, "쿨매트", reason)));
        cold.ifPresent(reason -> result.add(item(CATEGORY_WEATHER, "반려견 옷", reason)));
        carrier.ifPresent(reason -> result.add(item(CATEGORY_MOVING, "이동장", reason)));

        ServerItems server = new ServerItems(rain.isPresent(), heat.isPresent(), cold.isPresent(), carrier.isPresent());
        int dropped = 0;
        for (PackingItem modelItem : modelItems) {
            PackingItem kept = keepExtra(modelItem, server);
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
            log.warn("LLM packing list corrected by server rules modelItems={} dropped={} rainy={} hot={} cold={} seasonal={} carrier={}",
                modelItems.size(), dropped, rain.isPresent(), heat.isPresent(), cold.isPresent(), seasonal, carrier.isPresent());
        }
        return result;
    }

    /**
     * 모델 품목 하나. 서버가 맡는 종류이거나 목록 밖이거나 이유가 남지 않으면 null 이다. 이동장 류는 서버가 여행 맥락 품목을
     * 넣었을 때만 서버 몫이다 — 제주도 섬도 아닌 여행이면 모델 품목으로 검사한다.
     */
    private PackingItem keepExtra(PackingItem modelItem, ServerItems server) {
        String name = modelItem.name().strip();
        boolean serverKind = !NOT_SERVER_KIND.matcher(name).find()
            && (ESSENTIALS.stream().anyMatch(kind -> kind.pattern().matcher(name).find())
                || FOOD.matcher(name).find()
                || RAIN_GEAR.matcher(name).find()
                || COOLING_GEAR.matcher(name).find()
                || WARM_GEAR.matcher(name).find()
                || (server.carrier() && CARRIER.matcher(name).find()));
        if (serverKind || !EXTRAS.matcher(name).find()) {
            return null;
        }
        // 공백뿐인 이유는 없는 이유다. 이유가 없으면 이 여행의 무엇 때문인지 말할 수 없어 버린다 (#1336).
        if (modelItem.reason() == null || modelItem.reason().isBlank()) {
            return null;
        }
        // 계절 품목도 날씨 품목이다 — 11월 여행에 옷이 들어갔으면 모델 이유의 "쌀쌀해요" 는 걷지 않는다 (#1435).
        String reason = keepSentences(modelItem.reason(), sentence ->
            (!server.rainy() && RAIN_CLAIM.matcher(sentence).find())
                || (!server.hot() && HEAT_CLAIM.matcher(sentence).find())
                || (!server.cold() && COLD_CLAIM.matcher(sentence).find()));
        if (reason == null || !pointsAtTripFact(reason) || !fitsPurpose(name, reason)) {
            return null;
        }
        // 분류가 빠지는 일이 흔하다. 불변 Set 의 contains(null) 은 NPE 라 먼저 거른다.
        String category = modelItem.category() != null && CATEGORIES.contains(modelItem.category())
            ? modelItem.category() : CATEGORY_CARE;
        return item(category, name, reason);
    }

    /**
     * 이유가 일정(일차 · 장소 · 섬) · 예보 수치 · 반려견 특성 · 여행 계절 · 제주 입도 수단 중 하나라도 가리키는가. 일정에 없는
     * 장소 종류나 여행과 다른 계절을 말하면 다른 사실을 함께 가리켜도 아니다.
     */
    private boolean pointsAtTripFact(String reason) {
        SeasonMention season = seasonMention(reason);
        if (season == SeasonMention.OTHER || mentionsAbsentPlaceKind(reason)) {
            return false;
        }
        return season == SeasonMention.TRIP || mentionsTripDay(reason) || mentionsPlace(reason) || mentionsIsland(reason)
            || mentionsTripTransport(reason) || mentionsWeather(reason) || petFacts.stream().anyMatch(fact -> fact.matcher(reason).find());
    }

    /** 일정의 섬 이름을 가리키는가. 두 글자 "우도" 도 섬이다 — 장소 이름의 최소 길이와 무관하다. */
    private boolean mentionsIsland(String reason) {
        return islandFacts.stream().anyMatch(island -> island.matcher(reason).find());
    }

    /** 제주 여행의 입도 수단을 가리키는가. */
    private boolean mentionsTripTransport(String reason) {
        return trip.jeju() && TRANSPORT_MENTION.matcher(reason).find();
    }

    /**
     * 이유의 달 · 계절 낱말이 여행의 것인가 (#1435). 예보가 없을 때 모델이 기댈 수 있는 사실이다. 여행 날짜를 모르면
     * 판정하지 않는다. 하나라도 여행의 달 · 계절이면 사실이고, 언급이 있는데 모두 다른 달 · 계절이면 지어낸 말이다 —
     * 11월 여행의 "여름이라" · "7월".
     */
    private SeasonMention seasonMention(String reason) {
        List<Integer> tripMonths = trip.months();
        if (tripMonths.isEmpty()) {
            return SeasonMention.NONE;
        }
        boolean mentioned = false;
        Matcher month = MONTH_MENTION.matcher(reason);
        while (month.find()) {
            mentioned = true;
            int from = Integer.parseInt(month.group(1));
            int to = month.group(2) == null ? from : Integer.parseInt(month.group(2));
            if (monthRangeHits(from, to, tripMonths)) {
                return SeasonMention.TRIP;
            }
        }
        for (SeasonWord word : SEASON_WORDS) {
            if (word.pattern().matcher(reason).find()) {
                mentioned = true;
                if (word.months().stream().anyMatch(tripMonths::contains)) {
                    return SeasonMention.TRIP;
                }
            }
        }
        return mentioned ? SeasonMention.OTHER : SeasonMention.NONE;
    }

    /** {@code from} 부터 {@code to} 까지의 달(연말을 넘으면 12 → 1 로 이어서) 중 여행의 달이 있는가. 12번 안에 끝난다. */
    private static boolean monthRangeHits(int from, int to, List<Integer> tripMonths) {
        int month = from;
        for (int step = 0; step < 12; step++) {
            if (tripMonths.contains(month)) {
                return true;
            }
            if (month == to) {
                return false;
            }
            month = month % 12 + 1;
        }
        return false;
    }

    private boolean mentionsTripDay(String reason) {
        int days = dayCount();
        Matcher matcher = DAY_MENTION.matcher(reason);
        while (matcher.find()) {
            int first = Integer.parseInt(matcher.group(1));
            int last = matcher.group(2) == null ? first : Integer.parseInt(matcher.group(2));
            if (first >= 1 && last >= first && last <= days) {
                return true;
            }
        }
        return false;
    }

    private boolean mentionsPlace(String reason) {
        String compact = reason.replaceAll("\\s+", "");
        if (placeNames.stream().anyMatch(compact::contains)) {
            return true;
        }
        return PLACE_KINDS.stream().anyMatch(kind -> kind.reasonWords().matcher(reason).find()
            && placeNames.stream().anyMatch(place -> kind.placeWords().matcher(place).find()));
    }

    /**
     * 일정에 없는 장소 종류를 말하는가. 일정 장소를 모르면(개요 없음) 판정하지 않는다 — 모르는 것을 거짓이라 하지 않는다.
     */
    private boolean mentionsAbsentPlaceKind(String reason) {
        if (placeNames.isEmpty()) {
            return false;
        }
        return PLACE_KINDS.stream().anyMatch(kind -> kind.reasonWords().matcher(reason).find()
            && placeNames.stream().noneMatch(place -> kind.placeWords().matcher(place).find()));
    }

    private boolean mentionsWeather(String reason) {
        return !query.safeWeatherOutlook().isEmpty() && WEATHER_MENTION.matcher(reason).find();
    }

    /** 쓰임을 정해 둔 종류라면, 종류 낱말을 지운 이유에 그 쓰임과 이어지는 말이 있어야 한다. */
    private static boolean fitsPurpose(String name, String reason) {
        return PURPOSES.stream()
            .filter(purpose -> purpose.kind().matcher(name).find())
            .findFirst()
            .map(purpose -> purpose.use().matcher(purpose.kind().matcher(reason).replaceAll(" ")).find())
            .orElse(true);
    }

    private static Set<String> placeNames(PlanOutline outline) {
        if (outline == null) {
            return Set.of();
        }
        Set<String> names = new HashSet<>();
        // 장소에 이어진 항목과 산책 코스만 본다. 이동 · 메모 항목의 제목은 사용자가 쓴 아무 말("이동")일 수 있다.
        outline.safeDays().stream()
            .flatMap(day -> day.safeItems().stream())
            .filter(item -> item.placeId() != null || PlanItemType.WALK.name().equals(item.itemType()))
            .filter(item -> !PlanItemType.MOVE.name().equals(item.itemType()))
            .map(PlanOutline.PlanOutlineItem::title)
            .filter(title -> title != null && !title.isBlank())
            .forEach(title -> {
                names.add(title.replaceAll("\\s+", ""));
                Arrays.stream(title.strip().split("\\s+")).forEach(names::add);
            });
        names.removeIf(name -> name.length() < PLACE_TOKEN_MIN_LENGTH || PLACE_TOKEN_STOPWORDS.contains(name));
        return Set.copyOf(names);
    }

    private static List<Pattern> petFacts(List<PetCondition> pets) {
        List<Pattern> facts = new ArrayList<>();
        if (pets.size() > 1) {
            facts.add(Pattern.compile("반려견\\s*\\d"));
        }
        for (PetCondition pet : pets) {
            literal(pet.breed()).ifPresent(facts::add);
            literal(pet.sizeName()).ifPresent(facts::add);
            literal(pet.ageText()).ifPresent(facts::add);
            if (pet.lifeStage() != null) {
                literal(pet.lifeStage().getDisplayName()).ifPresent(facts::add);
            }
            if (pet.weightText() != null && !pet.weightText().isBlank()) {
                facts.add(Pattern.compile("kg|체중|몸무게"));
            }
            if (pet.heatSensitive()) {
                facts.add(Pattern.compile("더위|더운|열에"));
            }
            if (pet.coldSensitive()) {
                facts.add(Pattern.compile("추위|추운"));
            }
            if (pet.noiseSensitive()) {
                facts.add(Pattern.compile("소음|소리|시끄"));
            }
            if (pet.lowSociality()) {
                facts.add(Pattern.compile("낯선|사회성|다른\\s*(개|강아지|반려견)|사람이\\s*많"));
            }
            if (pet.walkPreferred()) {
                facts.add(Pattern.compile("산책을\\s*좋아"));
            }
        }
        return List.copyOf(facts);
    }

    private static Optional<Pattern> literal(String text) {
        return text == null || text.isBlank()
            ? Optional.empty() : Optional.of(Pattern.compile(Pattern.quote(text.strip())));
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

    /**
     * 예보가 없는 추운 달의 이유 (#1435). 12~2월이 걸치면 기온이 낮다고, 아니면 11 · 3월이 걸칠 때 아침저녁이 쌀쌀하다고 쓴다.
     * 사용성 테스트(11/6~8, 열흘 뒤라 예보 없음)에서 옷이 빠졌던 자리다.
     */
    private Optional<String> seasonalColdReason() {
        return trip.firstMonthIn(COLD_SEASON_MONTHS)
            .map(month -> month + "월 여행이라 기온이 낮아요. " + SEASONAL_NOTE)
            .or(() -> trip.firstMonthIn(CHILLY_SEASON_MONTHS)
                .map(month -> month + "월 여행이라 아침저녁이 쌀쌀할 수 있어요. " + SEASONAL_NOTE));
    }

    /** 예보가 없는 더운 달의 이유 (#1435). */
    private Optional<String> seasonalHeatReason() {
        return trip.firstMonthIn(HOT_SEASON_MONTHS).map(month -> month + "월 여행이라 한낮 더위가 심할 수 있어요. " + SEASONAL_NOTE);
    }

    /**
     * 여행 맥락 품목(이동장)의 이유 (#1435). 섬 도항 → 제주 입도 → 탑승 조건 확인 순으로 잇는다. 제주 여행도 아니고 배로 들어가는
     * 섬도 없으면 비어 있다. 입도 수단은 일정에 없어 단정하지 않는다 — "비행기나 배".
     */
    private Optional<String> carrierReason() {
        if (!trip.jeju() && trip.islands().isEmpty()) {
            return Optional.empty();
        }
        StringBuilder reason = new StringBuilder();
        if (!trip.islands().isEmpty()) {
            // 섬 이름은 모두 '도' 로 끝난다 — 조사는 '는' 이다 (PackingTripContext#ISLANDS).
            reason.append(trip.islandLabel(" · ")).append("는 배를 타고 들어가요. ");
        }
        if (trip.jeju()) {
            reason.append("제주는 비행기나 배로 들어가요. ");
        }
        return Optional.of(reason.append(BOARDING_NOTE).toString());
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

    private record PlaceKind(Pattern reasonWords, Pattern placeWords) {
    }

    private record Purpose(Pattern kind, Pattern use) {
    }

    private record SeasonWord(Pattern pattern, Set<Integer> months) {
    }

    /** 서버가 넣은 품목. 모델 품목의 같은 종류를 버리고, 이유의 날씨 문장을 걷을지 정한다. */
    private record ServerItems(boolean rainy, boolean hot, boolean cold, boolean carrier) {
    }

    /** 이유의 달 · 계절 언급. 없음 · 여행의 것 · 다른 것. */
    private enum SeasonMention {
        NONE, TRIP, OTHER
    }
}
