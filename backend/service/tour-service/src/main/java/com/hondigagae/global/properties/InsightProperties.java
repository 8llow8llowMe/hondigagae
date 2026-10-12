package com.hondigagae.global.properties;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 여행 적합도 / 산책 위험도 판정 임계값.
 *
 * <p>점수 규칙을 코드에 박지 않고 프로퍼티로 뺀 이유는, 이 숫자들이 <b>확정된 사실이 아니라
 * 현재의 판단</b>이기 때문이다. 반려견 기준 기온 임계값은 견종/체중/계절에 따라 논의가 갈리고,
 * 서비스 운영 중에 조정될 값이다. 조정할 때마다 배포하지 않아도 되게 둔다.
 *
 * <p>기본값은 반려견 열 스트레스 관련 통용 기준을 보수적으로 잡은 것이며, 수의학적 확정치가
 * 아니다. 응답 문구도 단정형을 피하고 위험 안내로 쓴다.
 */
@ConfigurationProperties(prefix = "insight")
public record InsightProperties(
    // 이 확률 이상이면 비 예보로 보고 실내 대안을 제안한다.
    Integer rainProbabilityPercent,
    // 더위 - 주의 / 위험 기온(섭씨)
    Double hotTemperature,
    Double veryHotTemperature,
    // 추위 - 주의 / 위험 기온(섭씨)
    Double coldTemperature,
    Double veryColdTemperature,
    // 이 풍속(m/s) 이상이면 소형견 산책에 주의를 준다.
    Double strongWindSpeed,
    // 노면(아스팔트) 표면온도 추정치 기준. 사람 체감이 아니라 발바닥 기준이다.
    Double pavementCautionCelsius,
    Double pavementDangerCelsius,
    // 기상청 여름철 체감온도 기준. 폭염특보(주의보 33℃·경보 35℃)와 같은 척도를 쓴다.
    Double feelsLikeCautionCelsius,
    Double feelsLikeDangerCelsius,
    // 비 오는 날 실내 대안 검색 기본 반경(m) / 개수
    Integer alternativeRadiusMeters,
    Integer alternativeSize,
    // 장소 추천(홈 "오늘 가기 좋은 곳") 후보군과 결과 캐시 (#1368)
    Recommendation recommendation
) {

    public InsightProperties {
        if (rainProbabilityPercent == null) {
            rainProbabilityPercent = 60;
        }
        if (hotTemperature == null) {
            hotTemperature = 28.0d;
        }
        if (veryHotTemperature == null) {
            veryHotTemperature = 31.0d;
        }
        if (coldTemperature == null) {
            coldTemperature = 5.0d;
        }
        if (veryColdTemperature == null) {
            veryColdTemperature = 0.0d;
        }
        if (strongWindSpeed == null) {
            strongWindSpeed = 9.0d;
        }
        if (pavementCautionCelsius == null) {
            pavementCautionCelsius = 42.0d;
        }
        if (pavementDangerCelsius == null) {
            pavementDangerCelsius = 52.0d;
        }
        if (feelsLikeCautionCelsius == null) {
            // 폭염주의보 발표 기준(체감온도 33℃)과 맞춘다 — 임계의 출처가 우리 감이 아니라 기상청 특보다.
            feelsLikeCautionCelsius = 33.0d;
        }
        if (feelsLikeDangerCelsius == null) {
            // 폭염경보 발표 기준(체감온도 35℃).
            feelsLikeDangerCelsius = 35.0d;
        }
        if (alternativeRadiusMeters == null || alternativeRadiusMeters <= 0) {
            alternativeRadiusMeters = 5000;
        }
        if (alternativeSize == null || alternativeSize <= 0) {
            alternativeSize = 5;
        }
        if (recommendation == null) {
            recommendation = new Recommendation(null, null, null);
        }
    }

    /**
     * 장소 추천 후보군과 결과 캐시 (#1368).
     *
     * <p>지역은 요청으로 받지 않는다 — 서비스 지역이 제주 하나라 화면이 고를 값이 없고, 받으면 후보 질의와 캐시 키가
     * 지역 수만큼 갈라진다. 유형 기본값이 관광지(12) · 문화시설(14) · 레포츠(28) 인 이유: 쇼핑(38)은 운영 데이터 대부분이
     * 면세점 · 상점이라 "가 볼 곳" 이 아니고, 음식점(39) · 숙박(32)은 하루 행선지가 아니다.
     *
     * @param areaCode        후보 지역 코드 (관광공사 areaCode, 제주 39)
     * @param contentTypeIds  후보 콘텐츠 유형 코드
     * @param cacheTtlSeconds 결과 캐시 수명(초). 특보는 키에 담기므로 이 값이 특보의 신선도를 늦추지 않는다
     */
    public record Recommendation(String areaCode, List<String> contentTypeIds, Integer cacheTtlSeconds) {

        public Recommendation {
            if (areaCode == null || areaCode.isBlank()) {
                areaCode = "39";
            }
            if (contentTypeIds == null || contentTypeIds.isEmpty()) {
                contentTypeIds = List.of("12", "14", "28");
            } else {
                contentTypeIds = List.copyOf(contentTypeIds);
            }
            if (cacheTtlSeconds == null || cacheTtlSeconds <= 0) {
                cacheTtlSeconds = 600;
            }
        }
    }
}
