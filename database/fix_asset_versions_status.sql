-- Fixes a malformed ENUM on asset_versions.status that was truncated at table-creation time:
-- it currently only allows ('For Review','Approved','Rejected','Revisi') — 'Revision Requested'
-- got cut off to 'Revisi' and 'Final' is missing entirely, so those two review outcomes can
-- never be saved for a real, database-backed asset. This widens it to the full 5 statuses the
-- app actually uses (see STATUS_CLASS in js/shared.js). Existing rows are unaffected — as of
-- this writing every row in asset_versions.status is 'For Review', which remains valid.

ALTER TABLE asset_versions
  MODIFY status ENUM('For Review','Approved','Rejected','Revision Requested','Final') NOT NULL DEFAULT 'For Review';
