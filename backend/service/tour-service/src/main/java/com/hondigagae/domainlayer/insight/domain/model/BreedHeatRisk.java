package com.hondigagae.domainlayer.insight.domain.model;

import java.util.List;
import java.util.Locale;

/**
 * 견종에 따른 고온 취약성 판정.
 *
 * <p>단두종(코가 짧은 견종)은 기도가 짧고 좁아 헐떡임으로 체온을 내리는 효율이 낮다.
 * 같은 30도에서 다른 견종보다 먼저 위험해지므로, 프로필에 견종이 있으면 판정에 반영한다.
 *
 * <p><b>이름 문자열로 판정한다는 점의 한계를 인정한다.</b> 사용자가 자유 입력한 견종명이라
 * 표기가 제각각이고, 못 잡는 경우가 반드시 생긴다. 그래서 판정 결과는 <b>가중치를 더하는
 * 쪽으로만</b> 쓰고, 매칭 실패를 "안전하다"로 해석하지 않는다.
 */
public final class BreedHeatRisk {

    /** 단두종 대표 견종. 한글/영문 표기를 함께 둔다 - 사용자가 어느 쪽으로 쓸지 모른다. */
    private static final List<String> BRACHYCEPHALIC_KEYWORDS = List.of(
        "불독", "불도그", "bulldog",
        "퍼그", "pug",
        "시츄", "시추", "shih",
        "페키니즈", "pekingese",
        "보스턴테리어", "보스턴 테리어", "boston terrier",
        "복서", "boxer",
        "프렌치불", "french bull",
        "잉글리시불", "english bull",
        "차우차우", "chow",
        "케언테리어", "브뤼셀그리펀", "griffon",
        "킹찰스", "king charles",
        "보르도", "bordeaux",
        "마스티프", "mastiff"
    );

    private BreedHeatRisk() {
    }

    /**
     * 단두종으로 볼 만한 견종인지.
     *
     * @return 견종을 모르거나 목록에 없으면 false. false 는 "안전하다"가 아니라
     *         "이 가중치를 적용할 근거가 없다"는 뜻이다
     */
    public static boolean isBrachycephalic(String breed) {
        if (breed == null || breed.isBlank()) {
            return false;
        }
        String normalized = breed.toLowerCase(Locale.KOREAN).replace(" ", "");
        return BRACHYCEPHALIC_KEYWORDS.stream()
            .map(keyword -> keyword.toLowerCase(Locale.KOREAN).replace(" ", ""))
            .anyMatch(normalized::contains);
    }
}
