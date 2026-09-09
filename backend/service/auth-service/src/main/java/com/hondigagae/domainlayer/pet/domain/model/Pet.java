package com.hondigagae.domainlayer.pet.domain.model;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import java.math.BigDecimal;
import lombok.Builder;

/**
 * 반려견 프로필. AI 여행 설계의 핵심 입력이며 이 서비스가 단일 원천이다.
 *
 * <p>{@code birthYm}은 생년월(yyyy-MM) 문자열로 다룬다. 일 단위 정보는 필요 없고,
 * 사용자가 정확한 생일을 모르는 경우가 많아 월 단위까지만 받는다.
 */
@Builder(toBuilder = true)
public record Pet(
    long id,
    long memberId,
    String name,
    String breed,
    String birthYm,
    PetSizeType sizeType,
    BigDecimal weightKg,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    ActivityLevel activityLevel,
    boolean walkPreferred,
    SocialityLevel sociality,
    String profileImageKey,
    boolean representative,
    boolean deleted
) {

    public Pet update(
        String name, String breed, String birthYm, PetSizeType sizeType, BigDecimal weightKg,
        boolean heatSensitive, boolean coldSensitive, boolean noiseSensitive,
        ActivityLevel activityLevel, boolean walkPreferred, SocialityLevel sociality
    ) {
        return toBuilder()
            .name(name).breed(breed).birthYm(birthYm).sizeType(sizeType).weightKg(weightKg)
            .heatSensitive(heatSensitive).coldSensitive(coldSensitive).noiseSensitive(noiseSensitive)
            .activityLevel(activityLevel).walkPreferred(walkPreferred).sociality(sociality)
            .build();
    }

    /** 대표 반려견 지정. 회원당 하나만 대표가 되도록 해제는 Processor 가 책임진다. */
    public Pet markRepresentative() {
        return toBuilder().representative(true).build();
    }

    public Pet clearRepresentative() {
        return toBuilder().representative(false).build();
    }

    public Pet updateProfileImageKey(String profileImageKey) {
        return toBuilder().profileImageKey(profileImageKey).build();
    }

    public Pet removeProfileImage() {
        return toBuilder().profileImageKey(null).build();
    }

    /**
     * 소프트 삭제. 이미 생성된 여행 일정이 petId를 참조하므로 물리 삭제하지 않는다.
     */
    public Pet delete() {
        return toBuilder().deleted(true).build();
    }

    public boolean isOwnedBy(long memberId) {
        return this.memberId == memberId;
    }

    /**
     * 생년월에서 파생한 나이(개월 수).
     *
     * <p>내부 계약이 생년월 <b>원문 대신</b> 이 파생값을 내보낸다 — 판정(노령견·퍼피 구분)에
     * 필요한 것은 나이이지 생년월이 아니고, 서비스 경계를 넘는 개인정보는 최소로 유지한다 (#367).
     *
     * <p>생년월이 없거나 형식이 어긋나거나 미래면 null 이다 — 나이를 지어내지 않는다.
     * 미래 생년월은 저장이 막혀 있지만({@code PetErrorCode.BIRTH_YM_IN_FUTURE}) 방어한다.
     */
    public static Integer ageMonths(String birthYm, java.time.YearMonth now) {
        if (birthYm == null || birthYm.isBlank()) {
            return null;
        }
        try {
            long months = java.time.YearMonth.parse(birthYm).until(now, java.time.temporal.ChronoUnit.MONTHS);
            return months < 0 ? null : (int) months;
        } catch (java.time.format.DateTimeParseException exception) {
            return null;
        }
    }
}
