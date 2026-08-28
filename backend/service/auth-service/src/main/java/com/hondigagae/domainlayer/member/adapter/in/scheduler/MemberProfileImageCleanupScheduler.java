package com.hondigagae.domainlayer.member.adapter.in.scheduler;

import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.storage.client.ObjectStorageClient;
import com.hondigagae.storage.model.StorageDomain;
import java.time.Duration;
import java.util.HashSet;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 회원 프로필 이미지의 고아 객체 청소.
 *
 * <p>업로드 → DB 반영 → 이전 파일 삭제의 보상 흐름은 프로세스가 중간에 죽으면 구멍이 난다
 * (올렸는데 DB 반영 전에 종료 등). 이 스케줄러가 그 잔여물을 회수한다 — DB 어디에서도
 * 참조되지 않는 오래된 객체만 지운다.
 *
 * <p><b>나이 조건(2일)이 안전장치다.</b> 방금 업로드해 아직 DB 에 연결되지 않은 객체를
 * 지우지 않아야 하므로, 업로드-연결 사이 시간차보다 압도적으로 큰 값을 쓴다.
 * 삭제는 멱등이라 다중 인스턴스가 동시에 돌아도 안전하다(분산 락 불필요).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberProfileImageCleanupScheduler {

    private static final Duration MINIMUM_AGE = Duration.ofDays(2);

    private final MemberRepositoryPort memberRepositoryPort;
    private final ObjectStorageClient objectStorageClient;

    @Scheduled(cron = "${storage-cleanup.member-cron:0 30 4 * * *}")
    public void cleanUpOrphanImages() {
        var candidates = objectStorageClient.listObjectKeysOlderThan(
            StorageDomain.MEMBER_PROFILE.prefix() + "/", MINIMUM_AGE);
        if (candidates.isEmpty()) {
            return;
        }
        var referencedKeys = new HashSet<>(memberRepositoryPort.findAllProfileImageKeys());
        long deleted = candidates.stream()
            .filter(objectKey -> !referencedKeys.contains(objectKey))
            .peek(objectStorageClient::deleteQuietly)
            .count();
        log.info("회원 프로필 고아 이미지 청소 완료. candidates={} referenced={} deleted={}",
            candidates.size(), referencedKeys.size(), deleted);
    }
}
