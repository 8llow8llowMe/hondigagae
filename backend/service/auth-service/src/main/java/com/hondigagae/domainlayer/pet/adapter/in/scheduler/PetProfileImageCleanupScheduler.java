package com.hondigagae.domainlayer.pet.adapter.in.scheduler;

import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.storage.client.ObjectStorageClient;
import com.hondigagae.storage.model.StorageDomain;
import java.time.Duration;
import java.util.HashSet;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 반려견 프로필 이미지의 고아 객체 청소. 구조와 이유는 회원 쪽
 * ({@code MemberProfileImageCleanupScheduler})과 같다 — 보상 흐름의 구멍(중간 종료)으로
 * 남은, DB 어디에서도 참조되지 않는 오래된 객체만 지운다.
 *
 * <p>소프트 삭제된 반려견의 키도 참조로 본다 — 행이 남아 있는 한 지우지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PetProfileImageCleanupScheduler {

    private static final Duration MINIMUM_AGE = Duration.ofDays(2);

    private final PetRepositoryPort petRepositoryPort;
    private final ObjectStorageClient objectStorageClient;

    @Scheduled(cron = "${storage-cleanup.pet-cron:0 40 4 * * *}")
    public void cleanUpOrphanImages() {
        var candidates = objectStorageClient.listObjectKeysOlderThan(
            StorageDomain.PET_PROFILE.prefix() + "/", MINIMUM_AGE);
        if (candidates.isEmpty()) {
            return;
        }
        var referencedKeys = new HashSet<>(petRepositoryPort.findAllProfileImageKeys());
        long deleted = candidates.stream()
            .filter(objectKey -> !referencedKeys.contains(objectKey))
            .peek(objectStorageClient::deleteQuietly)
            .count();
        log.info("반려견 프로필 고아 이미지 청소 완료. candidates={} referenced={} deleted={}",
            candidates.size(), referencedKeys.size(), deleted);
    }
}
