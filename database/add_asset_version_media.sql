ALTER TABLE asset_versions
    ADD COLUMN version_media_url TEXT NULL,
    ADD COLUMN review_feedback TEXT NULL;

UPDATE asset_versions av
INNER JOIN assets a ON a.id = av.asset_id
SET av.version_media_url = a.external_link
WHERE av.version_number = (
    SELECT latest.version_number
    FROM (
        SELECT asset_id, MAX(version_number) AS version_number
        FROM asset_versions
        GROUP BY asset_id
    ) latest
    WHERE latest.asset_id = av.asset_id
)
AND NULLIF(TRIM(a.external_link), '') IS NOT NULL;
