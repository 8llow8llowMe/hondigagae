package com.hondigagae.common.dto.metadata;

public interface ScoreMetricDescribable extends CodeNameDescribable {

    String getScoreDescription();

    default ScoreMetricMetadata toScoreMetadata() {
        if (!(this instanceof Enum<?> enumValue)) {
            throw new IllegalStateException("ScoreMetricDescribable must be implemented by enum");
        }

        return ScoreMetricMetadata.of(enumValue.name(), getDisplayName(), getDescription(), getScoreDescription());
    }
}
