package com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import lombok.Builder;

/**
 * 산책 코스 한 줄.
 *
 * <p>{@code lat/lng} 가 null 인 코스가 있다(원천에 좌표가 없는 20·18-2코스). 좌표가 있는
 * 코스만 골든타임(`GET /api/v1/insights/walk-times?lat=&lng=`)과 이어진다 — 화면은 좌표가
 * null 이면 그 버튼을 만들지 않아야 한다.
 *
 * <p><b>종점 좌표({@code endLat}/{@code endLng})도 목록에 싣는다</b> (#816). 상세에만 두면
 * 목록 지도가 코스마다 상세를 부르거나 점 하나로 15km 구간을 대표하게 된다. 스칼라 넷이라
 * 29건 전량 응답에서도 무게가 거의 없다 — 응답을 무겁게 하는 것은 경로 좌표열인데 그것은
 * 애초에 원천이 없다.
 */
@Builder
@Schema(description = "산책 코스 목록 항목 DTO")
public record WalkCourseItem(

    @Schema(description = "산책 코스 아이디", example = "212481712381923328")
    String walkCourseId,

    @Schema(description = "코스 이름표. 올레 코스는 번호가 곧 사용자가 아는 이름이다", example = "1코스")
    String courseLabel,

    @Schema(description = "코스명 (구간)", example = "시흥-광치기")
    String name,

    @Schema(description = "거리(km)", example = "15.1")
    BigDecimal distanceKm,

    @Schema(description = "소요시간 원문", example = "4~5시간")
    String durationText,

    @Schema(
        description = "소요시간 상한(분). **null 은 제한 없음이 아니라 원문을 파싱하지 못했다는 뜻이다** — "
            + "화면은 durationText 원문을 보여 준다",
        example = "300", nullable = true)
    Integer durationMaxMinutes,

    @Schema(description = "시종점 원문", example = "시흥리정류장-광치기해변")
    String startEndPoint,

    @Schema(description = "시작 지점명. 시종점 원문을 가른 값이며 표기는 원문 그대로다. 가르지 못하면 null",
        example = "시흥리정류장", nullable = true)
    String startPointName,

    @Schema(description = "종점 지점명. 시종점 원문을 가른 값이며 표기는 원문 그대로다. 가르지 못하면 null",
        example = "광치기해변", nullable = true)
    String endPointName,

    @Schema(description = "시작점 위도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "33.4796218839", nullable = true)
    Double lat,

    @Schema(description = "시작점 경도 (WGS84). 원천에 좌표가 없는 코스는 null", example = "126.8955024257", nullable = true)
    Double lng,

    @Schema(
        description = "종점 위도 (WGS84). **null 이 정상인 코스가 있다** — 종점 좌표는 그 지점에서 출발하는 "
            + "이웃 코스의 시작점에서 끌어오는데, 이어지는 코스가 없는 종점(7 · 9 · 21 · 10-1 · 14-1코스)은 "
            + "끌어올 곳이 없어 비운다. 결함이 아니라 원천의 한계다. **경로 좌표열은 아예 없다** — "
            + "공개 원천에 없어서이며, 화면은 두 점 사이 직선을 실제 걷는 길로 그리지 않아야 한다",
        example = "33.4457720000", nullable = true)
    Double endLat,

    @Schema(description = "종점 경도 (WGS84). null 규칙은 endLat 과 같다", example = "126.9223550000", nullable = true)
    Double endLng,

    @Schema(description = "대표 이미지 URL. 없으면 null", nullable = true)
    String firstImage
) {
}
