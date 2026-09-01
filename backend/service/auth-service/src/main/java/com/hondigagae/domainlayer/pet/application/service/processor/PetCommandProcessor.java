package com.hondigagae.domainlayer.pet.application.service.processor;

import com.hondigagae.domainlayer.pet.application.command.PetSaveCommand;
import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.application.info.PetProfileImageChangeResult;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PetCommandProcessor {

    /** 한 회원이 등록할 수 있는 반려견 수. 개인 사용자 기준으로 충분한 상한이다. */
    private static final long MAX_PET_COUNT = 5L;

    private final PetQueryProcessor petQueryProcessor;
    private final PetRepositoryPort petRepositoryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public PetInfo register(long memberId, PetSaveCommand command) {
        validateBirthYm(command.birthYm());
        long petCount = petRepositoryPort.countByMemberId(memberId);
        if (petCount >= MAX_PET_COUNT) {
            throw new PetException(PetErrorCode.PET_LIMIT_EXCEEDED);
        }

        Pet pet = Pet.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(memberId)
            .name(command.name())
            .breed(command.breed())
            .birthYm(command.birthYm())
            .sizeType(command.sizeType())
            .weightKg(command.weightKg())
            .heatSensitive(command.heatSensitive())
            .coldSensitive(command.coldSensitive())
            .noiseSensitive(command.noiseSensitive())
            .activityLevel(command.activityLevel())
            .walkPreferred(command.walkPreferred())
            .sociality(command.sociality())
            // 첫 반려견은 자동으로 대표가 된다 - 한 마리만 키우는 사용자가 대표 지정을 모르고 지나가도 AI 기본값이 동작한다
            .representative(petCount == 0)
            .deleted(false)
            .build();

        return PetInfo.from(petRepositoryPort.save(pet));
    }

    public PetInfo update(long memberId, long petId, PetSaveCommand command) {
        validateBirthYm(command.birthYm());
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        Pet updated = pet.update(
            command.name(), command.breed(), command.birthYm(), command.sizeType(), command.weightKg(),
            command.heatSensitive(), command.coldSensitive(), command.noiseSensitive(),
            command.activityLevel(), command.walkPreferred(), command.sociality()
        );
        return PetInfo.from(petRepositoryPort.save(updated));
    }

    // 파사드가 스토리지 I/O 를 트랜잭션 밖에 두므로(업로드 → DB 반영 → 회수) DB 구간은 여기서 경계를 연다.
    @Transactional
    public PetProfileImageChangeResult updateProfileImage(long memberId, long petId, String objectKey) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        String previousObjectKey = pet.profileImageKey();
        Pet updated = petRepositoryPort.save(pet.updateProfileImageKey(objectKey));
        return new PetProfileImageChangeResult(PetInfo.from(updated), previousObjectKey);
    }

    @Transactional
    public PetProfileImageChangeResult removeProfileImage(long memberId, long petId) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        String previousObjectKey = pet.profileImageKey();
        Pet updated = petRepositoryPort.save(pet.removeProfileImage());
        return new PetProfileImageChangeResult(PetInfo.from(updated), previousObjectKey);
    }

    public void delete(long memberId, long petId) {
        Pet pet = petQueryProcessor.getOwnedPet(memberId, petId);
        petRepositoryPort.save(pet.delete());

        // 대표견을 지웠으면 가장 먼저 등록한 남은 반려견을 대표로 올린다 -
        // "대표 없음" 상태를 만들지 않아 AI 기본값이 항상 동작하게 한다.
        if (pet.representative()) {
            petRepositoryPort.findAllByMemberId(memberId).stream()
                .filter(remaining -> remaining.id() != petId)
                .findFirst()
                .ifPresent(remaining -> petRepositoryPort.save(remaining.markRepresentative()));
        }
    }

    /**
     * 생년월 미래 금지. 형식(@Pattern)은 요청 검증이 보지만 "지금보다 뒤인가"는 시계가 필요해
     * 여기서 본다 — 형식만 보면 9999-12 가 저장되고 나이 계산이 화면에서만 방어된다.
     */
    private void validateBirthYm(String birthYm) {
        if (birthYm == null || birthYm.isBlank()) {
            return;
        }
        try {
            if (java.time.YearMonth.parse(birthYm).isAfter(java.time.YearMonth.now())) {
                throw new PetException(PetErrorCode.BIRTH_YM_IN_FUTURE);
            }
        } catch (java.time.format.DateTimeParseException exception) {
            // 형식은 요청 검증(@Pattern) 담당 — 여기까지 왔다면 방어적으로 통과시킨다.
        }
    }

    /** 대표 반려견 지정. 기존 대표는 해제해 회원당 하나만 유지한다. */
    public PetInfo markRepresentative(long memberId, long petId) {
        Pet target = petQueryProcessor.getOwnedPet(memberId, petId);
        petRepositoryPort.findAllByMemberId(memberId).stream()
            .filter(Pet::representative)
            .filter(pet -> pet.id() != petId)
            .forEach(pet -> petRepositoryPort.save(pet.clearRepresentative()));
        return PetInfo.from(petRepositoryPort.save(target.markRepresentative()));
    }
}
