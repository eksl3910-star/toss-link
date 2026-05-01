-- 점검 화면에 표시할 선택 안내 문구
ALTER TABLE settings ADD COLUMN maintenance_message TEXT NOT NULL DEFAULT '';
