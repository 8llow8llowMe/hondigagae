package com.hondigagae.domainlayer.member.application.service.support;

import com.hondigagae.global.properties.WithdrawnEmailProperties;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 탈퇴 회원의 이메일을 되돌릴 수 없는 다이제스트로 바꾼다.
 *
 * <p><b>단순 SHA-256 을 쓰지 않는 이유</b> — 이메일 공간은 열거 가능하다. 흔한 주소 목록을
 * 그대로 해싱해 맞춰 보면 다이제스트에서 원문이 복원된다. 비밀값(pepper)을 키로 쓰는
 * HMAC-SHA256 은 pepper 를 모르는 쪽에서 후보를 계산할 수 없게 만든다.
 *
 * <p>결과는 hex 64자다. {@code member.email} 컬럼(length 100)에 그대로 들어가므로 스키마를
 * 건드리지 않고 원문 자리를 대체할 수 있다.
 *
 * <p><b>정규화는 {@link EmailNormalizer} 하나만 쓴다.</b> 가입·로그인이 저장/조회에 쓰는 문자열과
 * 다이제스트 입력이 어긋나면 같은 이메일이 다른 다이제스트가 되어 재가입 차단이 뚫린다.
 *
 * <p>pepper 를 바꾸면 기존 다이제스트와 대조할 수 없다. 배경과 대응은
 * {@link WithdrawnEmailProperties} 의 설명을 본다. 교체를 사후에라도 알아채려고 기동 시
 * <b>지문</b>을 INFO 로 남긴다 ({@link #fingerprint()}).
 */
@Slf4j
@Component
public class WithdrawnEmailHasher {

    private static final String ALGORITHM = "HmacSHA256";
    /** HMAC 키로 쓸 최소 길이. 32자 미만이면 pepper 를 비밀로 보기 어렵다. */
    private static final int MINIMUM_PEPPER_LENGTH = 32;

    /**
     * 지문 산출에 쓰는 고정 입력.
     *
     * <p>값 자체에는 의미가 없고 <b>고정</b>이라는 성질만 쓴다 — 입력이 고정이면 출력은 pepper 에만
     * 좌우되므로, 배포 사이에 이 값이 달라졌다는 것은 곧 pepper 가 바뀌었다는 뜻이 된다. 실제
     * 이메일을 쓰지 않는 이유는 로그에 남는 값이 특정 사용자의 다이제스트와 같아지면 안 되기
     * 때문이다. <b>이 상수를 바꾸면 이전 배포 로그와 비교할 수 없게 되므로 바꾸지 않는다.</b>
     */
    private static final String FINGERPRINT_PROBE = "hondigagae-withdrawn-email-pepper-fingerprint";
    /** 지문으로 노출하는 hex 길이. 32비트면 교체를 알아채기에 충분하고 원문 역산에는 턱없이 모자라다. */
    private static final int FINGERPRINT_LENGTH = 8;

    /** {@link Mac} 과 달리 키 스펙은 불변이라 필드로 들고 있어도 안전하다. */
    private final SecretKeySpec secretKey;
    private final String fingerprint;

    /**
     * pepper 가 비었거나 짧으면 <b>기동 시점에</b> 실패시킨다. 빈 pepper 로 조용히 도는 것이
     * 최악이다 — 다이제스트는 정상으로 보이지만 비밀이 없어 누구나 역산할 수 있고, 그 사실은
     * 탈퇴 데이터가 쌓인 뒤에야 드러난다.
     *
     * <p><b>왜 지문을 찍는가</b> — pepper 교체는 오류도 로그도 남기지 않고 재가입 차단만 조용히
     * 뚫는다. 감지 수단이 하나도 없으면 "바꾸지 마라"는 문서 한 줄이 전부다. 고정 입력의 HMAC
     * 앞 8자는 pepper 가 바뀌면 함께 바뀌므로, 배포 전후 기동 로그의 지문을 비교하면 교체를
     * 사후에 알아챌 수 있다. 32비트만 노출하고 원문이 아닌 HMAC 출력이라 <b>이 값으로 pepper 를
     * 역산할 수 없다.</b> pepper 자체는 어디에도 찍지 않는다.
     */
    public WithdrawnEmailHasher(WithdrawnEmailProperties properties) {
        String pepper = properties.pepper() == null ? "" : properties.pepper().strip();
        if (pepper.length() < MINIMUM_PEPPER_LENGTH) {
            throw new IllegalStateException(
                "member.withdrawn-email.pepper 가 비었거나 너무 짧습니다. 환경변수 WITHDRAWN_EMAIL_PEPPER 에 "
                    + MINIMUM_PEPPER_LENGTH + "자 이상의 랜덤 문자열을 설정하세요.");
        }
        this.secretKey = new SecretKeySpec(pepper.getBytes(StandardCharsets.UTF_8), ALGORITHM);
        this.fingerprint = digest(FINGERPRINT_PROBE).substring(0, FINGERPRINT_LENGTH);
        log.info("[WithdrawnEmailHasher] 탈퇴 이메일 해시 pepper 지문: {}", fingerprint);
    }

    /**
     * 현재 pepper 의 지문(hex 8자). 같은 pepper 는 항상 같은 값, 다른 pepper 는 다른 값이다.
     *
     * <p>기동 로그로만 쓰기에는 검증이 어려워 값으로도 꺼내 둔다 — 지문이 pepper 에 반응한다는
     * 성질 자체가 테스트 대상이다.
     */
    public String fingerprint() {
        return fingerprint;
    }

    /**
     * 정규화된 이메일의 HMAC-SHA256 다이제스트를 hex 로 돌려준다.
     *
     * <p>{@link Mac} 은 스레드 안전하지 않아 호출마다 새로 만든다. 탈퇴·가입 빈도에서 인스턴스
     * 풀링은 의미 없는 최적화이고, 공유 인스턴스는 동시 호출 시 조용히 틀린 값을 낸다.
     */
    public String hash(String email) {
        return digest(EmailNormalizer.normalize(email));
    }

    /** 정규화를 거치지 않은 원 HMAC. 이메일이 아닌 입력(지문 상수)도 같은 키로 계산하려고 분리했다. */
    private String digest(String input) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(secretKey);
            return HexFormat.of().formatHex(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            // HmacSHA256 은 표준 JDK 제공 알고리즘이라 정상 환경에서는 도달하지 않는다.
            throw new IllegalStateException("탈퇴 이메일 다이제스트를 계산하지 못했습니다.", e);
        }
    }
}
