package com.hondigagae.domainlayer.member.application.service;

import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberProfileImageUploadResponse;
import com.hondigagae.domainlayer.member.adapter.in.web.presenter.MemberPresenter;
import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.domainlayer.member.application.info.MemberMyInfo;
import com.hondigagae.domainlayer.member.application.info.MemberProfileImageChangeResult;
import com.hondigagae.domainlayer.member.application.port.in.MemberWebUseCase;
import com.hondigagae.domainlayer.member.application.port.out.MemberMailNotifyPort;
import com.hondigagae.domainlayer.member.application.port.out.MemberSessionRevokePort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.domainlayer.member.application.service.processor.MemberCommandProcessor;
import com.hondigagae.domainlayer.member.application.service.processor.MemberGeneralSignupProcessor;
import com.hondigagae.domainlayer.member.application.service.processor.MemberQueryProcessor;
import com.hondigagae.storage.client.ObjectStorageClient;
import com.hondigagae.storage.model.FileUploadCommand;
import com.hondigagae.storage.model.StorageDomain;
import com.hondigagae.storage.model.StoredObject;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class MemberWebFacade implements MemberWebUseCase {

    private final MemberGeneralSignupProcessor memberGeneralSignupProcessor;
    private final MemberQueryProcessor memberQueryProcessor;
    private final MemberCommandProcessor memberCommandProcessor;
    private final MemberSessionRevokePort memberSessionRevokePort;
    private final MemberMailNotifyPort memberMailNotifyPort;
    private final MemberPresenter memberPresenter;
    private final ObjectStorageClient objectStorageClient;

    @Override
    @Transactional
    public void generalSignup(MemberGeneralSignupCommand command) {
        memberGeneralSignupProcessor.generalSignup(command);
    }

    @Override
    @Transactional(readOnly = true)
    public MemberMyInfoResponse getMyInfo(long memberId) {
        MemberMyInfo memberMyInfo = memberQueryProcessor.getMyInfo(memberId);
        return memberPresenter.toMyInfoResponse(memberMyInfo);
    }

    @Override
    @Transactional
    public MemberMyInfoResponse updateMyInfo(long memberId, String nickname) {
        MemberMyInfo memberMyInfo = memberCommandProcessor.updateMyInfo(memberId, nickname);
        return memberPresenter.toMyInfoResponse(memberMyInfo);
    }

    /**
     * 프로필 이미지 업로드.
     *
     * <p>이 메서드에 {@code @Transactional} 을 붙이지 않는다. 스토리지 업로드는 원격 I/O 라
     * 트랜잭션 안에서 수행하면 DB 커넥션을 잡은 채 대기하게 된다. 대신 순서를 이렇게 잡는다.
     * <ol>
     *   <li>업로드 (트랜잭션 밖)</li>
     *   <li>DB 반영 (Processor 의 트랜잭션)</li>
     *   <li>성공 시 이전 객체 삭제 / 실패 시 방금 올린 객체 회수</li>
     * </ol>
     * 어느 단계에서 끊겨도 "DB 에는 있는데 파일이 없는" 상태가 되지 않는다.
     */
    @Override
    public MemberProfileImageUploadResponse uploadProfileImage(long memberId, FileUploadCommand command) {
        StoredObject storedObject = objectStorageClient.uploadImage(StorageDomain.MEMBER_PROFILE, memberId, command);
        try {
            MemberProfileImageChangeResult result = memberCommandProcessor.updateProfileImage(memberId, storedObject.objectKey());
            objectStorageClient.deleteQuietly(result.previousObjectKey());
            return memberPresenter.toProfileImageUploadResponse(result.memberMyInfo());
        } catch (RuntimeException exception) {
            // DB 반영에 실패했으므로 방금 올린 객체는 어디에서도 참조되지 않는다. 즉시 회수한다.
            objectStorageClient.deleteQuietly(storedObject.objectKey());
            throw exception;
        }
    }

    @Override
    public MemberMyInfoResponse removeProfileImage(long memberId) {
        MemberProfileImageChangeResult result = memberCommandProcessor.removeProfileImage(memberId);
        objectStorageClient.deleteQuietly(result.previousObjectKey());
        return memberPresenter.toMyInfoResponse(result.memberMyInfo());
    }

    @Override
    @Transactional
    public void changePassword(long memberId, String tokenId, String currentPassword, String newPassword) {
        // 1. 비밀번호 변경
        memberCommandProcessor.changePassword(memberId, currentPassword, newPassword);

        // 2. 세션 무효화 (refresh 삭제 + 현재 access 블랙리스트).
        //    실패 시 예외가 전파되어 비밀번호 변경도 함께 롤백된다 — 무효화 없는 성공을 만들지 않는다.
        memberSessionRevokePort.revokeAllSessions(memberId, tokenId);
    }

    @Override
    @Transactional
    public void setupPassword(long memberId, String newPassword) {
        // 로그인 수단 "추가"라 기존 세션과 무관 — 비밀번호 변경과 달리 세션을 무효화하지 않는다.
        memberCommandProcessor.setupPassword(memberId, newPassword);
    }

    @Override
    @Transactional
    public void removePassword(long memberId, String tokenId) {
        // 1. 비밀번호 제거 (소셜 연결 계정만 허용 — 마지막 로그인 수단 제거 방지)
        Member converted = memberCommandProcessor.removePassword(memberId);

        // 2. 세션 무효화 — 로그인 수단이 줄어드는 보안 이벤트라 비밀번호 변경과 동일하게
        //    전 기기를 무효화하고, 실패 시 전파되어 제거도 함께 롤백된다.
        memberSessionRevokePort.revokeAllSessions(memberId, tokenId);

        // 3. 전환 사실 통보. 발송은 비동기(@Async)라 여기서 바로 부르면 커밋 전에 다른 스레드로
        //    나간다 — 2번이 실패해 롤백되면 "전환됐다"는 메일만 남는다. 커밋 뒤로 미룬다.
        String email = converted.email();
        String provider = converted.provider().getDescription();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                memberMailNotifyPort.notifyPasswordRemoved(email, provider);
            }
        });
    }

    @Override
    @Transactional
    public void withdraw(long memberId, String tokenId) {
        // 1. 논리 탈퇴 (상태 전이 + 개인정보 마스킹)
        String previousObjectKey = memberCommandProcessor.withdraw(memberId);

        // 2. 세션 무효화 — 실패 시 탈퇴도 함께 롤백된다.
        memberSessionRevokePort.revokeAllSessions(memberId, tokenId);

        // 3. 프로필 이미지 정리. 커밋 이후에 지워야 롤백 시 파일만 사라지는 상태를 막는다.
        objectStorageClient.deleteAfterCommit(previousObjectKey);
    }
}
