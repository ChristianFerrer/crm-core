-- RGPD: consentimiento del tutor al registrar un miembro
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text DEFAULT 'v1.0';

-- RGPD: aceptación de T&C por parte de la ludoteca (responsable del tratamiento)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text DEFAULT 'v1.0';
