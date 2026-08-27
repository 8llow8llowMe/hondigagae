package com.hondigagae.domainlayer.pet.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.exception.PetValidationMessage;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "반려견 등록/수정 요청 DTO")
public record PetSaveRequest(

    @Schema(description = "반려견 이름", example = "몽실이")
    @NotBlank(message = PetValidationMessage.NAME_REQUIRED)
    @Size(max = 20, message = PetValidationMessage.NAME_LENGTH_INVALID)
    String name,

    @Schema(description = "품종", example = "말티즈")
    @Size(max = 50, message = PetValidationMessage.BREED_LENGTH_INVALID)
    String breed,

    @Schema(description = "생년월 (yyyy-MM)", example = "2017-05")
    @Pattern(regexp = PetValidationMessage.BIRTH_YM_PATTERN, message = PetValidationMessage.BIRTH_YM_FORMAT_INVALID)
    String birthYm,

    @Schema(description = "크기 구분", example = "SMALL")
    @NotNull(message = PetValidationMessage.SIZE_TYPE_REQUIRED)
    PetSizeType sizeType,

    @Schema(description = "더위 민감 여부", example = "true")
    boolean heatSensitive,

    @Schema(description = "추위 민감 여부", example = "false")
    boolean coldSensitive,

    @Schema(description = "소음 민감 여부", example = "false")
    boolean noiseSensitive,

    @Schema(description = "활동량", example = "MEDIUM")
    @NotNull(message = PetValidationMessage.ACTIVITY_LEVEL_REQUIRED)
    ActivityLevel activityLevel,

    @Schema(description = "산책 선호 여부", example = "true")
    boolean walkPreferred,

    @Schema(description = "사회성", example = "MEDIUM")
    @NotNull(message = PetValidationMessage.SOCIALITY_REQUIRED)
    SocialityLevel sociality
) {

    public PetSaveCommand toCommand() {
        return PetSaveCommand.builder()
            .name(name)
            .breed(breed)
            .birthYm(birthYm)
            .sizeType(sizeType)
            .heatSensitive(heatSensitive)
            .coldSensitive(coldSensitive)
            .noiseSensitive(noiseSensitive)
            .activityLevel(activityLevel)
            .walkPreferred(walkPreferred)
            .sociality(sociality)
            .build();
    }
}
