package com.hondigagae.domainlayer.placeimport.domain.model;

/**
 * 반려견이 머물 수 있는 구역 — 문화정보원 CSV 의 {@code 장소(실내) 여부} · {@code 장소(실외)여부} 를 {@code place.indoor} ·
 * {@code outdoor} 로 옮기는 규칙 (#1434). {@code null} 은 "모름" 이다.
 *
 * <p><b>두 칸은 시설 형태가 아니라 반려견이 머물 수 있는 구역이다.</b> 제주 여행 카테고리 중복 제거 후 (실내, 실외, 동반) 분포는
 * (N,N,N) 59 · (N,Y,Y) 83 · (Y,N,Y) 9 · (Y,Y,Y) 77 이다. 동반 불가 59곳(박물관 · 미술관 · 문예회관 · 펜션)은 두 칸이 전부 N 이고,
 * 동반 가능 박물관 17곳은 실외만 Y 에 제한사항이 "야외만 반려동물 동반 가능" 이다. 칸을 시설 형태로 읽으면 실내 박물관이 화면에
 * '야외' 로 나온다 — #753 이 관광 API 쪽에서 막은 "모름을 실외로 뭉갬" 이 이 원천에 남아 있던 것이다.
 *
 * <ul>
 *   <li><b>동반 불가면 모름</b> — 반려견이 머물 곳이 없다는 말이라 시설의 실내외를 알려 주지 않는다.</li>
 *   <li><b>동반 가능이면 Y/N 그대로</b> — 반려견 기준의 실내외라 날씨 판정 · 표시에 그대로 쓴다. "야외만" 박물관이 '야외' 로 보이는 것은
 *       반려견 기준으로 맞다(제주항일기념관).</li>
 *   <li><b>동반 가능인데 두 칸이 모두 Y 가 아니면 모름</b> — 실측 0건이지만 같은 이유다. 머물 곳이 없다는 칸이 시설 형태가 되지 않는다.</li>
 * </ul>
 *
 * <p>모름은 병합의 {@code COALESCE(survivor.indoor, absorbed.indoor)} 로 관광 API 행에 옮겨 가지 않는다. 이미 옮겨 간 값은
 * {@code data-refresh-guide.md} §13 런북으로 되돌린다.
 *
 * @param indoor  반려견이 실내에 머물 수 있다. null 이면 모름
 * @param outdoor 반려견이 실외에 머물 수 있다. null 이면 모름
 */
public record PetStayArea(Boolean indoor, Boolean outdoor) {

    public static final PetStayArea UNKNOWN = new PetStayArea(null, null);

    /**
     * @param petAvailable 같은 행의 {@code 반려동물 동반 가능정보} Y/N
     * @param indoorRaw    {@code 장소(실내) 여부} 원문
     * @param outdoorRaw   {@code 장소(실외)여부} 원문
     */
    public static PetStayArea fromCultureColumns(boolean petAvailable, String indoorRaw, String outdoorRaw) {
        if (!petAvailable) {
            return UNKNOWN;
        }
        boolean indoor = PetFieldParser.parseYn(indoorRaw);
        boolean outdoor = PetFieldParser.parseYn(outdoorRaw);
        if (!indoor && !outdoor) {
            return UNKNOWN;
        }
        return new PetStayArea(indoor, outdoor);
    }
}
