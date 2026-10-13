package com.hondigagae.domainlayer.planner.application.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.pet.PetSizeType;
import java.math.BigDecimal;
import java.util.List;

/**
 * 동행견이 후보 장소에 들어갈 수 있는가 — 일정 생성의 입장 판정 (#1420).
 *
 * <p>운영에서 보리(웰시코기 · 중형견 · 체중 미상) + 몽실이(말티즈 · 소형견 3.2kg) 일정 3일차에 한림공원(소형견만 가능 ·
 * "7kg 이하")이 들어갔고, 보리 단독 일정에는 돈내코힐 리조트가 같은 사유로 들어갔다. 프롬프트의 후보 줄(입장크기 ·
 * 체중제한)과 다견 규칙 지시만 있고 서버 검증이 없었다. 동반 가능 숙박 중 중형견 15kg 이 들어갈 수 있는 곳은 27곳,
 * 대형견 30kg 은 17곳뿐이라 숙박에서 특히 자주 틀린다.
 *
 * <p><b>일정 생성은 가장 제약이 큰 아이가 기준이다</b> — 한 마리라도 못 들어가면 그 장소는 갈 수 없다
 * (services/ai-service.md "다견 규칙은 쓰임마다 반대다"). 그래서 여러 마리를 <b>가장 큰 크기 · 가장 무거운 유효 체중</b>
 * 하나로 접는다. {@link AllowedPetSize#allows} 와 체중 비교가 모두 단조라 이 하나가 통과하는 것은 "모든 아이가 통과" 와 같다.
 *
 * <p>판정은 tour-service 장소 검색 필터({@code PlaceCustomRepositoryImpl})와 <b>같은 규칙</b>이다 — 검색이 거른 것과 여기서
 * 거른 것이 갈라지면 같은 장소가 경로에 따라 들어가기도 하고 빠지기도 한다. 후보 검색에는 이 {@link #sizeType()} 과
 * {@link #weightKg()}(유효 체중)를 그대로 넘기므로 검색과 {@link #admits} 가 같은 값으로 판정한다. 검색 파라미터 형식으로 바꾸는
 * 일(정수화 · 범위)은 어댑터가 한다.
 * <ul>
 *   <li>크기: {@link AllowedPetSize#allows(PetSizeType)}. 장소 크기가 정보 없음 · null 이거나 반려견 크기를 모르면 통과다</li>
 *   <li>체중: 장소 상한이 없거나 {@code 유효 체중 <= 상한} 이면 통과</li>
 *   <li><b>유효 체중</b>은 아는 체중이고, 모르면 크기 구간의 하한이다({@link #lowerBoundKg} — 중형견 10kg, 대형견 25kg, 소형견은
 *       하한이 없어 체중으로 막지 않는다). 하한은 추정이 아니라 {@link PetSizeType} 정의에서 나오는 값이라 과잉 배제가 없다 —
 *       체중 미상 중형견은 "7kg 이하" 장소에 확실히 못 들어간다. <b>체중을 아는 아이에게는 하한을 쓰지 않는다</b> — 8kg 인데
 *       중형견으로 저장된 불일치 데이터를 과잉 배제하지 않는다</li>
 *   <li>크기가 없고 체중만 있는 아이는 {@link PetSizeType#fromWeight} 로 크기를 얻는다</li>
 * </ul>
 *
 * @param sizeType 가장 큰 크기. 아무도 크기를 모르면 null — 크기로는 막지 않는다
 * @param weightKg 가장 무거운 유효 체중(kg). 유효 체중이 있는 아이가 없으면 null — 체중으로는 막지 않는다
 */
public record PetAdmission(PetSizeType sizeType, BigDecimal weightKg) {

    /** 반려견 정보가 없을 때 — 아무 장소도 막지 않고, 검색 조건도 걸지 않는다. 없는 제약을 지어내지 않는다. */
    public static final PetAdmission ANY = new PetAdmission(null, null);

    /**
     * 크기 구간의 체중 하한 — core {@code PetSizeType} 의 경계(MEDIUM_MIN_KG · LARGE_MIN_KG)와 같은 값이다. 그 상수가 private 이라
     * 여기 다시 적는다. 어긋나면 {@code PetAdmissionTest} 가 {@link PetSizeType#fromWeight} 로 잡는다.
     */
    private static final BigDecimal MEDIUM_MIN_KG = BigDecimal.valueOf(10);
    private static final BigDecimal LARGE_MIN_KG = BigDecimal.valueOf(25);

    /** 동행견들을 가장 제약이 큰 하나로 접는다. 비었거나 null 이면 {@link #ANY}. */
    public static PetAdmission of(List<PetCondition> pets) {
        if (pets == null || pets.isEmpty()) {
            return ANY;
        }
        PetSizeType largest = null;
        BigDecimal heaviest = null;
        for (PetCondition pet : pets) {
            if (pet == null) {
                continue;
            }
            PetSizeType size = pet.sizeType() != null ? pet.sizeType() : PetSizeType.fromWeight(pet.weightKg());
            // 선언 순서가 SMALL < MEDIUM < LARGE 다
            if (size != null && (largest == null || size.compareTo(largest) > 0)) {
                largest = size;
            }
            // 아는 체중이 우선이다 — 하한은 체중을 모를 때만 쓴다
            BigDecimal weight = pet.weightKg() != null ? pet.weightKg() : lowerBoundKg(pet.sizeType());
            if (weight != null && (heaviest == null || weight.compareTo(heaviest) > 0)) {
                heaviest = weight;
            }
        }
        return largest == null && heaviest == null ? ANY : new PetAdmission(largest, heaviest);
    }

    /**
     * 크기 구간의 체중 하한(kg). 소형견 · null 은 하한이 없어 null 이다.
     *
     * <p>체중을 모르는 아이의 체중 대신 쓴다 — 정의상 그 크기라면 적어도 이만큼은 나가므로 확실히 못 들어가는 곳만 막는다.
     */
    static BigDecimal lowerBoundKg(PetSizeType sizeType) {
        if (sizeType == null) {
            return null;
        }
        return switch (sizeType) {
            case SMALL -> null;
            case MEDIUM -> MEDIUM_MIN_KG;
            case LARGE -> LARGE_MIN_KG;
        };
    }

    /** 이 후보에 동행견이 모두 들어갈 수 있는가. */
    public boolean admits(PlaceCandidate candidate) {
        return admits(candidate.allowedPetSize(), candidate.maxPetWeightKg());
    }

    /**
     * @param allowedPetSize 장소가 받는 크기. null · {@link AllowedPetSize#UNKNOWN} 이면 크기로는 막지 않는다
     * @param maxPetWeightKg 장소의 체중 상한(kg, 포함). null 이면 체중으로는 막지 않는다
     */
    public boolean admits(AllowedPetSize allowedPetSize, Integer maxPetWeightKg) {
        boolean sizeAdmitted = allowedPetSize == null || allowedPetSize.allows(sizeType);
        boolean weightAdmitted = maxPetWeightKg == null || weightKg == null
            || weightKg.compareTo(BigDecimal.valueOf(maxPetWeightKg)) <= 0;
        return sizeAdmitted && weightAdmitted;
    }
}
