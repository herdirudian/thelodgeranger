-- AlterTable
ALTER TABLE `request`
  ADD COLUMN `securityReturnStatus` ENUM('RETURNED', 'NOT_RETURNED') NULL,
  ADD COLUMN `securityReturnNote` TEXT NULL,
  ADD COLUMN `securityReturnAt` DATETIME(3) NULL,
  ADD COLUMN `securityReturnById` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `request`
  ADD CONSTRAINT `request_securityReturnById_fkey`
  FOREIGN KEY (`securityReturnById`) REFERENCES `user`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

