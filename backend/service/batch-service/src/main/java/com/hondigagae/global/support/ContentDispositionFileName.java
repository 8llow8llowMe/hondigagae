package com.hondigagae.global.support;

import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * {@code Content-Disposition} 헤더에서 파일명을 꺼낸다 (#888).
 *
 * <p>공공데이터포털 파일 다운로드({@code fileDownload.do})를 쓰는 두 어댑터 - 문화정보원
 * ({@code placeimport})과 올레({@code walkcourseimport}) - 가 같이 쓴다. HTTP 헤더를 읽는 어댑터
 * 계층 유틸이라 어느 한 컨텍스트의 어댑터에 두면 다른 컨텍스트가 남의 어댑터에 기대게 된다.
 * 그래서 컨텍스트 밖 {@code global.support} 에 둔다.
 *
 * <p><b>포털의 plain {@code filename} 은 UTF-8 바이트다.</b> 2026-09-29 응답 헤더 원문을 떠 보면
 * 포털은 {@code filename*} 없이 {@code filename="…"} 에 UTF-8 바이트를 그대로 싣는다. HTTP 클라이언트는
 * 헤더를 ISO-8859-1 로 읽으므로 바이트 하나가 글자 하나가 되어 {@code ì ì£¼…} 처럼 깨진다. latin1 로
 * 되돌린 바이트가 UTF-8 로 <b>엄격하게</b> 읽힐 때만 되읽는다 - 진짜 latin1 이름({@code café})이나 이미
 * 올바른 유니코드 이름은 그대로 둔다.
 *
 * <p>사람이 어느 판본인지 알아보는 값일 뿐이라 <b>못 읽어도 실패시키지 않는다</b> - null 을 돌려준다.
 * 스냅샷 갱신 판정은 파일 ID 와 바이트 수가 한다.
 */
public final class ContentDispositionFileName {

    private static final Pattern FILENAME_EXT_PATTERN =
        Pattern.compile("filename\\*\\s*=\\s*([^']*)'([^']*)'([^;]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FILENAME_PATTERN =
        Pattern.compile("filename\\s*=\\s*\"?([^\";]+)\"?", Pattern.CASE_INSENSITIVE);

    private static final char LATIN1_MAX = '\u00FF';
    private static final char ASCII_MAX = '\u007F';

    private ContentDispositionFileName() {
    }

    /**
     * RFC 5987 {@code filename*} 을 우선하고, 없으면 plain {@code filename} 을 읽는다.
     *
     * <p>퍼센트 디코딩은 {@code filename*} 에만 건다. plain {@code filename} 은 인코딩을 선언하지
     * 않는 값이라, 이름에 {@code %} 가 들어간 파일을 디코딩하면 없던 글자로 바꿔 버린다.
     *
     * @return 파일명. 헤더가 없거나 파일명이 없으면 null
     */
    public static String parse(String contentDisposition) {
        if (contentDisposition == null || contentDisposition.isBlank()) {
            return null;
        }
        Matcher extended = FILENAME_EXT_PATTERN.matcher(contentDisposition);
        if (extended.find()) {
            String charsetName = extended.group(1).isBlank() ? StandardCharsets.UTF_8.name() : extended.group(1).trim();
            String raw = extended.group(3).trim().replace("\"", "");
            return percentDecodeQuietly(raw, charsetName);
        }
        Matcher plain = FILENAME_PATTERN.matcher(contentDisposition);
        return plain.find() ? reinterpretLatin1AsUtf8(plain.group(1).trim()) : null;
    }

    /**
     * latin1 로 읽힌 UTF-8 바이트를 되읽는다. 되읽을 수 없으면 받은 그대로 돌려준다.
     *
     * <ul>
     *   <li>ASCII 만 - 되읽어도 같으니 그대로</li>
     *   <li>U+00FF 를 넘는 글자가 있다 - latin1 으로 읽힌 값이 아니다(이미 올바른 유니코드). 그대로</li>
     *   <li>latin1 바이트가 올바른 UTF-8 이 아니다 - 진짜 latin1 이름이다. 그대로</li>
     * </ul>
     */
    static String reinterpretLatin1AsUtf8(String value) {
        boolean hasNonAscii = false;
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current > LATIN1_MAX) {
                return value;
            }
            if (current > ASCII_MAX) {
                hasNonAscii = true;
            }
        }
        if (!hasNonAscii) {
            return value;
        }
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(value.getBytes(StandardCharsets.ISO_8859_1)))
                .toString();
        } catch (CharacterCodingException exception) {
            return value;
        }
    }

    private static String percentDecodeQuietly(String raw, String charsetName) {
        try {
            return URLDecoder.decode(raw, Charset.forName(charsetName));
        } catch (RuntimeException exception) {
            // 잘못된 퍼센트 인코딩이나 모르는 charset. 파일명은 기록용이라 원문 그대로 둔다.
            return raw;
        }
    }
}
