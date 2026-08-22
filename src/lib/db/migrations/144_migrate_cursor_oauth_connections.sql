-- Migrate existing OAuth-mode Cursor connections from legacy 'cursor' provider to 'cursor-oauth'
UPDATE provider_connections
SET provider = 'cursor-oauth'
WHERE provider = 'cursor'
  AND (
    auth_type = 'oauth'
    OR (refresh_token IS NOT NULL AND refresh_token != '')
    OR provider_specific_data LIKE '%"authMethod":"oauth"%'
    OR provider_specific_data LIKE '%"oauth"%'
  );
