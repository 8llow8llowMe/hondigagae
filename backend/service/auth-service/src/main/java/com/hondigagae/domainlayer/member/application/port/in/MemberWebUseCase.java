package com.hondigagae.domainlayer.member.application.port.in;

import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberProfileImageUploadResponse;
import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.storage.model.FileUploadCommand;

public interface MemberWebUseCase {

    void generalSignup(MemberGeneralSignupCommand command);

    MemberMyInfoResponse getMyInfo(long memberId);

    MemberMyInfoResponse updateMyInfo(long memberId, String nickname);

    MemberProfileImageUploadResponse uploadProfileImage(long memberId, FileUploadCommand command);

    MemberMyInfoResponse removeProfileImage(long memberId);

    void changePassword(long memberId, String tokenId, String currentPassword, String newPassword);

    /** 소셜 전용 계정(비밀번호 없음)에 비밀번호를 최초 설정한다 — 이메일 로그인 수단 추가. */
    void setupPassword(long memberId, String newPassword);

    /** 비밀번호를 제거해 소셜 전용 계정으로 전환한다 — 소셜 연결 계정만 허용, 전 기기 세션 무효화. */
    void removePassword(long memberId, String tokenId);

    void withdraw(long memberId, String tokenId);
}
