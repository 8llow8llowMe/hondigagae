package com.hondigagae.domainlayer.pet.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetsResponse;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PetPresenter {

    public PetsResponse toPetsResponse(List<PetInfo> infos) {
        List<PetResponse> pets = infos.stream()
            .map(this::toPetResponse)
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
            .sizeType(CodeNameDescriptionMetadata.of(
                info.sizeType().name(), info.sizeType().getDisplayName(), info.sizeType().getDescription()))
            .heatSensitive(info.heatSensitive())
            .coldSensitive(info.coldSensitive())
            .noiseSensitive(info.noiseSensitive())
            .activityLevel(CodeNameDescriptionMetadata.of(
                info.activityLevel().name(), info.activityLevel().getDisplayName(), info.activityLevel().getDescription()))
            .walkPreferred(info.walkPreferred())
            .sociality(CodeNameDescriptionMetadata.of(
                info.sociality().name(), info.sociality().getDisplayName(), info.sociality().getDescription()))
            .build();
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
            int months = (int) birth.until(now, java.time.temporal.ChronoUnit.MONTHS);
            return months < 0 ? null : months / 12;
        } catch (DateTimeParseException exception) {
            return null;
        }
    }
}
