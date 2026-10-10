package com.hondigagae.global.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * {@code Content-Disposition} 파일명 파싱 (#888).
 *
 * <p>실측 픽스처는 2026-09-29 {@code fileDownload.do} 응답 헤더 원문 바이트를 재현한다. 포털은 plain
 * {@code filename="…"} 에 UTF-8 바이트를 싣고, HTTP 클라이언트는 그 바이트를 ISO-8859-1 글자로 읽는다.
 */
class ContentDispositionFileNameTest {

    private static final String OLLE_FILE_NAME = "제주특별자치도_올레코스현황_20260731.csv";
    private static final String CULTURE_FILE_NAME = "한국문화정보원_전국 반려동물 동반 가능 문화시설 위치 데이터_20250324.csv";

    /** 응답 헤더 원문 hex 의 앞부분 - {@code filename="제주특} 의 UTF-8 바이트. */
    private static final String MEASURED_OLLE_HEADER_HEX = "66696c656e616d653d22" + "eca09ceca3bced8ab9";

    /** 포털이 보낸 UTF-8 헤더 바이트를 HTTP 클라이언트처럼 ISO-8859-1 로 읽은 문자열. */
    private static String asReceivedByHttpClient(String headerValue) {
        return new String(headerValue.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);
    }

    @Nested
    @DisplayName("실측 포털 헤더 - plain filename 의 UTF-8 바이트")
    class MeasuredPortalHeader {

        @Test
        @DisplayName("올레(15043496) 헤더의 깨진 글자를 UTF-8 로 되읽는다")
        void restoresOlleFileName() {
            String received = asReceivedByHttpClient("attachment; filename=\"" + OLLE_FILE_NAME + "\"");
            String receivedHex = HexFormat.of().formatHex(received.getBytes(StandardCharsets.ISO_8859_1));

            assertThat(receivedHex).contains(MEASURED_OLLE_HEADER_HEX);
            // 0xEC 0xA0 이 "ì" 와 NBSP 두 글자가 된다 - dev 스냅샷 행에 남은 모양 그대로다.
            assertThat(received).contains("ì ");
            assertThat(ContentDispositionFileName.parse(received)).isEqualTo(OLLE_FILE_NAME);
        }

        @Test
        @DisplayName("문화정보원(15111389) 헤더의 깨진 글자를 UTF-8 로 되읽는다 - 공백이 든 이름")
        void restoresCultureFileName() {
            String received = asReceivedByHttpClient("attachment; filename=\"" + CULTURE_FILE_NAME + "\"");

            assertThat(ContentDispositionFileName.parse(received)).isEqualTo(CULTURE_FILE_NAME);
        }
    }

    @Nested
    @DisplayName("되읽지 않고 그대로 두는 경우")
    class KeepsAsIs {

        @Test
        @DisplayName("RFC 5987 filename* 을 우선하고 퍼센트 인코딩을 푼다")
        void prefersExtendedFileName() {
            String parsed = ContentDispositionFileName.parse(
                "attachment; filename=\"fallback.csv\"; filename*=UTF-8''%ED%8C%8C%EC%9D%BC.csv");

            assertThat(parsed).isEqualTo("파일.csv");
        }

        @Test
        @DisplayName("순수 ASCII 이름은 그대로")
        void keepsAsciiFileName() {
            assertThat(ContentDispositionFileName.parse("attachment; filename=\"olle_20260731.csv\"")).isEqualTo("olle_20260731.csv");
        }

        @Test
        @DisplayName("이미 올바른 한글 이름(U+00FF 초과 문자)은 그대로")
        void keepsProperUnicodeFileName() {
            String parsed = ContentDispositionFileName.parse("attachment; filename=\"" + CULTURE_FILE_NAME + "\"");

            assertThat(parsed).isEqualTo(CULTURE_FILE_NAME);
        }

        @Test
        @DisplayName("latin1 바이트가 올바른 UTF-8 이 아닌 진짜 latin1 이름(café)은 그대로")
        void keepsGenuineLatin1FileName() {
            // latin1 로 보낸 é 는 0xE9 한 바이트다. UTF-8 에서 0xE9 는 3바이트 시퀀스의 머리라 뒤의 '.' 에서 깨진다.
            String latin1Name = "café.csv";

            assertThat(ContentDispositionFileName.parse("attachment; filename=\"" + latin1Name + "\"")).isEqualTo(latin1Name);
        }

        @Test
        @DisplayName("plain filename= 은 퍼센트 디코딩하지 않는다 — 인코딩을 선언하지 않는 값이다")
        void keepsPercentInPlainFileName() {
            assertThat(ContentDispositionFileName.parse("attachment; filename=\"50%_할인.csv\"")).isEqualTo("50%_할인.csv");
        }

        @Test
        @DisplayName("헤더가 없거나 비었거나 파일명이 없으면 null — 파일명은 기록용이라 실패로 만들지 않는다")
        void returnsNullWhenHeaderMissing() {
            assertThat(ContentDispositionFileName.parse(null)).isNull();
            assertThat(ContentDispositionFileName.parse("")).isNull();
            assertThat(ContentDispositionFileName.parse("   ")).isNull();
            assertThat(ContentDispositionFileName.parse("attachment")).isNull();
        }
    }
}
