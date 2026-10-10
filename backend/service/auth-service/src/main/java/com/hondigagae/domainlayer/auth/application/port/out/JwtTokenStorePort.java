package com.hondigagae.domainlayer.auth.application.port.out;

import com.hondigagae.domainlayer.auth.application.port.out.query.RefreshSessionQueryResult;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

public interface JwtTokenStorePort {

    /**
     * 기기(세션)별로 refresh 토큰을 저장한다. sessionId 는 refresh 토큰의 jti 로,
     * 토큰이 회전해도 같은 기기는 같은 sessionId 를 유지한다.
     * 회원당 세션 수가 상한을 넘으면 가장 오래 갱신되지 않은 세션부터 밀어낸다.
     */
    void save(long memberId, String sessionId, String refreshToken);

    Optional<String> find(long memberId, String sessionId);

    /**
     * 활성 세션(로그인 기기) 목록 — 최근 갱신순. refresh 키가 이미 만료돼 인덱스에만 남은
     * 세션은 결과에서 빠진다.
     */
    List<RefreshSessionQueryResult> findSessions(long memberId);

    /** 특정 기기 세션만 무효화한다 (로그아웃). */
    void deleteSession(long memberId, String sessionId);

    /**
     * 저장된 refresh 토큰이 기대값과 같을 때만 세션을 <b>원자적으로</b> 지운다 — 재발급 회전 전용.
     * "조회 → 비교 → 삭제"를 나눠 하면 동시 재발급 두 건이 모두 비교를 통과해 세션이 증식하고,
     * 탈취 토큰의 동시 재생도 둘 다 성공할 수 있다.
     *
     * @return 지웠으면 true. false 는 다른 요청이 먼저 회전시켰거나 이미 만료된 경우다
     */
    boolean deleteSessionIfTokenMatches(long memberId, String sessionId, String expectedToken);

    /** 회원의 전 기기 세션을 무효화한다 (탈퇴/비밀번호 변경/상태 이상). */
    void deleteAllSessions(long memberId);

    void saveAccessTokenIdBlacklist(String tokenId, Duration ttl);
}
