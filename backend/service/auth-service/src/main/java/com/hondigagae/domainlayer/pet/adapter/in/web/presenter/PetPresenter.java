package com.hondigagae.domainlayer.pet.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.item.PetItem;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetProfileImageUploadResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetsResponse;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.storage.client.ObjectStorageClient;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PetPresenter {

    private final ObjectStorageClient objectStorageClient;

    public PetsResponse toPetsResponse(List<PetInfo> infos) {
        List<PetItem> pets = infos.stream()
            .map(this::toPetItem)
            .toList();
        return PetsResponse.builder()
            .pets(pets)
            .totalCount(pets.size())
            .build();
    }

    public PetResponse toPetResponse(PetInfo info) {
        return PetResponse.builder()
            .petId(String.valueOf(info.petId()))
            .name(info.name())
            .breed(info.breed())
            .birthYm(info.birthYm())
            .age(resolveAge(info.birthYm()))
            .sizeType(toSizeTypeMetadata(info))
            .heatSensitive(info.heatSensitive())
            .coldSensitive(info.coldSensitive())
            .noiseSensitive(info.noiseSensitive())
            .activityLevel(toActivityLevelMetadata(info))
            .walkPreferred(info.walkPreferred())
            .sociality(toSocialityMetadata(info))
            .profileImageUrl(resolveProfileImageUrl(info))
            .build();
    }

    public PetProfileImageUploadResponse toProfileImageUploadResponse(PetInfo info) {
        return PetProfileImageUploadResponse.builder()
            .profileImageKey(info.profileImageKey())
            .profileImageUrl(resolveProfileImageUrl(info))
            .build();
    }

    private PetItem toPetItem(PetInfo info) {
        return PetItem.builder()
            .petId(String.valueOf(info.petId()))
            .name(info.name())
            .breed(info.breed())
            .birthYm(info.birthYm())
            .age(resolveAge(info.birthYm()))
            .sizeType(toSizeTypeMetadata(info))
            .heatSensitive(info.heatSensitive())
            .coldSensitive(info.coldSensitive())
            .noiseSensitive(info.noiseSensitive())
            .activityLevel(toActivityLevelMetadata(info))
            .walkPreferred(info.walkPreferred())
            .sociality(toSocialityMetadata(info))
            .profileImageUrl(resolveProfileImageUrl(info))
            .build();
    }

    /**
     * 오브젝트 키로 공개 URL 을 조립한다. URL 을 DB 에 넣지 않으므로
     * 스토리지 도메인이 바뀌어도 응답만 달라진다. 업로드본이 없으면 null.
     */
    private String resolveProfileImageUrl(PetInfo info) {
        if (info.profileImageKey() != null && !info.profileImageKey().isBlank()) {
            return objectStorageClient.toPublicUrl(info.profileImageKey());
        }
        return null;
    }

    private CodeNameDescriptionMetadata toSizeTypeMetadata(PetInfo info) {
        return CodeNameDescriptionMetadata.of(
            info.sizeType().name(), info.sizeType().getDisplayName(), info.sizeType().getDescription());
    }

    private CodeNameDescriptionMetadata toActivityLevelMetadata(PetInfo info) {
        return CodeNameDescriptionMetadata.of(
            info.activityLevel().name(), info.activityLevel().getDisplayName(), info.activityLevel().getDescription());
    }

    private CodeNameDescriptionMetadata toSocialityMetadata(PetInfo info) {
        return CodeNameDescriptionMetadata.of(
            info.sociality().name(), info.sociality().getDisplayName(), info.sociality().getDescription());
    }

    /**
     * 생년월로 만 나이를 계산한다. 화면 표시 전용 파생값이라 저장하지 않고 응답 시점에 만든다.
     * 값이 없거나 형식이 어긋나면 나이를 비워 응답한다(요청 검증을 통과한 값만 저장되지만,
     * 과거 데이터나 외부 유입을 고려해 방어한다).
     */
    private Integer resolveAge(String birthYm) {
        if (birthYm == null || birthYm.isBlank()) {
            return null;
        }
        try {
            YearMonth birth = YearMonth.parse(birthYm);
            YearMonth now = YearMonth.from(LocalDate.now());
            int months = (int) birth.until(now, ChronoUnit.MONTHS);
            return months < 0 ? null : months / 12;
        } catch (DateTimeParseException exception) {
            return null;
        }
    }
}
