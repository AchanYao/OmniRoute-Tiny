-- Historical import and startup logic wrote automatic global model aliases.
-- This instance is confirmed not to contain manual database model aliases.
DELETE FROM key_value WHERE namespace = 'modelAliases';
