package com.hondigagae.domainlayer.walkcourseimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseSourceQueryResult;
import com.hondigagae.global.properties.OlleCourseProperties;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DataGoKrOlleCourseSourceAdapterTest {

    private static final String CONTENT_URL =
        "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000001111111&fileDetailSn=1&insertDataPrcus=N";

    private static String pageWith(String jsonLd) {
        return """
            <!DOCTYPE html><html><head><title>제주특별자치도_올레코스현황</title>
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
                {"@context":"https://schema.org","@type":"Dataset","name":"제주특별자치도_올레코스현황",
                 "distribution":[{"@type":"DataDownload","encodingFormat":"CSV","contentUrl":"%s"}]}
                """.formatted(CONTENT_URL));

            OlleCourseSourceQueryResult source = DataGoKrOlleCourseSourceAdapter.parseSource(html);

            assertThat(source.fileId()).isEqualTo("FILE_000000001111111");
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

            assertThat(DataGoKrOlleCourseSourceAdapter.parseSource(html).fileDetailSn()).isEqualTo("1");
        }

        @Test
        @DisplayName("DataDownload 가 없으면 SOURCE_PAGE_INVALID")
        void failsWhenNoDataDownload() {
            String html = pageWith("""
                {"@context":"https://schema.org","@type":"Dataset","name":"이름만 남은 메타데이터"}
                """);

            assertThatThrownBy(() -> DataGoKrOlleCourseSourceAdapter.parseSource(html))
                .isInstanceOf(WalkCourseImportException.class)
                .extracting(exception -> ((WalkCourseImportException) exception).getErrorCode())
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID);
        }
    }

    @Nested
    @DisplayName("내려받은 파일 최소 검증")
    class Validate {

        @TempDir
        Path tempDir;

        private DataGoKrOlleCourseSourceAdapter adapter(long minContentLength) {
            return new DataGoKrOlleCourseSourceAdapter(null,
                new OlleCourseProperties(null, true, null, null, tempDir.toString(), 0, minContentLength), null);
        }

        private Path write(String content, Charset charset) throws IOException {
            Path file = tempDir.resolve("downloaded.csv");
            Files.write(file, content.getBytes(charset));
            return file;
        }

        @Test
        @DisplayName("UTF-8 헤더에 코스별이 있고 크기가 충분하면 통과한다")
        void acceptsUtf8Csv() throws IOException {
            Path file = write("코스별,코스명,거리,소요시간정보,시종점정보,데이터기준일자\n1코스,시흥-광치기,15.1km,4~5시간,시점-종점,2025-04-28\n",
                StandardCharsets.UTF_8);

            adapter(1).validate(file, Files.size(file), Files.size(file));
        }

        @Test
        @DisplayName("포털 원본(CP949)도 첫 줄 코스별로 통과한다")
        void acceptsMs949Csv() throws IOException {
            Path file = write("코스별,코스명,거리\n1코스,시흥-광치기,15.1km\n", Charset.forName("MS949"));

            adapter(1).validate(file, Files.size(file), Files.size(file));
        }

        @Test
        @DisplayName("헤더 크기와 실제 크기가 다르면 DOWNLOAD_INVALID")
        void rejectsTruncatedTransfer() throws IOException {
            Path file = write("코스별,코스명\n1코스,시흥-광치기\n", StandardCharsets.UTF_8);

            assertThatThrownBy(() -> adapter(1).validate(file, Files.size(file), 30_000L))
                .isInstanceOf(WalkCourseImportException.class)
                .hasMessageContaining("Content-Length")
                .extracting(exception -> ((WalkCourseImportException) exception).getErrorCode())
                .isEqualTo(WalkCourseImportErrorCode.DOWNLOAD_INVALID);
        }

        @Test
        @DisplayName("점검 안내 HTML 을 200 으로 받아도 첫 줄에서 걸러낸다")
        void rejectsHtmlErrorPage() throws IOException {
            Path file = write("<!DOCTYPE html><html><head><title>서비스 점검 안내</title></head>\n", StandardCharsets.UTF_8);

            assertThatThrownBy(() -> adapter(1).validate(file, Files.size(file), Files.size(file)))
                .isInstanceOf(WalkCourseImportException.class)
                .extracting(exception -> ((WalkCourseImportException) exception).getErrorCode())
                .isEqualTo(WalkCourseImportErrorCode.DOWNLOAD_INVALID);
        }
    }
}
