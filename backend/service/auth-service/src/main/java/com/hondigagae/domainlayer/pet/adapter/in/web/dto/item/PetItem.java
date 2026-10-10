package com.hondigagae.domainlayer.pet.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import lombok.Builder;

/**
 * 반려견 목록의 원소. 상세 조회({@code PetResponse})와 같은 항목을 담는다.
 * 회원당 최대 5마리라 목록에서도 전체 프로필을 내려, 프론트가 카드에 성향 배지를
 * 바로 렌더링할 수 있게 한다.
 */
@Builder
@Schema(description = "반려견 목록 항목 DTO")
public record PetItem(

    @Schema(description = "반려견 아이디", example = "1234567890123456789")
    String petId,

    @Schema(description = "반려견 이름", example = "몽실이")
    String name,

    @Schema(description = "품종", example = "말티즈")
    String breed,

    @Schema(description = "생년월 (yyyy-MM)", example = "2017-05")
    String birthYm,

    @Schema(description = "나이 (생년월 기준 만 나이, 생년월 미입력 시 null)", example = "9")
    Integer age,

    @Schema(description = "크기 구분", example = "{\"code\":\"SMALL\",\"name\":\"소형견\",\"description\":\"체중 10kg 미만\"}")
    CodeNameDescriptionMetadata sizeType,

    @Schema(description = "체중 (kg, 미입력 시 null)", example = "3.5")
    BigDecimal weightKg,

    @Schema(description = "더위 민감 여부", example = "true")
    boolean heatSensitive,

    @Schema(description = "추위 민감 여부", example = "false")
    boolean coldSensitive,

    @Schema(description = "소음 민감 여부", example = "false")
    boolean noiseSensitive,

    @Schema(description = "활동량", example = "{\"code\":\"MEDIUM\",\"name\":\"보통\",\"description\":\"일반적인 산책과 관광 일정을 소화합니다.\"}")
    CodeNameDescriptionMetadata activityLevel,

    @Schema(description = "산책 선호 여부", example = "true")
    boolean walkPreferred,

    @Schema(description = "사회성", example = "{\"code\":\"MEDIUM\",\"name\":\"보통\",\"description\":\"상황에 따라 적응합니다.\"}")
    CodeNameDescriptionMetadata sociality,

    @Schema(description = "프로필 이미지 공개 URL (미등록 시 null)",
        example = "https://minio.hondigagae.com/hondigagae/pets/profiles/202507110001/2026/08/3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61.png")
    String profileImageUrl,

    @Schema(description = "대표 반려견 여부 (AI 일정 생성 기본값)", example = "true")
    boolean representative
) {
}
