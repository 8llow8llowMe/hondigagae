package com.hondigagae.storage.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.storage.exception.StorageErrorCode;
import com.hondigagae.storage.exception.StorageException;
import com.hondigagae.storage.model.ImageFileType;
import com.hondigagae.storage.model.StorageDomain;
import org.junit.jupiter.api.Test;

class ObjectKeyFactoryTest {

    @Test
    void generate_buildsServerControlledKeyWithoutOriginalFilename() {
        String key = ObjectKeyFactory.generate(StorageDomain.COMMUNITY_POST, 42L, ImageFileType.PNG);

        assertThat(key).matches("^community/posts/42/\\d{4}/\\d{2}/[0-9a-f-]{36}\\.png$");
    }

    @Test
    void validateOwnership_acceptsOwnKey() {
        String key = ObjectKeyFactory.generate(StorageDomain.MEMBER_PROFILE, 7L, ImageFileType.JPEG);

        assertThatCode(() -> ObjectKeyFactory.validateOwnership(key, StorageDomain.MEMBER_PROFILE, 7L))
            .doesNotThrowAnyException();
    }

    @Test
    void validateOwnership_rejectsOtherMembersKey() {
        String othersKey = ObjectKeyFactory.generate(StorageDomain.COMMUNITY_POST, 999L, ImageFileType.JPEG);

        assertThatThrownBy(() -> ObjectKeyFactory.validateOwnership(othersKey, StorageDomain.COMMUNITY_POST, 7L))
            .isInstanceOf(StorageException.class)
            .extracting(exception -> ((StorageException) exception).getErrorCode())
            .isEqualTo(StorageErrorCode.FORBIDDEN_OBJECT_KEY);
    }

    @Test
    void validateOwnership_rejectsOtherDomainKey() {
        String profileKey = ObjectKeyFactory.generate(StorageDomain.MEMBER_PROFILE, 7L, ImageFileType.JPEG);

        assertThatThrownBy(() -> ObjectKeyFactory.validateOwnership(profileKey, StorageDomain.COMMUNITY_POST, 7L))
            .isInstanceOf(StorageException.class)
            .extracting(exception -> ((StorageException) exception).getErrorCode())
            .isEqualTo(StorageErrorCode.INVALID_OBJECT_KEY);
    }

    @Test
    void validateOwnership_rejectsPathTraversalAndMalformedKeys() {
        for (String malformed : new String[] {
            null,
            "",
            "community/posts/7/2026/08/../../../etc/passwd",
            "community/posts/7/2026/08/not-a-uuid.png",
            "../community/posts/7/2026/08/00000000-0000-0000-0000-000000000000.png",
            "https://minio.example.com/bucket/community/posts/7/2026/08/00000000-0000-0000-0000-000000000000.png"
        }) {
            assertThatThrownBy(() -> ObjectKeyFactory.validateOwnership(malformed, StorageDomain.COMMUNITY_POST, 7L))
                .isInstanceOf(StorageException.class);
        }
    }
}
