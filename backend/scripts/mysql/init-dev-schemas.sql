-- 혼디가개 dev 스키마 준비 (main-server MySQL, root 로 1회 실행)
--
-- JPA ddl-auto:update 와 Spring Batch initialize-schema:always 는 **테이블**만 만든다.
-- 데이터베이스(스키마) 자체는 만들지 않으므로, 없으면 기동 시 아래처럼 죽는다.
--   SQLGrammarException: unable to obtain isolated JDBC connection [Unknown database 'hondigagae_tour']
--
-- 스키마명은 Vault 의 *_DB_URL 과 **한 글자도 다르면 안 된다.** 이 스크립트는 문서(deploy-guide.md)
-- 규칙인 `hondigagae_{service}_dev` 를 만든다. Vault URL 이 `hondigagae_tour` 처럼 접미사 없이
-- 들어가 있으면 Vault 를 이 이름으로 고치는 쪽을 권한다 — prod 를 같은 MySQL 에 올릴 가능성과
-- BossPickSeoul 규칙(`bosspickseoul_auth_dev`)에 맞추기 위해서다.
--
-- 실행:
--   docker exec -i mysql mysql -uroot -p < init-dev-schemas.sql
--
-- 서비스별 스키마 하나, 스키마를 가로지르는 FK 는 두지 않는다(약한 결합).
-- batch-service 는 tour 스키마를 함께 쓴다(적재 대상이 place, BATCH_* 메타 테이블도 여기).
-- ai-service · api-gateway · service-discovery 는 DB 를 쓰지 않는다.

CREATE DATABASE IF NOT EXISTS hondigagae_auth_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hondigagae_tour_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hondigagae_plan_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 계정: Vault 의 DB_USERNAME 과 같은 계정에 권한을 준다.
-- 현재 dev Vault 는 BossPickSeoul 과 같은 계정(followfollowme)을 쓴다. 이미 있는 계정이라 CREATE USER 는 하지 않는다.
GRANT ALL PRIVILEGES ON hondigagae_auth_dev.* TO 'followfollowme'@'%';
GRANT ALL PRIVILEGES ON hondigagae_tour_dev.* TO 'followfollowme'@'%';
GRANT ALL PRIVILEGES ON hondigagae_plan_dev.* TO 'followfollowme'@'%';

-- 전용 계정을 쓰려면 위 GRANT 대신 아래를 쓰고 Vault 의 DB_USERNAME / DB_PASSWORD 를 바꾼다.
-- CREATE USER IF NOT EXISTS 'hondigagae'@'%' IDENTIFIED BY '<DB_PASSWORD>';
-- GRANT ALL PRIVILEGES ON hondigagae_auth_dev.* TO 'hondigagae'@'%';
-- GRANT ALL PRIVILEGES ON hondigagae_tour_dev.* TO 'hondigagae'@'%';
-- GRANT ALL PRIVILEGES ON hondigagae_plan_dev.* TO 'hondigagae'@'%';

FLUSH PRIVILEGES;

-- 확인
SHOW DATABASES LIKE 'hondigagae\_%';
