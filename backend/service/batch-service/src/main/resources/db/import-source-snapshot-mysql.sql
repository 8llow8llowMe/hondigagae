-- 원천 파일 스냅샷 (#379).
--
-- 문화정보원처럼 "파일 하나를 통째로 다시 받는" 원천은 파일이 바뀌지 않았는데도 매 주기 30MB 를
-- 내려받고 7만 행을 다시 파싱했다. 무엇을 받았는지 남겨 두면 다음 실행이 그것과 비교해 건너뛴다.
--
-- append-only 이력이다. UPDATE 하지 않고 실행마다 한 행을 넣으며, 최신은 created_at DESC LIMIT 1 이다.
-- 갱신 이력이 남아 있어야 "언제부터 파일이 안 바뀌었나"를 사람이 되짚을 수 있다.
--
-- 적용:
--   local·dev·test = spring.sql.init 이 기동 시 실행한다 (application-{local,dev,test}.yml).
--   prod           = spring.sql.init.mode=never 다. 이 파일이 prod 런북의 정본이다
--                    (backend/docs/deploy-guide.md "DB 스키마 준비").
--     docker exec -i mysql mysql -uroot -p hondigagae_tour \
--       < backend/service/batch-service/src/main/resources/db/import-source-snapshot-mysql.sql
--
-- H2(MODE=MySQL) 에서도 그대로 돌아야 한다 — 컨텍스트 로딩 게이트가 이 스크립트를 실행한다.
CREATE TABLE IF NOT EXISTS import_source_snapshot (
    id                  BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT 'PK',
    source              VARCHAR(32)  NOT NULL COMMENT '원천 식별자. 예: CULTURE_PORTAL, OLLE_COURSE',
    area_code           VARCHAR(8)   NOT NULL COMMENT '적재 범위 관광 지역코드. 적재/delist 범위와 같은 값이어야 한다',
    file_id             VARCHAR(64)  NOT NULL COMMENT '원천 파일 식별자. 문화정보원은 포털의 atchFileId',
    file_name           VARCHAR(255) NULL     COMMENT 'Content-Disposition 파일명. 사람이 어느 판본인지 알아보는 용도',
    content_length      BIGINT       NOT NULL COMMENT '실제로 받은 바이트 수. file_id 가 바뀌었을 때의 교차 확인 키',
    source_modified_max DATETIME     NULL     COMMENT '적재한 행의 최종작성일 최대값. 파일 갱신 여부의 보조 근거',
    imported_count      INT          NOT NULL COMMENT '이번 실행에서 적재한 장소 수. 0 건 실행은 스냅샷을 남기지 않는다',
    run_started_at      DATETIME     NOT NULL COMMENT '적재 시작 시각. delist 기준 시각과 같은 값',
    created_at          DATETIME     NOT NULL COMMENT '스냅샷 기록 시각. 최신 판정 기준',
    INDEX idx_import_source_snapshot_source_area_code_created_at (source, area_code, created_at)
) COMMENT '원천 파일 적재 이력. 다음 실행이 같은 파일인지 판정하는 근거';
