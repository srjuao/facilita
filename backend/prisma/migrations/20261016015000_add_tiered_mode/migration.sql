-- Commit the new enum value separately before later migrations use it.
ALTER TYPE "BillingMode" ADD VALUE 'FAIXAS';
