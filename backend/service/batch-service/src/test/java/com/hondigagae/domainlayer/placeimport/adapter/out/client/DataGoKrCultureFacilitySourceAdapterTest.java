package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilitySourceQueryResult;
import com.hondigagae.global.properties.CultureFacilityProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * 포털 상세 페이지 파싱과 내려받은 파일의 최소 검증.
 *
 * <p><b>실제 포털에 요청을 보내지 않는다.</b> 여기서 고정하는 것은 HTTP 가 아니라 "우리가 받은
 * 바이트를 어떻게 읽는가"다 — 파싱과 검증을 static/package-private 으로 떼어 둔 이유가 이것이다.
 * 픽스처는 2026-09 실측 응답 형태를 옮긴 것이다.
 */
class DataGoKrCultureFacilitySourceAdapterTest {

    private static final String CONTENT_URL =
        "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003214426&fileDetailSn=1&insertDataPrcus=N";

    private static String pageWith(String jsonLd) {
        return """
            <!DOCTYPE html><html><head><title>한국문화정보원_전국 반려동물 동반 가능 문화시설 위치 데이터</title>
            <script type="application/ld+json">
            %s
            </script>
            </head><body><div id="contents">본문</div></body></html>
            """.formatted(jsonLd);
    }

    @Nested
    @DisplayName("JSON-LD 파싱")
    class ParseSource {

        @Test
        @DisplayName("distribution 의 DataDownload 에서 atchFileId·fileDetailSn·contentUrl 을 뽑는다")
        void extractsDownloadUrlFromDistribution() {
            String html = pageWith("""
                {"@context":"https://schema.org","@type":"Dataset","name":"전국 반려동물 동반 가능 문화시설 위치 데이터",
                 "distribution":[{"@type":"DataDownload","encodingFormat":"CSV","contentUrl":"%s"}]}
                """.formatted(CONTENT_URL));

            CultureFacilitySourceQueryResult source = DataGoKrCultureFacilitySourceAdapter.parseSource(html);

            assertThat(source.fileId()).isEqualTo("FILE_000000003214426");
            assertThat(source.fileDetailSn()).isEqualTo("1");
            assertThat(source.contentUrl()).isEqualTo(CONTENT_URL);
        }

        @Test
        @DisplayName("CSV 아닌 배포본이 먼저 와도 encodingFormat 이 CSV 인 쪽을 고른다")
        void prefersCsvDistribution() {
            String jsonUrl = CONTENT_URL.replace("fileDetailSn=1", "fileDetailSn=2");
            String html = pageWith("""
                {"@context":"https://schema.org","@type":"Dataset",
                 "distribution":[{"@type":"DataDownload","encodingFormat":"JSON","contentUrl":"%s"},
                                 {"@type":"DataDownload","encodingFormat":"CSV","contentUrl":"%s"}]}
                """.formatted(jsonUrl, CONTENT_URL));

            assertThat(DataGoKrCultureFacilitySourceAdapter.parseSource(html).fileDetailSn()).isEqualTo("1");
        }

        @Test
        @DisplayName("DataDownload 가 없으면 CULTURE_SOURCE_PAGE_INVALID — 조용히 넘어가지 않는다")
        void failsWhenNoDataDownload() {
            // 포털이 페이지를 개편해 JSON-LD 에서 배포 정보가 빠진 상황. 여기서 분명히 드러나야
            // 파사드가 로컬 우회로 물러난다 — 못 찾은 채 진행하면 0건 적재가 된다.
            String html = pageWith("""
                {"@context":"https://schema.org","@type":"Dataset","name":"이름만 남은 메타데이터"}
                """);

            assertThatThrownBy(() -> DataGoKrCultureFacilitySourceAdapter.parseSource(html))
                .isInstanceOf(PlaceImportException.class)
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.CULTURE_SOURCE_PAGE_INVALID);
        }

        @Test
        @DisplayName("JSON-LD 블록이 하나 깨져 있어도 나머지에서 찾는다")
        void survivesBrokenJsonLdBlock() {
            String html = """
                <html><head>
                <script type="application/ld+json">{ 깨진 JSON </script>
                <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"Dataset",
                 "distribution":{"@type":"DataDownload","encodingFormat":"CSV","contentUrl":"%s"}}
                </script>
                </head></html>
                """.formatted(CONTENT_URL);

            assertThat(DataGoKrCultureFacilitySourceAdapter.parseSource(html).fileId()).isEqualTo("FILE_000000003214426");
        }
    }

    @Nested
    @DisplayName("Content-Disposition 파일명")
    class ParseFileName {

        @Test
        @DisplayName("filename= 의 따옴표를 걷어낸다")
        void readsPlainFileName() {
            String parsed = DataGoKrCultureFacilitySourceAdapter.parseFileName(
                "attachment; filename=\"한국문화정보원_전국 반려동물 동반 가능 문화시설 위치 데이터_20250324.csv\"");

            assertThat(parsed).isEqualTo("한국문화정보원_전국 반려동물 동반 가능 문화시설 위치 데이터_20250324.csv");
        }

        @Test
        @DisplayName("RFC 5987 filename* 을 우선하고 퍼센트 인코딩을 푼다")
        void prefersExtendedFileName() {
            String parsed = DataGoKrCultureFacilitySourceAdapter.parseFileName(
                "attachment; filename=\"fallback.csv\"; filename*=UTF-8''%ED%8C%8C%EC%9D%BC.csv");

            assertThat(parsed).isEqualTo("파일.csv");
        }

        @Test
        @DisplayName("plain filename= 은 퍼센트 디코딩하지 않는다 — 인코딩을 선언하지 않는 값이다")
        void keepsPlainFileNameAsIs() {
            String parsed = DataGoKrCultureFacilitySourceAdapter.parseFileName("attachment; filename=\"50%_할인.csv\"");

            assertThat(parsed).isEqualTo("50%_할인.csv");
        }

        @Test
        @DisplayName("헤더가 없으면 null — 파일명은 기록용이라 실패로 만들지 않는다")
        void returnsNullWhenHeaderMissing() {
            assertThat(DataGoKrCultureFacilitySourceAdapter.parseFileName(null)).isNull();
            assertThat(DataGoKrCultureFacilitySourceAdapter.parseFileName("attachment")).isNull();
        }
    }

    @Nested
    @DisplayName("내려받은 파일 최소 검증")
    class Validate {

        @TempDir
        Path tempDir;

        private DataGoKrCultureFacilitySourceAdapter adapter(long minContentLength) {
            // WebClient·서킷은 이 경로에서 쓰이지 않는다 — 검증은 파일과 설정값만 본다.
            return new DataGoKrCultureFacilitySourceAdapter(null,
                new CultureFacilityProperties(null, true, null, null, tempDir.toString(), 0, minContentLength), null);
        }

        private Path write(String content) throws IOException {
            Path file = tempDir.resolve("downloaded.csv");
            Files.writeString(file, content, StandardCharsets.UTF_8);
            return file;
        }

        @Test
        @DisplayName("헤더에 시설명이 있고 크기가 충분하면 통과한다")
        void acceptsRealCsv() throws IOException {
            Path file = write("﻿시설명,카테고리3,시도 명칭\n달빛카페,카페,제주특별자치도\n");

            adapter(1).validate(file, Files.size(file), Files.size(file));
        }

        @Test
        @DisplayName("Content-Length 헤더가 없으면(청크 전송) 대조를 건너뛰고 나머지만 본다")
        void skipsComparisonWhenHeaderAbsent() throws IOException {
            Path file = write("﻿시설명,카테고리3,시도 명칭\n달빛카페,카페,제주특별자치도\n");

            adapter(1).validate(file, Files.size(file), null);
        }

        @Test
        @DisplayName("헤더 크기와 실제 크기가 다르면 CULTURE_DOWNLOAD_INVALID — 잘린 판본이 스냅샷으로 굳지 않게")
        void rejectsTruncatedTransfer() throws IOException {
            // 전송이 중간에 끊긴 상황. 잘린 본문도 1MB 하한과 첫 줄 '시설명' 은 그대로 통과하므로,
            // 여기서 걸러 내지 않으면 다음 실행부터 같은 atchFileId 로 영구 SKIP 된다.
            Path file = write("﻿시설명,카테고리3,시도 명칭\n달빛카페,카페,제주특별자치도\n");

            assertThatThrownBy(() -> adapter(1).validate(file, Files.size(file), 30_633_222L))
                .isInstanceOf(PlaceImportException.class)
                .hasMessageContaining("Content-Length")
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.CULTURE_DOWNLOAD_INVALID);
        }

        @Test
        @DisplayName("최소 크기에 못 미치면 CULTURE_DOWNLOAD_INVALID")
        void rejectsTooSmallFile() throws IOException {
            Path file = write("﻿시설명,카테고리3\n");

            assertThatThrownBy(() -> adapter(1_048_576L).validate(file, Files.size(file), Files.size(file)))
                .isInstanceOf(PlaceImportException.class)
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.CULTURE_DOWNLOAD_INVALID);
        }

        @Test
        @DisplayName("점검 안내 HTML 을 200 으로 받아도 첫 줄에서 걸러낸다")
        void rejectsHtmlErrorPage() throws IOException {
            Path file = write("<!DOCTYPE html><html><head><title>서비스 점검 안내</title></head>\n");

            assertThatThrownBy(() -> adapter(1).validate(file, Files.size(file), Files.size(file)))
                .isInstanceOf(PlaceImportException.class)
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.CULTURE_DOWNLOAD_INVALID);
        }
    }
}
