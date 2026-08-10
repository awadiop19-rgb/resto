-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "method" TEXT;

-- Une dépense réglée depuis le tiroir d'un caissier a forcément été payée en
-- espèces : un tiroir ne contient rien d'autre. Ce n'est pas une hypothèse, on
-- peut donc la renseigner.
--
-- Les autres restent nulles. Le calcul les traitait déjà comme des espèces et
-- continuera de le faire, mais écrire CASH ferait passer cette hypothèse pour
-- une réponse, et plus rien ne distinguerait ce qu'on sait de ce qu'on suppose.
UPDATE "Expense" SET "method" = 'CASH' WHERE "cashRegisterId" IS NOT NULL;
